require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";
const PORT = 5101;

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port: PORT,
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
    console.log("=== STARTING PATIENT MEDICAL HISTORY INTEGRATION TESTS ===");
    
    const server = app.listen(PORT);
    await new Promise((res) => setTimeout(res, 800));
    console.log(`Test server running on port ${PORT}`);

    const timestamp = Date.now();
    const testEmail1 = `hist_test1_${timestamp}@example.com`;
    const testEmail2 = `hist_test2_${timestamp}@example.com`;
    let token1, token2, user1Id, user2Id;

    try {
        // 1. Setup Patient 1
        const u1Res = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Ananya', 'Sharma', $1, 'email', 'patient', true)
             RETURNING id;`,
            [testEmail1]
        );
        user1Id = u1Res.rows[0].id;
        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender, state, preferred_language)
             VALUES ($1, '1992-08-20', 'female', 'Maharashtra', 'hi');`,
            [user1Id]
        );
        token1 = jwt.sign({ sub: user1Id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // 2. Setup Patient 2
        const u2Res = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Vikram', 'Rao', $1, 'email', 'patient', true)
             RETURNING id;`,
            [testEmail2]
        );
        user2Id = u2Res.rows[0].id;
        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender, state, preferred_language)
             VALUES ($1, '1985-03-12', 'male', 'Karnataka', 'en');`,
            [user2Id]
        );
        token2 = jwt.sign({ sub: user2Id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // 3. Populate Medical History for Patient 1
        await pool.query(
            `INSERT INTO medical_history (patient_id, category, condition, description, diagnosed_at, status)
             VALUES ($1, 'condition', 'Hypertension', 'Essential hypertension managed with lifestyle', '2023-05-10', 'active'),
                    ($1, 'allergy', 'Dust Mites', 'Allergic rhinitis and sneezing', '2022-01-15', 'active'),
                    ($1, 'surgery', 'Knee Arthroscopy', 'Right knee diagnostic arthroscopy', '2020-09-05', 'resolved');`,
            [user1Id]
        );

        // 4. TEST 1: Unauthenticated request should be rejected (401)
        console.log("\n[TEST 1] GET /api/patient/history without token");
        const res1 = await request("GET", "/api/patient/history");
        if (res1.status !== 401) {
            throw new Error(`Expected 401, got ${res1.status}`);
        }
        console.log("✅ [TEST 1 PASSED] Unauthenticated history access blocked.");

        // 5. TEST 2: Patient 1 retrieves history
        console.log("\n[TEST 2] GET /api/patient/history for Patient 1");
        const res2 = await request("GET", "/api/patient/history", null, { Authorization: `Bearer ${token1}` });
        if (res2.status !== 200 || !res2.body.success || !res2.body.history) {
            throw new Error(`Expected 200 with history payload, got ${res2.status}`);
        }
        const h1 = res2.body.history;
        console.log(`Patient Name: ${h1.patient.name}`);
        console.log(`Conditions count: ${h1.conditions.length}`);
        console.log(`Allergies count: ${h1.allergies.length}`);
        console.log(`Procedures count: ${h1.procedures.length}`);
        console.log(`Timeline count: ${h1.timeline.length}`);

        if (h1.patient.name !== "Ananya Sharma") {
            throw new Error(`Patient name mismatch: ${h1.patient.name}`);
        }
        if (h1.conditions.length !== 1 || h1.conditions[0].name !== "Hypertension") {
            throw new Error("Condition record mismatch");
        }
        if (h1.allergies.length !== 1 || h1.allergies[0].name !== "Dust Mites") {
            throw new Error("Allergy record mismatch");
        }
        if (h1.procedures.length !== 1 || h1.procedures[0].name !== "Knee Arthroscopy") {
            throw new Error("Procedure record mismatch");
        }
        console.log("✅ [TEST 2 PASSED] Patient 1 history correctly aggregated.");

        // 6. TEST 3: Strict Patient Isolation (Patient 2 history must be empty of Patient 1 data)
        console.log("\n[TEST 3] GET /api/patient/history for Patient 2 (Isolation Check)");
        const res3 = await request("GET", "/api/patient/history", null, { Authorization: `Bearer ${token2}` });
        if (res3.status !== 200 || !res3.body.success) {
            throw new Error(`Expected 200 for Patient 2, got ${res3.status}`);
        }
        const h2 = res3.body.history;
        if (h2.patient.name !== "Vikram Rao") {
            throw new Error(`Patient 2 name mismatch: ${h2.patient.name}`);
        }
        if (h2.conditions.length !== 0 || h2.allergies.length !== 0 || h2.procedures.length !== 0) {
            throw new Error("Isolation breach! Patient 2 received Patient 1 records.");
        }
        console.log("✅ [TEST 3 PASSED] Patient records strictly isolated by authenticated user ID.");

        console.log("\n🎉 ALL PATIENT MEDICAL HISTORY INTEGRATION TESTS PASSED 100%! 🎉");
    } catch (err) {
        console.error("❌ Test failed:", err);
        process.exitCode = 1;
    } finally {
        // Cleanup test data
        if (user1Id) {
            await pool.query("DELETE FROM medical_history WHERE patient_id = $1;", [user1Id]);
            await pool.query("DELETE FROM patient_profiles WHERE user_id = $1;", [user1Id]);
            await pool.query("DELETE FROM users WHERE id = $1;", [user1Id]);
        }
        if (user2Id) {
            await pool.query("DELETE FROM patient_profiles WHERE user_id = $1;", [user2Id]);
            await pool.query("DELETE FROM users WHERE id = $1;", [user2Id]);
        }
        server.close();
        pool.end();
    }
}

runTests();
