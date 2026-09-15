require("dotenv").config();
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runDoctorReviewTests() {
    console.log("=== STARTING DOCTOR PROFILE & REVIEW INTEGRATION TESTS ===");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

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

    const createdUserIds = [];

    try {
        const passwordHash = await bcrypt.hash("TestDoctorPassword123!", 10);
        const timestamp = Date.now();

        // 1. Create Doctor
        const docRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', true)
             RETURNING id;`,
            ["DrRajesh", "Verma", `dr_rajesh_${timestamp}@example.com`, passwordHash]
        );
        const doctorId = docRes.rows[0].id;
        createdUserIds.push(doctorId);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status, verified_at)
             VALUES ($1, $2, 'Cardiology', 'Cardiology', 'verified', CURRENT_TIMESTAMP);`,
            [doctorId, `MCI-CARDIO-${timestamp}`]
        );

        const doctorToken = jwt.sign({ sub: doctorId, role: "doctor" }, JWT_SECRET, { expiresIn: "1h" });

        // 2. Create Patient
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'patient', true)
             RETURNING id;`,
            ["Ananya", "Sharma", `ananya_${timestamp}@example.com`, passwordHash]
        );
        const patientId = patientRes.rows[0].id;
        createdUserIds.push(patientId);

        await pool.query(`INSERT INTO patient_profiles (user_id) VALUES ($1);`, [patientId]);
        const patientToken = jwt.sign({ sub: patientId, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // 3. Create Completed In-Person Appointment
        const apptRes = await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, appointment_type, status, reason)
             VALUES ($1, $2, NOW() - INTERVAL '1 day', 30, 'in_person', 'completed', 'Chest pain consultation')
             RETURNING id;`,
            [patientId, doctorId]
        );
        const appointmentId = apptRes.rows[0].id;

        // 4. Test Doctor Updating Own Profile (including department)
        console.log("-> Test: Doctor Updating Own Profile (specialization, department)...");
        const updateRes = await request("PATCH", "/api/doctor/profile", {
            firstName: "Dr Rajesh",
            lastName: "Verma",
            email: `dr_rajesh_${timestamp}@example.com`,
            registrationNumber: `MCI-CARDIO-UPDATED-${timestamp}`,
            specialization: "Interventional Cardiology",
            department: "Cardiovascular Sciences"
        }, doctorToken);

        if (updateRes.status !== 200 || !updateRes.body.success) {
            throw new Error(`Doctor profile update failed: ${JSON.stringify(updateRes.body)}`);
        }
        console.log("✅ Doctor profile updated successfully.");

        // 5. Test Patient Submitting Review for Appointment
        console.log("-> Test: Patient Submitting 5-Star Review for Appointment...");
        const reviewSubmitRes = await request("POST", `/api/doctor/${doctorId}/reviews`, {
            appointmentId,
            rating: 5,
            reviewTitle: "Outstanding cardiology consultation",
            reviewText: "Dr. Verma took the time to explain my ECG and cardiac tests in great detail. Very reassuring and thorough.",
            consultationType: "in_person"
        }, patientToken);

        if (reviewSubmitRes.status !== 201 || !reviewSubmitRes.body.success) {
            throw new Error(`Review submission failed: ${JSON.stringify(reviewSubmitRes.body)}`);
        }
        console.log("✅ Patient review submitted successfully.");

        // 6. Test Duplicate Review Prevention
        console.log("-> Test: Duplicate Review Prevention on same appointment...");
        const dupRes = await request("POST", `/api/doctor/${doctorId}/reviews`, {
            appointmentId,
            rating: 4,
            reviewTitle: "Another review",
            reviewText: "Duplicate attempt",
            consultationType: "in_person"
        }, patientToken);

        if (dupRes.status !== 409) {
            throw new Error(`Duplicate review should return 409 Conflict, got ${dupRes.status}`);
        }
        console.log("✅ Duplicate review correctly prevented with 409 Conflict.");

        // 7. Test Fetch Doctor Public Reviews
        console.log("-> Test: Fetch Doctor Public Reviews & Rating Summary...");
        const pubReviewsRes = await request("GET", `/api/doctor/${doctorId}/reviews`, null, patientToken);
        if (pubReviewsRes.status !== 200 || !pubReviewsRes.body.success) {
            throw new Error(`Fetch doctor reviews failed: ${JSON.stringify(pubReviewsRes.body)}`);
        }
        if (pubReviewsRes.body.totalReviews !== 1 || pubReviewsRes.body.averageRating !== 5.0) {
            throw new Error(`Incorrect rating calculation: ${JSON.stringify(pubReviewsRes.body)}`);
        }
        console.log("✅ Doctor reviews and average rating verified (5.0 stars, 1 review).");

        // 8. Test Doctor Viewing Own Reviews
        console.log("-> Test: Doctor Viewing Own Reviews (/api/doctor/reviews/me)...");
        const docReviewsRes = await request("GET", "/api/doctor/reviews/me", null, doctorToken);
        if (docReviewsRes.status !== 200 || !docReviewsRes.body.success) {
            throw new Error(`Doctor fetching own reviews failed: ${JSON.stringify(docReviewsRes.body)}`);
        }
        if (docReviewsRes.body.reviews.length !== 1 || docReviewsRes.body.reviews[0].reviewTitle !== "Outstanding cardiology consultation") {
            throw new Error(`Doctor own reviews data mismatch: ${JSON.stringify(docReviewsRes.body)}`);
        }
        console.log("✅ Doctor successfully retrieved their own patient reviews.");

        // 9. Test Patient Viewing Their Submitted Reviews
        console.log("-> Test: Patient Viewing Submitted Reviews (/api/doctor/reviews/my-submissions)...");
        const mySubmissionsRes = await request("GET", "/api/doctor/reviews/my-submissions", null, patientToken);
        if (mySubmissionsRes.status !== 200 || !mySubmissionsRes.body.success) {
            throw new Error(`Patient my-submissions failed: ${JSON.stringify(mySubmissionsRes.body)}`);
        }
        if (mySubmissionsRes.body.reviews.length !== 1) {
            throw new Error(`Patient my-submissions mismatch: ${JSON.stringify(mySubmissionsRes.body)}`);
        }
        console.log("✅ Patient successfully retrieved their submitted reviews.");

        console.log("=== ALL DOCTOR PROFILE & REVIEW TESTS PASSED SUCCESSFULLY! ===");
    } finally {
        if (createdUserIds.length > 0) {
            await pool.query(`DELETE FROM doctor_reviews WHERE patient_id = ANY($1::uuid[]) OR doctor_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
            await pool.query(`DELETE FROM appointments WHERE patient_id = ANY($1::uuid[]) OR doctor_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
            await pool.query(`DELETE FROM patient_profiles WHERE user_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
            await pool.query(`DELETE FROM doctor_profiles WHERE user_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
            await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
        }
        server.close();
    }
}

runDoctorReviewTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Test error:", err);
        process.exit(1);
    });
