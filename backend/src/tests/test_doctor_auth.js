require("dotenv").config();
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runDoctorAuthTests() {
    console.log("=== STARTING DOCTOR AUTHENTICATION INTEGRATION TESTS ===");

    const baseUrl = `http://localhost:5001`;
    console.log(`Testing target URL: ${baseUrl}`);

    // Helper HTTP request function
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

    const createdUserIds = [];

    try {
        const defaultPassword = "SecureDoctorPassword123!";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const timestamp = Date.now();

        // 1. Setup Valid Verified Doctor
        const verifiedDoctorEmail = `doctor_verified_${timestamp}@example.com`;
        const docInsert1 = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', true)
             RETURNING id;`,
            ["DrJane", "Doe", verifiedDoctorEmail, passwordHash]
        );
        const doc1Id = docInsert1.rows[0].id;
        createdUserIds.push(doc1Id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status, verified_at)
             VALUES ($1, $2, 'Cardiology', 'Cardiology', 'verified', CURRENT_TIMESTAMP);`,
            [doc1Id, `REG_DOC1_${timestamp}`]
        );

        // 2. Setup Pending Doctor
        const pendingDoctorEmail = `doctor_pending_${timestamp}@example.com`;
        const docInsert2 = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', true)
             RETURNING id;`,
            ["DrPending", "Smith", pendingDoctorEmail, passwordHash]
        );
        const doc2Id = docInsert2.rows[0].id;
        createdUserIds.push(doc2Id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, $2, 'Neurology', 'Neurology', 'pending');`,
            [doc2Id, `REG_DOC2_${timestamp}`]
        );

        // 3. Setup Rejected Doctor
        const rejectedDoctorEmail = `doctor_rejected_${timestamp}@example.com`;
        const docInsert3 = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', true)
             RETURNING id;`,
            ["DrRejected", "Jones", rejectedDoctorEmail, passwordHash]
        );
        const doc3Id = docInsert3.rows[0].id;
        createdUserIds.push(doc3Id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
             VALUES ($1, $2, 'Pediatrics', 'Pediatrics', 'rejected');`,
            [doc3Id, `REG_DOC3_${timestamp}`]
        );

        // 4. Setup Inactive Doctor
        const inactiveDoctorEmail = `doctor_inactive_${timestamp}@example.com`;
        const docInsert4 = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', false)
             RETURNING id;`,
            ["DrInactive", "Brown", inactiveDoctorEmail, passwordHash]
        );
        const doc4Id = docInsert4.rows[0].id;
        createdUserIds.push(doc4Id);

        await pool.query(
            `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status, verified_at)
             VALUES ($1, $2, 'Orthopedics', 'Orthopedics', 'verified', CURRENT_TIMESTAMP);`,
            [doc4Id, `REG_DOC4_${timestamp}`]
        );

        // 5. Setup Doctor Profile Missing
        const noProfileDoctorEmail = `doctor_noprofile_${timestamp}@example.com`;
        const docInsert5 = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'doctor', true)
             RETURNING id;`,
            ["DrNoProfile", "Taylor", noProfileDoctorEmail, passwordHash]
        );
        const doc5Id = docInsert5.rows[0].id;
        createdUserIds.push(doc5Id);

        // 6. Setup Patient User
        const patientEmail = `patient_test_${timestamp}@example.com`;
        const patientInsert = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, login_method, role, is_active)
             VALUES ($1, $2, $3, $4, 'email', 'patient', true)
             RETURNING id;`,
            ["Patient", "User", patientEmail, passwordHash]
        );
        const patientId = patientInsert.rows[0].id;
        createdUserIds.push(patientId);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, '1990-01-01', 'M');`,
            [patientId]
        );

        // TEST 1: Valid verified doctor + correct password -> 200 + JWT
        console.log("\n[Test 1] Valid verified doctor login with correct password");
        const res1 = await request("POST", "/api/auth/doctor/login", {
            email: verifiedDoctorEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res1.status}`, res1.body);
        if (res1.status !== 200 || !res1.body.token || !res1.body.user) {
            throw new Error(`Expected 200 OK with token and user object, got ${res1.status}`);
        }

        // Validate JWT token contents
        const decodedToken = jwt.verify(res1.body.token, JWT_SECRET);
        console.log("Decoded JWT payload:", decodedToken);
        if (decodedToken.sub !== doc1Id || decodedToken.role !== "doctor") {
            throw new Error(`JWT payload mismatch. Expected sub=${doc1Id}, role=doctor. Got: ${JSON.stringify(decodedToken)}`);
        }
        if (decodedToken.email || decodedToken.password || decodedToken.verification_status) {
            throw new Error("JWT payload contains extra unauthorized fields!");
        }

        // Validate response structure (no password or hash returned)
        const responseStr = JSON.stringify(res1.body);
        if (responseStr.includes("password") || responseStr.includes("hash")) {
            throw new Error("Response body contains sensitive password or hash fields!");
        }
        if (res1.body.user.role !== "doctor" || res1.body.user.loginMethod !== "email") {
            throw new Error("User object fields do not match expected role/loginMethod!");
        }

        // TEST 2: Wrong password -> 401
        console.log("\n[Test 2] Doctor login with wrong password");
        const res2 = await request("POST", "/api/auth/doctor/login", {
            email: verifiedDoctorEmail,
            password: "WrongPassword123!",
        });
        console.log(`Response status: ${res2.status}`);
        if (res2.status !== 401) throw new Error(`Expected 401, got ${res2.status}`);

        // TEST 3: Nonexistent email -> 401
        console.log("\n[Test 3] Doctor login with nonexistent email");
        const res3 = await request("POST", "/api/auth/doctor/login", {
            email: `nonexistent_${timestamp}@example.com`,
            password: defaultPassword,
        });
        console.log(`Response status: ${res3.status}`);
        if (res3.status !== 401) throw new Error(`Expected 401, got ${res3.status}`);

        // TEST 4: Patient email/password sent to doctor login -> 401 (rejected)
        console.log("\n[Test 4] Patient credentials sent to doctor login endpoint");
        const res4 = await request("POST", "/api/auth/doctor/login", {
            email: patientEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res4.status}`);
        if (res4.status !== 401) throw new Error(`Expected 401, got ${res4.status}`);

        // TEST 5: Doctor with pending verification -> 403 (rejected)
        console.log("\n[Test 5] Pending doctor login");
        const res5 = await request("POST", "/api/auth/doctor/login", {
            email: pendingDoctorEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res5.status}`);
        if (res5.status !== 403) throw new Error(`Expected 403, got ${res5.status}`);

        // TEST 6: Doctor with rejected verification -> 403 (rejected)
        console.log("\n[Test 6] Rejected doctor login");
        const res6 = await request("POST", "/api/auth/doctor/login", {
            email: rejectedDoctorEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res6.status}`);
        if (res6.status !== 403) throw new Error(`Expected 403, got ${res6.status}`);

        // TEST 7: Inactive doctor -> 403 (rejected)
        console.log("\n[Test 7] Inactive doctor login");
        const res7 = await request("POST", "/api/auth/doctor/login", {
            email: inactiveDoctorEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res7.status}`);
        if (res7.status !== 403) throw new Error(`Expected 403, got ${res7.status}`);

        // TEST 8: Doctor profile missing -> 403 (rejected)
        console.log("\n[Test 8] Doctor login with missing profile");
        const res8 = await request("POST", "/api/auth/doctor/login", {
            email: noProfileDoctorEmail,
            password: defaultPassword,
        });
        console.log(`Response status: ${res8.status}`);
        if (res8.status !== 403) throw new Error(`Expected 403, got ${res8.status}`);

        // TEST 9: Authenticated GET /api/auth/me using Doctor Token
        console.log("\n[Test 9] GET /api/auth/me with Doctor Bearer Token");
        const res9 = await request("GET", "/api/auth/me", null, {
            Authorization: `Bearer ${res1.body.token}`,
        });
        console.log(`Response status: ${res9.status}`, res9.body);
        if (res9.status !== 200 || res9.body.user?.role !== "doctor") {
            throw new Error(`Expected 200 OK with doctor info, got ${res9.status}`);
        }

        console.log("\n✅ ALL DOCTOR AUTHENTICATION TESTS PASSED PERFECTLY!");
    } catch (err) {
        console.error("\n❌ TEST FAILURE:", err);
        process.exitCode = 1;
    } finally {
        if (createdUserIds.length > 0) {
            await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[]);`, [createdUserIds]);
            console.log("Cleaned up test users from database.");
        }
        await pool.end();
        process.exit(process.exitCode || 0);
    }
}

runDoctorAuthTests();
