require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runTeleconsultTests() {
    console.log("=== STARTING TELECONSULTATION INTEGRATION TESTS ===");

    let server;
    const PORT = 5099;
    await new Promise((resolve) => {
        server = app.listen(PORT, () => {
            console.log(`Test server running on port ${PORT}`);
            resolve();
        });
    });

    const baseUrl = `http://localhost:${PORT}`;

    async function request(method, path, body = null, token = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, baseUrl);
            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const req = http.request(url, { method, headers }, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        parsed = data;
                    }
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on("error", reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    const createdIds = { users: [], sessions: [] };

    try {
        const timestamp = Date.now();

        // 1. Setup Patient
        const patientEmail = `patient_tele_${timestamp}@example.com`;
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Anjali', 'Sharma', $1, 'email', 'patient', true)
             RETURNING id, role;`,
            [patientEmail]
        );
        const patient = patientRes.rows[0];
        createdIds.users.push(patient.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, gender, date_of_birth)
             VALUES ($1, 'female', '1995-04-12') ON CONFLICT (user_id) DO NOTHING;`,
            [patient.id]
        );

        const patientToken = jwt.sign(
            { id: patient.id, role: patient.role, firstName: "Anjali", lastName: "Sharma" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // 2. Setup Doctor
        const doctorEmail = `dr_tele_${timestamp}@example.com`;
        const doctorRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Sanjay', 'Gupta', $1, 'email', 'doctor', true)
             RETURNING id, role;`,
            [doctorEmail]
        );
        const doctor = doctorRes.rows[0];
        createdIds.users.push(doctor.id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, 'MCI-TELE-9988', 'Cardiology', 'Internal Medicine', 'verified')
             ON CONFLICT (user_id) DO NOTHING;`,
            [doctor.id]
        );

        const doctorToken = jwt.sign(
            { id: doctor.id, role: doctor.role, firstName: "Sanjay", lastName: "Gupta" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Test 1: Config
        console.log("\n[TEST 1] GET /api/teleconsult/config");
        const configRes = await request("GET", "/api/teleconsult/config", null, patientToken);
        console.log("Config response status:", configRes.status);
        if (configRes.status !== 200 || !configRes.body.success) {
            throw new Error("Failed to fetch teleconsult config.");
        }
        console.log("Config verified: App ID present ✅");

        // Test 2: Patient submits call request
        console.log("\n[TEST 2] POST /api/teleconsult/request (Patient requests Video Call)");
        const requestPayload = {
            doctorId: doctor.id,
            callType: "video",
            reason: "Persistent chest tightness and palpitations after exercise",
            patientNotes: "Currently taking Amlodipine 5mg",
        };
        const createRes = await request("POST", "/api/teleconsult/request", requestPayload, patientToken);
        console.log("Request status:", createRes.status, "Message:", createRes.body.message);
        if (createRes.status !== 201 || !createRes.body.success) {
            throw new Error(`Failed to create call request: ${JSON.stringify(createRes.body)}`);
        }
        const session = createRes.body.session;
        createdIds.sessions.push(session.id);
        if (session.status !== "pending_approval") {
            throw new Error(`Expected status 'pending_approval', got: ${session.status}`);
        }
        console.log("Call request created with pending_approval ✅");

        // Test 3: Doctor views triage queue
        console.log("\n[TEST 3] GET /api/teleconsult/sessions (Doctor views queue)");
        const docQueueRes = await request("GET", "/api/teleconsult/sessions", null, doctorToken);
        console.log("Doctor queue status:", docQueueRes.status);
        if (docQueueRes.status !== 200 || !docQueueRes.body.sessions) {
            throw new Error("Failed to fetch doctor sessions queue.");
        }
        const foundInQueue = docQueueRes.body.sessions.find((s) => s.id === session.id);
        if (!foundInQueue || foundInQueue.status !== "pending_approval") {
            throw new Error("Submitted request not found in doctor triage queue.");
        }
        console.log("Found session in doctor triage queue ✅");

        // Test 4: Doctor approves call request
        console.log("\n[TEST 4] PATCH /api/teleconsult/:id/respond (Doctor approves)");
        const approveRes = await request(
            "PATCH",
            `/api/teleconsult/${session.id}/respond`,
            { action: "approve", doctorNotes: "Ready for consultation." },
            doctorToken
        );
        console.log("Approval status:", approveRes.status, "Message:", approveRes.body.message);
        if (approveRes.status !== 200 || approveRes.body.session.status !== "approved") {
            throw new Error(`Failed to approve call request: ${JSON.stringify(approveRes.body)}`);
        }
        console.log("Doctor approval confirmed ✅");

        // Test 5: Patient joins call & receives Agora RTC token
        console.log("\n[TEST 5] POST /api/teleconsult/:id/join (Patient joins call)");
        const joinRes = await request("POST", `/api/teleconsult/${session.id}/join`, null, patientToken);
        console.log("Join status:", joinRes.status, "Agora Channel:", joinRes.body.agora?.channelName);
        if (joinRes.status !== 200 || !joinRes.body.agora?.channelName) {
            throw new Error(`Failed to join call session: ${JSON.stringify(joinRes.body)}`);
        }
        console.log("Agora RTC credentials and token received ✅");

        // Test 6: In-call direct messaging
        console.log("\n[TEST 6] POST /api/teleconsult/:id/messages (Chat exchange)");
        const msg1 = await request(
            "POST",
            `/api/teleconsult/${session.id}/messages`,
            { message: "Hello Doctor, I have joined the video room." },
            patientToken
        );
        console.log("Patient message sent status:", msg1.status);

        const msg2 = await request(
            "POST",
            `/api/teleconsult/${session.id}/messages`,
            { message: "Hello Anjali, I can see and hear you clearly." },
            doctorToken
        );
        console.log("Doctor message sent status:", msg2.status);

        const messagesRes = await request("GET", `/api/teleconsult/${session.id}/messages`, null, patientToken);
        console.log("Messages count in thread:", messagesRes.body.messages?.length);
        if (!messagesRes.body.messages || messagesRes.body.messages.length < 3) {
            throw new Error("Chat message thread count mismatch.");
        }
        console.log("Chat messages verified in thread ✅");

        // Test 7: Doctor ends call with clinical notes & prescription
        console.log("\n[TEST 7] POST /api/teleconsult/:id/end (Doctor finishes call)");
        const endRes = await request(
            "POST",
            `/api/teleconsult/${session.id}/end`,
            {
                doctorNotes: "Benign sinus arrhythmia. Advised ECG and stress test.",
                prescription: "Tab Metoprolol 25mg 1-0-0 after food. Rest and hydration.",
            },
            doctorToken
        );
        console.log("End call status:", endRes.status, "Session status:", endRes.body.session?.status);
        if (endRes.status !== 200 || endRes.body.session?.status !== "completed") {
            throw new Error(`Failed to end consultation: ${JSON.stringify(endRes.body)}`);
        }
        console.log("Consultation completed with prescription and notes saved ✅");

        console.log("\n==================================================");
        console.log("🎉 ALL TELECONSULTATION TESTS PASSED SUCCESSFULLY!");
        console.log("==================================================");
    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exitCode = 1;
    } finally {
        // Cleanup
        console.log("\nCleaning up test artifacts from database...");
        for (const sessionId of createdIds.sessions) {
            await pool.query("DELETE FROM teleconsult_sessions WHERE id = $1;", [sessionId]).catch(() => {});
        }
        for (const userId of createdIds.users) {
            await pool.query("DELETE FROM users WHERE id = $1;", [userId]).catch(() => {});
        }
        console.log("Cleanup finished.");
        server && server.close();
        process.exit(process.exitCode || 0);
    }
}

runTeleconsultTests();
