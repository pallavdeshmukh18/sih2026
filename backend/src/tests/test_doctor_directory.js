require("dotenv").config();
const http = require("http");
const pool = require("../config/db");
const app = require("../server");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port: 5098,
            path,
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                let parsed = {};
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = { text: data };
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on("error", reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log("=== STARTING DOCTOR DIRECTORY & BOOKING INTEGRATION TESTS ===");

    const server = app.listen(5098);
    await new Promise((res) => setTimeout(res, 800));
    console.log("Test server running on port 5098");

    let patientId, verifiedDoctorId, pendingDoctorId, patientToken;

    try {
        // Setup Test Patient
        const patientEmail = `dir_patient_${Date.now()}@example.com`;
        const pRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Directory', 'Patient', $1, 'email', 'patient', true)
             RETURNING id;`,
            [patientEmail]
        );
        patientId = pRes.rows[0].id;
        await pool.query(`INSERT INTO patient_profiles (user_id) VALUES ($1);`, [patientId]);
        patientToken = jwt.sign({ sub: patientId, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // Setup Verified Doctor
        const vDoctorEmail = `dir_vdoc_${Date.now()}@example.com`;
        const vRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Anil', 'Verma', $1, 'email', 'doctor', true)
             RETURNING id;`,
            [vDoctorEmail]
        );
        verifiedDoctorId = vRes.rows[0].id;
        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, $2, 'Cardiology', 'Cardiovascular Care', 'verified');`,
            [verifiedDoctorId, `REG_${Date.now()}_1`]
        );

        // Setup Pending Doctor (Must NOT appear in directory)
        const pDoctorEmail = `dir_pdoc_${Date.now()}@example.com`;
        const pendRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Pending', 'Doc', $1, 'email', 'doctor', true)
             RETURNING id;`,
            [pDoctorEmail]
        );
        pendingDoctorId = pendRes.rows[0].id;
        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, $2, 'Dermatology', 'Skin Care', 'pending');`,
            [pendingDoctorId, `REG_${Date.now()}_2`]
        );

        // TEST 1: GET /api/doctor/directory returns verified doctors only
        console.log("\n[TEST 1] GET /api/doctor/directory");
        const res1 = await request("GET", "/api/doctor/directory", null, { Authorization: `Bearer ${patientToken}` });
        if (res1.status !== 200 || !res1.body.doctors) {
            throw new Error(`Test 1 failed: Expected 200 with doctors array, got ${res1.status} ${JSON.stringify(res1.body)}`);
        }
        const doctorIds = res1.body.doctors.map((d) => d.id);
        if (!doctorIds.includes(verifiedDoctorId)) {
            throw new Error("Test 1 failed: Verified doctor did not appear in directory.");
        }
        if (doctorIds.includes(pendingDoctorId)) {
            throw new Error("Test 1 failed: Pending doctor illegally appeared in public directory!");
        }
        console.log("✅ [TEST 1 PASSED] Directory returns only verified, active doctors.");

        // TEST 2: Verify security — no password hashes or private fields returned
        console.log("\n[TEST 2] Verifying sensitive field exclusion in GET /api/doctor/directory");
        const verifiedDocInRes = res1.body.doctors.find((d) => d.id === verifiedDoctorId);
        if (verifiedDocInRes.password_hash || verifiedDocInRes.provider_id) {
            throw new Error("Test 2 failed: Sensitive fields exposed in public doctor directory!");
        }
        console.log("✅ [TEST 2 PASSED] Public doctor directory excludes all security & auth fields.");

        // TEST 3: Patient creates appointment with verified doctor
        console.log("\n[TEST 3] POST /api/appointments with verified doctor");
        const scheduledTime = new Date(Date.now() + 86400000).toISOString();
        const res3 = await request("POST", "/api/appointments", {
            doctorId: verifiedDoctorId,
            scheduledAt: scheduledTime,
            durationMinutes: 30,
            appointmentType: "in_person",
            reason: "Cardiac Routine Checkup",
        }, { Authorization: `Bearer ${patientToken}` });

        if (res3.status !== 201 || !res3.body.success || !res3.body.appointment) {
            throw new Error(`Test 3 failed: Expected 201 Created, got ${res3.status} ${JSON.stringify(res3.body)}`);
        }
        const createdApptId = res3.body.appointment.id;
        console.log(`✅ [TEST 3 PASSED] Appointment created successfully. ID: ${createdApptId}`);

        // TEST 4: Booking with pending / unverified doctor rejected
        console.log("\n[TEST 4] POST /api/appointments with pending doctor");
        const res4 = await request("POST", "/api/appointments", {
            doctorId: pendingDoctorId,
            scheduledAt: scheduledTime,
            reason: "Attempt booking pending doctor",
        }, { Authorization: `Bearer ${patientToken}` });

        if (res4.status !== 404) {
            throw new Error(`Test 4 failed: Expected 404 for unverified doctor, got ${res4.status}`);
        }
        console.log("✅ [TEST 4 PASSED] Booking unverified doctor rejected.");

        // TEST 5: Verify new appointment appears in GET /api/appointments/patient
        console.log("\n[TEST 5] GET /api/appointments/patient");
        const res5 = await request("GET", "/api/appointments/patient", null, { Authorization: `Bearer ${patientToken}` });
        if (res5.status !== 200 || !res5.body.appointments) {
            throw new Error(`Test 5 failed: Expected 200 OK, got ${res5.status}`);
        }
        const patientApptIds = res5.body.appointments.map((a) => a.id);
        if (!patientApptIds.includes(createdApptId)) {
            throw new Error("Test 5 failed: Newly booked appointment did not appear in patient appointment list!");
        }
        console.log("✅ [TEST 5 PASSED] Newly booked appointment appears in patient's dashboard dataset.");

        console.log("\n🎉 ALL DOCTOR DIRECTORY & BOOKING INTEGRATION TESTS PASSED 100%! 🎉");
    } catch (err) {
        console.error("❌ Test suite error:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        if (patientId) {
            await pool.query("DELETE FROM appointments WHERE patient_id = $1;", [patientId]);
            await pool.query("DELETE FROM users WHERE id = $1;", [patientId]);
        }
        if (verifiedDoctorId) await pool.query("DELETE FROM users WHERE id = $1;", [verifiedDoctorId]);
        if (pendingDoctorId) await pool.query("DELETE FROM users WHERE id = $1;", [pendingDoctorId]);
        pool.end();
    }
}

runTests();
