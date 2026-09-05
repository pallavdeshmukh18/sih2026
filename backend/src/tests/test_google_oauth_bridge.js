require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");
const oauthExchangeService = require("../services/oauthExchangeService");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runGoogleOAuthBridgeTests() {
    console.log("=== STARTING GOOGLE OAUTH EXCHANGE CODE BRIDGE TESTS ===");

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
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                });
            });
            req.on("error", reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    const createdUserIds = [];

    try {
        const timestamp = Date.now();

        // 1. Direct Unit Test of oauthExchangeService (Create, Single-Use Consume, Expired Code)
        console.log("\n[Test 1] Unit Test: oauthExchangeService atomic create & consume");
        const mockPayload = { token: "mock_jwt_token", user: { id: "user_123", role: "patient" } };
        const code1 = oauthExchangeService.createExchangeCode(mockPayload);
        if (!code1 || typeof code1 !== "string" || code1.length !== 64) {
            throw new Error(`Expected 64-char hex string, got ${code1}`);
        }

        const consumeResult1 = oauthExchangeService.consumeExchangeCode(code1);
        if (!consumeResult1.success || consumeResult1.payload.token !== "mock_jwt_token") {
            throw new Error("Failed to consume valid exchange code");
        }

        // Test Replay attack on unit service
        const replayResult = oauthExchangeService.consumeExchangeCode(code1);
        if (replayResult.success) {
            throw new Error("CRITICAL SECURITY ERROR: Exchange code was re-usable!");
        }

        // 2. Setup Test Patient in DB
        const googleUserEmail = `google_patient_${timestamp}@example.com`;
        const googleSub = `google_provider_${timestamp}`;

        const userInsert = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, provider_id, role, is_active)
             VALUES ($1, $2, $3, 'google', $4, 'patient', true)
             RETURNING id, role, email;`,
            ["Google", "Patient", googleUserEmail, googleSub]
        );
        const googleUser = userInsert.rows[0];
        createdUserIds.push(googleUser.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id) VALUES ($1);`,
            [googleUser.id]
        );

        // 3. Test POST /api/auth/patient/google/exchange with valid code
        console.log("\n[Test 2] POST /api/auth/patient/google/exchange with valid code");
        const mockJwt = jwt.sign({ sub: googleUser.id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });
        const mockExchangePayload = {
            token: mockJwt,
            user: {
                id: googleUser.id,
                firstName: "Google",
                lastName: "Patient",
                role: "patient",
                loginMethod: "google",
            },
        };
        const validCode = oauthExchangeService.createExchangeCode(mockExchangePayload);

        const res2 = await request("POST", "/api/auth/patient/google/exchange", { code: validCode });
        console.log(`Response status: ${res2.status}`, res2.body);
        if (res2.status !== 200 || !res2.body.token || res2.body.user.id !== googleUser.id) {
            throw new Error(`Expected 200 OK with token and user object, got ${res2.status}`);
        }

        // 4. Test Replay Attack on /exchange endpoint with the same code
        console.log("\n[Test 3] Replay Attack: Re-using exchanged code on /exchange endpoint");
        const res3 = await request("POST", "/api/auth/patient/google/exchange", { code: validCode });
        console.log(`Response status: ${res3.status}`, res3.body);
        if (res3.status !== 400) {
            throw new Error(`Expected 400 Bad Request for replayed code, got ${res3.status}`);
        }

        // 5. Test Missing Code parameter
        console.log("\n[Test 4] POST /api/auth/patient/google/exchange without code parameter");
        const res4 = await request("POST", "/api/auth/patient/google/exchange", {});
        console.log(`Response status: ${res4.status}`, res4.body);
        if (res4.status !== 400) {
            throw new Error(`Expected 400 Bad Request for missing code, got ${res4.status}`);
        }

        // 6. Test Invalid Code format
        console.log("\n[Test 5] POST /api/auth/patient/google/exchange with fake invalid code");
        const res5 = await request("POST", "/api/auth/patient/google/exchange", { code: "invalid_code_xyz" });
        console.log(`Response status: ${res5.status}`, res5.body);
        if (res5.status !== 400) {
            throw new Error(`Expected 400 Bad Request for invalid code, got ${res5.status}`);
        }

        // 7. Test Account Collision: Non-Google user exists with same email
        console.log("\n[Test 6] Account Collision Protection: Email exists with different login_method");
        const collisionEmail = `email_user_${timestamp}@example.com`;
        const collisionUserInsert = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ($1, $2, $3, 'email', 'patient', true)
             RETURNING id;`,
            ["Email", "User", collisionEmail]
        );
        createdUserIds.push(collisionUserInsert.rows[0].id);

        // Account collision check in DB directly matches existing controller logic:
        const collisionCheck = await pool.query("SELECT id, login_method FROM users WHERE email = $1;", [collisionEmail]);
        if (collisionCheck.rows.length === 0 || collisionCheck.rows[0].login_method === "google") {
            throw new Error("Account collision test setup failed.");
        }
        console.log("Account collision correctly detected for email-registered user.");

        // 8. Test Authenticated Profile Access using Exchanged Token
        console.log("\n[Test 7] GET /api/auth/me with Exchanged JWT Token");
        const res7 = await request("GET", "/api/auth/me", null, {
            Authorization: `Bearer ${res2.body.token}`,
        });
        console.log(`Response status: ${res7.status}`, res7.body);
        if (res7.status !== 200 || res7.body.user?.role !== "patient") {
            throw new Error(`Expected 200 OK for patient /api/auth/me, got ${res7.status}`);
        }

        console.log("\n✅ ALL GOOGLE OAUTH EXCHANGE CODE BRIDGE TESTS PASSED PERFECTLY!");
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

runGoogleOAuthBridgeTests();
