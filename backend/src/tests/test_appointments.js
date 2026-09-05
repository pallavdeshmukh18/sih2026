require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runAppointmentTests() {
    console.log("=== STARTING APPOINTMENT INTEGRATION TESTS ===");

    let server;
    const PORT = 5098;
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

    const createdIds = { users: [], appointments: [] };

    try {
        const timestamp = Date.now();

        // 1. Setup Patient
        const patientEmail = `patient_appt_${timestamp}@example.com`;
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('John', 'Doe', $1, 'email', 'patient', true)
             RETURNING id, role;`,
            [patientEmail]
        );
        const patient = patientRes.rows[0];
        createdIds.users.push(patient.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, '1990-01-01', 'male');`,
            [patient.id]
        );

        const patientToken = jwt.sign({ sub: patient.id, role: patient.role }, JWT_SECRET, { expiresIn: "1h" });

        // 2. Setup Doctor
        const doctorEmail = `doctor_appt_${timestamp}@example.com`;
        const docRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Dr. Sarah', 'Smith', $1, 'email', 'doctor', true)
             RETURNING id, role;`,
            [doctorEmail]
        );
        const doctor = docRes.rows[0];
        createdIds.users.push(doctor.id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, 'REG_${timestamp}', 'Cardiology', 'Cardiology Dept', 'verified');`,
            [doctor.id]
        );

        // TEST 1: Create Appointment
        console.log("\n[TEST 1] Booking a new appointment...");
        const scheduledTime = new Date(Date.now() + 86400000).toISOString();
        const createRes = await request("POST", "/api/appointments", {
            doctorId: doctor.id,
            scheduledAt: scheduledTime,
            reason: "Chest discomfort and breathing trouble",
            appointmentType: "in_person",
        }, patientToken);

        console.log(`Status: ${createRes.status}`, createRes.body);
        if (createRes.status !== 201 || !createRes.body.appointment?.id) {
            throw new Error(`Failed to create appointment: ${JSON.stringify(createRes.body)}`);
        }
        const appointmentId = createRes.body.appointment.id;
        createdIds.appointments.push(appointmentId);
        console.log("✅ [TEST 1 PASSED] Appointment created successfully.");

        // TEST 2: List Patient Appointments
        console.log("\n[TEST 2] Fetching patient appointments list...");
        const listRes = await request("GET", "/api/appointments/patient", null, patientToken);
        console.log(`Status: ${listRes.status}, Count: ${listRes.body.appointments?.length}`);
        if (listRes.status !== 200 || listRes.body.appointments.length === 0) {
            throw new Error(`Failed to list patient appointments: ${JSON.stringify(listRes.body)}`);
        }
        console.log("✅ [TEST 2 PASSED] Patient appointment list fetched.");

        // TEST 3: Get Appointment Details by ID
        console.log("\n[TEST 3] Fetching appointment details by ID...");
        const detailRes = await request("GET", `/api/appointments/${appointmentId}`, null, patientToken);
        console.log(`Status: ${detailRes.status}`);
        if (detailRes.status !== 200 || detailRes.body.appointment?.id !== appointmentId) {
            throw new Error(`Failed to fetch appointment details: ${JSON.stringify(detailRes.body)}`);
        }
        console.log("✅ [TEST 3 PASSED] Appointment details verified.");

        // TEST 4: Update Appointment Status
        console.log("\n[TEST 4] Updating appointment status to 'confirmed'...");
        const statusRes = await request("PATCH", `/api/appointments/${appointmentId}/status`, {
            status: "confirmed",
        }, patientToken);
        console.log(`Status: ${statusRes.status}, New Status: ${statusRes.body.appointment?.status}`);
        if (statusRes.status !== 200 || statusRes.body.appointment?.status !== "confirmed") {
            throw new Error(`Failed to update appointment status: ${JSON.stringify(statusRes.body)}`);
        }
        console.log("✅ [TEST 4 PASSED] Status update confirmed.");

        console.log("\n🎉 ALL APPOINTMENT INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");
    } catch (err) {
        console.error("❌ Test failed:", err.message);
        process.exitCode = 1;
    } finally {
        // Cleanup created records
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
    runAppointmentTests().then(() => process.exit(process.exitCode || 0));
}

module.exports = runAppointmentTests;
