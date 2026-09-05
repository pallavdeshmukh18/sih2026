require("dotenv").config();
const http = require("http");
const pool = require("../config/db");
const app = require("../server");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runPatientRegressionTests() {
    console.log("=== STARTING PATIENT AUTHENTICATION REGRESSION TESTS ===");

    const baseUrl = `http://localhost:5001`;
    console.log(`Testing target URL: ${baseUrl}`);

    async function request(method, path, body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, baseUrl);
            const reqHeaders = { "Content-Type": "application/json", ...headers };
            const req = http.request(url, { method, headers: reqHeaders }, (res) => {
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

    try {
        const timestamp = Date.now();
        const testPatientEmail = `patient_regress_${timestamp}@example.com`;
        const testPatientPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

        const userInsert = await pool.query(
            `INSERT INTO users (first_name, last_name, email, phone, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'phone', 'patient', true)
             RETURNING id, role, email;`,
            ["PatientRegress", "User", testPatientEmail, testPatientPhone]
        );
        const patient = userInsert.rows[0];

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, '1995-05-15', 'F');`,
            [patient.id]
        );

        const patientToken = jwt.sign(
            { sub: patient.id, role: patient.role },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // TEST 1: GET /api/auth/me with Patient Token -> 200 OK
        console.log("\n[Regression Test 1] GET /api/auth/me with Patient Token");
        const res1 = await request("GET", "/api/auth/me", null, {
            Authorization: `Bearer ${patientToken}`,
        });
        console.log(`Response status: ${res1.status}`, res1.body);
        if (res1.status !== 200 || res1.body.user?.role !== "patient") {
            throw new Error(`Expected 200 OK for patient /api/auth/me, got ${res1.status}`);
        }

        // TEST 2: Patient Login Phone request -> returns OTP verificationId (Mock)
        console.log("\n[Regression Test 2] POST /api/auth/patient/login/phone");
        const res2 = await request("POST", "/api/auth/patient/login/phone", {
            phone: testPatientPhone,
        });
        console.log(`Response status: ${res2.status}`, res2.body);
        if (res2.status !== 200 || !res2.body.verificationId) {
            throw new Error(`Expected 200 OK for phone login request, got ${res2.status}`);
        }

        // Clean up test data
        await pool.query(`DELETE FROM users WHERE id = $1;`, [patient.id]);
        console.log("\nCleaned up regression test user from database.");

        console.log("\n✅ ALL PATIENT AUTHENTICATION REGRESSION TESTS PASSED!");
    } catch (err) {
        console.error("\n❌ REGRESSION TEST FAILURE:", err);
        process.exitCode = 1;
    } finally {
        await pool.end();
        process.exit(process.exitCode || 0);
    }
}

runPatientRegressionTests();
