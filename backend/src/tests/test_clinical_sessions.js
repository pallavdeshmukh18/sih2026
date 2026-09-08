require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runClinicalSessionTests() {
    console.log("=== STARTING CLINICAL INTAKE SESSION INTEGRATION TESTS ===");

    let server;
    const PORT = 5097;
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

    const createdIds = { users: [], appointments: [], sessions: [] };

    try {
        const timestamp = Date.now();

        // 1. Setup Patient
        const patientEmail = `patient_session_${timestamp}@example.com`;
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Raj', 'Patel', $1, 'email', 'patient', true)
             RETURNING id, role;`,
            [patientEmail]
        );
        const patient = patientRes.rows[0];
        createdIds.users.push(patient.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, '1985-05-15', 'male');`,
            [patient.id]
        );

        const patientToken = jwt.sign({ sub: patient.id, role: patient.role }, JWT_SECRET, { expiresIn: "1h" });

        // 2. Setup Doctor
        const doctorEmail = `doctor_session_${timestamp}@example.com`;
        const docRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Dr. Priya', 'Sharma', $1, 'email', 'doctor', true)
             RETURNING id, role;`,
            [doctorEmail]
        );
        const doctor = docRes.rows[0];
        createdIds.users.push(doctor.id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, 'REG_${timestamp}', 'General Medicine', 'OPD', 'verified');`,
            [doctor.id]
        );

        // 3. Create Appointment (Required)
        const scheduledTime = new Date().toISOString();
        const apptRes = await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, reason, status)
             VALUES ($1, $2, $3, 30, 'Chest Pain intake', 'scheduled')
             RETURNING id;`,
            [patient.id, doctor.id, scheduledTime]
        );
        const appointmentId = apptRes.rows[0].id;
        createdIds.appointments.push(appointmentId);

        // TEST 1: Start Session without chiefComplaint (expected failure)
        console.log("\n[TEST 1] Starting session without chiefComplaint (expected failure)...");
        const failStart = await request("POST", "/api/sessions/start", {
            appointmentId: appointmentId,
        }, patientToken);
        console.log(`Status: ${failStart.status}`);
        if (failStart.status !== 400) {
            throw new Error(`Expected 400 when missing chiefComplaint, got ${failStart.status}`);
        }

        // Test invalid appointmentId format
        const failInvalidAppt = await request("POST", "/api/sessions/start", {
            appointmentId: "general_intake",
            chiefComplaint: "chest_pain",
        }, patientToken);
        if (failInvalidAppt.status !== 400) {
            throw new Error(`Expected 400 for invalid appointmentId format, got ${failInvalidAppt.status}`);
        }
        console.log("✅ [TEST 1 PASSED] Rejected session without chiefComplaint and invalid appointmentId.");

        // TEST 2: Start Valid Clinical Intake Session
        console.log("\n[TEST 2] Starting clinical session with valid appointmentId...");
        const startRes = await request("POST", "/api/sessions/start", {
            appointmentId: appointmentId,
            chiefComplaint: "chest_pain",
            language: "en",
            consultationType: "allopathic",
        }, patientToken);
        console.log(`Status: ${startRes.status}`, startRes.body);
        if (startRes.status !== 201 && startRes.status !== 200) {
            throw new Error(`Failed to start session: ${JSON.stringify(startRes.body)}`);
        }
        const sessionId = startRes.body.sessionId;
        createdIds.sessions.push(sessionId);
        console.log(`✅ [TEST 2 PASSED] Session started with ID: ${sessionId}`);

        // TEST 3: Process Text Turn in Session
        console.log("\n[TEST 3] Sending patient text turn...");
        const textTurnRes = await request("POST", `/api/sessions/${sessionId}/text-turn`, {
            patientText: "I have had severe chest pain for 3 days with shortness of breath and sweating",
        }, patientToken);
        console.log(`Status: ${textTurnRes.status}`, textTurnRes.body);
        if (textTurnRes.status !== 200) {
            throw new Error(`Failed to process text turn: ${JSON.stringify(textTurnRes.body)}`);
        }
        console.log("✅ [TEST 3 PASSED] Text turn processed.");

        // TEST 4: Get Session by ID
        console.log("\n[TEST 4] Retrieving session state by ID...");
        const getRes = await request("GET", `/api/sessions/${sessionId}`, null, patientToken);
        console.log(`Status: ${getRes.status}`);
        if (getRes.status !== 200 || getRes.body.session?.id !== sessionId) {
            throw new Error(`Failed to fetch session: ${JSON.stringify(getRes.body)}`);
        }
        console.log("✅ [TEST 4 PASSED] Session state retrieved.");

        // TEST 5: Finalize Session & Generate Summary
        console.log("\n[TEST 5] Finalizing session and generating AI clinical summary...");
        const finalRes = await request("POST", `/api/sessions/${sessionId}/finalize`, {
            documentData: {
                medications: [{ medicine: "Aspirin", dose: "75mg", frequency: "OD" }],
                lab_results: [{ test: "Troponin I", value: "0.04", unit: "ng/mL", flag: "normal" }],
            },
        }, patientToken);
        console.log(`Status: ${finalRes.status}`, finalRes.body);
        if (finalRes.status !== 200 || !finalRes.body.session?.summary) {
            throw new Error(`Failed to finalize session: ${JSON.stringify(finalRes.body)}`);
        }
        console.log("✅ [TEST 5 PASSED] Session summarized and finalized.");

        console.log("\n🎉 ALL CLINICAL SESSION INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");
    } catch (err) {
        console.error("❌ Test failed:", err.message);
        process.exitCode = 1;
    } finally {
        // Cleanup
        for (const sessId of createdIds.sessions) {
            await pool.query(`DELETE FROM clinical_sessions WHERE id = $1`, [sessId]);
        }
        for (const apptId of createdIds.appointments) {
            await pool.query(`DELETE FROM appointments WHERE id = $1`, [apptId]);
        }
        for (const userId of createdIds.users) {
            await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        }
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runClinicalSessionTests().then(() => process.exit(process.exitCode || 0));
}

module.exports = runClinicalSessionTests;
