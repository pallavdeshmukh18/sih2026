require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runDoctorConsultationTests() {
    console.log("=== STARTING DOCTOR QUEUE & CONSULTATION INTEGRATION TESTS ===");

    let server;
    const PORT = 5095;
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

    const createdIds = { users: [], appointments: [], sessions: [], consultations: [] };

    try {
        const timestamp = Date.now();

        // 1. Setup Patient
        const patientEmail = `patient_consult_${timestamp}@example.com`;
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Amit', 'Verma', $1, 'email', 'patient', true)
             RETURNING id, role;`,
            [patientEmail]
        );
        const patient = patientRes.rows[0];
        createdIds.users.push(patient.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender, abha_id)
             VALUES ($1, '1982-03-25', 'male', $2);`,
            [patient.id, `91-1234-5678-${timestamp.toString().slice(-4)}`]
        );

        // Add sample medical history
        await pool.query(
            `INSERT INTO medical_history (patient_id, category, condition, status)
             VALUES ($1, 'condition', 'Hypertension', 'active'),
                    ($1, 'allergy', 'Penicillin', 'active');`,
            [patient.id]
        );

        const patientToken = jwt.sign({ sub: patient.id, role: patient.role }, JWT_SECRET, { expiresIn: "1h" });

        // 2. Setup Doctor
        const doctorEmail = `doctor_consult_${timestamp}@example.com`;
        const docRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Dr. Vikram', 'Mehta', $1, 'email', 'doctor', true)
             RETURNING id, role;`,
            [doctorEmail]
        );
        const doctor = docRes.rows[0];
        createdIds.users.push(doctor.id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, 'REG_DOC_${timestamp}', 'Internal Medicine', 'OPD Clinic', 'verified');`,
            [doctor.id]
        );

        const doctorToken = jwt.sign({ sub: doctor.id, role: doctor.role }, JWT_SECRET, { expiresIn: "1h" });

        // 3. Setup Appointment
        const scheduledTime = new Date().toISOString();
        const apptRes = await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, reason, status)
             VALUES ($1, $2, $3, 30, 'Severe Palpitations and Dizziness', 'confirmed')
             RETURNING id;`,
            [patient.id, doctor.id, scheduledTime]
        );
        const appointmentId = apptRes.rows[0].id;
        createdIds.appointments.push(appointmentId);

        // 4. Setup Completed Clinical Intake Session with Red Flags
        const sessionState = {
            session_id: require("crypto").randomUUID(),
            patient_id: patient.id,
            chief_complaint: "palpitations",
            answered_fields: { onset: "4 hours ago", severity: "High" },
            red_flags: ["Potential cardiac event (Chest pain with associated symptoms). Priority triage recommended."],
        };

        const sessionRes = await pool.query(
            `INSERT INTO clinical_sessions (patient_id, appointment_id, language, consultation_type, chief_complaint, status, current_state, summary)
             VALUES ($1, $2, 'en', 'allopathic', 'Palpitations and dizziness', 'completed', $3, 'Patient experienced acute onset palpitations and dizziness.')
             RETURNING id;`,
            [patient.id, appointmentId, JSON.stringify(sessionState)]
        );
        const sessionId = sessionRes.rows[0].id;
        createdIds.sessions.push(sessionId);

        // TEST 1: Patient attempting to access Doctor Queue (RBAC Guard Check)
        console.log("\n[TEST 1] Patient attempting to access /api/doctor/queue (expected 403 Forbidden)...");
        const rbacRes = await request("GET", "/api/doctor/queue", null, patientToken);
        console.log(`Status: ${rbacRes.status}`);
        if (rbacRes.status !== 403) {
            throw new Error(`Expected 403 for unauthorized role, got ${rbacRes.status}`);
        }
        console.log("✅ [TEST 1 PASSED] RBAC properly denied patient access to doctor queue.");

        // TEST 2: Doctor Fetching Appointment & Triage Queue
        console.log("\n[TEST 2] Doctor fetching appointment & triage queue...");
        const queueRes = await request("GET", "/api/doctor/queue", null, doctorToken);
        console.log(`Status: ${queueRes.status}, Queue length: ${queueRes.body.queue?.length}`);
        if (queueRes.status !== 200 || queueRes.body.queue.length === 0) {
            throw new Error(`Failed to fetch doctor queue: ${JSON.stringify(queueRes.body)}`);
        }
        const queueItem = queueRes.body.queue[0];
        console.log("Queue Item Red Flags:", queueItem.intake?.redFlags);
        if (queueItem.intake.redFlags.length === 0) {
            throw new Error("Red flags missing from queue payload.");
        }
        console.log("✅ [TEST 2 PASSED] Doctor queue retrieved with triage red flags.");

        // TEST 3: Fetch Unified Patient History
        console.log("\n[TEST 3] Doctor fetching unified patient history...");
        const historyRes = await request("GET", `/api/doctor/patient/${patient.id}/unified-history`, null, doctorToken);
        console.log(`Status: ${historyRes.status}`, historyRes.body.unifiedHistory?.patient?.first_name);
        if (historyRes.status !== 200 || !historyRes.body.unifiedHistory?.medicalHistory) {
            throw new Error(`Failed to fetch unified history: ${JSON.stringify(historyRes.body)}`);
        }
        console.log("✅ [TEST 3 PASSED] Unified patient history aggregated.");

        // TEST 4: Doctor Confirming Consultation
        console.log("\n[TEST 4] Doctor confirming consultation notes & diagnosis...");
        const confirmRes = await request("POST", `/api/doctor/consultations/${appointmentId}/confirm`, {
            chiefComplaint: "Palpitations and dizziness",
            clinicalNotes: "Patient presented with sinus tachycardia. ECG performed showing HR 110 bpm.",
            diagnosis: "Sinus Tachycardia secondary to anxiety and mild dehydration",
            treatmentNotes: "Advised oral rehydration and Metoprolol 25mg OD for 3 days. Review in 1 week.",
        }, doctorToken);

        console.log(`Status: ${confirmRes.status}`, confirmRes.body);
        if (confirmRes.status !== 200 || !confirmRes.body.consultation?.id) {
            throw new Error(`Failed to confirm consultation: ${JSON.stringify(confirmRes.body)}`);
        }
        createdIds.consultations.push(confirmRes.body.consultation.id);
        console.log("✅ [TEST 4 PASSED] Doctor consultation confirmed and finalized.");

        console.log("\n🎉 ALL DOCTOR QUEUE & CONSULTATION INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");
    } catch (err) {
        console.error("❌ Test failed:", err.message);
        process.exitCode = 1;
    } finally {
        for (const consId of createdIds.consultations) {
            await pool.query(`DELETE FROM consultations WHERE id = $1`, [consId]).catch(() => {});
        }
        for (const sessId of createdIds.sessions) {
            await pool.query(`DELETE FROM clinical_sessions WHERE id = $1`, [sessId]).catch(() => {});
        }
        for (const apptId of createdIds.appointments) {
            await pool.query(`DELETE FROM appointments WHERE id = $1`, [apptId]).catch(() => {});
        }
        for (const userId of createdIds.users) {
            await pool.query(`DELETE FROM medical_history WHERE user_id = $1`, [userId]).catch(() => {});
            await pool.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => {});
        }
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runDoctorConsultationTests().then(() => process.exit(process.exitCode || 0));
}

module.exports = runDoctorConsultationTests;
