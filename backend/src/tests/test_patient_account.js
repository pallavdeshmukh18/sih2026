require("dotenv").config();
const http = require("http");
const pool = require("../config/db");
const app = require("../server");

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port: 5099,
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
    console.log("=== STARTING PATIENT ACCOUNT & PROFILE INTEGRATION TESTS ===");
    
    const server = app.listen(5099);
    await new Promise((res) => setTimeout(res, 800));
    console.log("Test server running on port 5099");

    const testEmail1 = `acct_test1_${Date.now()}@example.com`;
    const testEmail2 = `acct_test2_${Date.now()}@example.com`;
    const testPhone1 = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    let token1, token2, user1Id, user2Id;

    try {
        // Setup Test Patient 1 (Google/Email signup without phone)
        const user1Res = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('AccountTest', 'User1', $1, 'email', 'patient', true)
             RETURNING id;`,
            [testEmail1]
        );
        user1Id = user1Res.rows[0].id;
        await pool.query(
            `INSERT INTO patient_profiles (user_id, state, preferred_language, interaction_mode, accessibility_preference)
             VALUES ($1, 'Maharashtra', 'mr', 'voice_touch', 'none');`,
            [user1Id]
        );

        // Setup Test Patient 2
        const user2Res = await pool.query(
            `INSERT INTO users (first_name, last_name, email, phone, login_method, role, is_active)
             VALUES ('AccountTest', 'User2', $1, $2, 'phone', 'patient', true)
             RETURNING id;`,
            [testEmail2, testPhone1]
        );
        user2Id = user2Res.rows[0].id;
        await pool.query(
            `INSERT INTO patient_profiles (user_id) VALUES ($1);`,
            [user2Id]
        );

        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";
        token1 = jwt.sign({ sub: user1Id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });
        token2 = jwt.sign({ sub: user2Id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // TEST 1: GET /api/auth/me returns real patient identity and phone status
        console.log("\n[TEST 1] GET /api/auth/me for Patient 1");
        const res1 = await request("GET", "/api/auth/me", null, { Authorization: `Bearer ${token1}` });
        if (res1.status !== 200 || !res1.body.user || res1.body.user.email !== testEmail1) {
            throw new Error(`Test 1 failed: Expected 200 with email ${testEmail1}, got ${res1.status} ${JSON.stringify(res1.body)}`);
        }
        if (res1.body.user.phoneVerified !== false) {
            throw new Error("Test 1 failed: User 1 without phone should have phoneVerified = false");
        }
        console.log("✅ [TEST 1 PASSED] /api/auth/me returned real patient profile.");

        // TEST 2: Unauthenticated request rejected with 401
        console.log("\n[TEST 2] GET /api/auth/me without token");
        const res2 = await request("GET", "/api/auth/me");
        if (res2.status !== 401) {
            throw new Error(`Test 2 failed: Expected 401, got ${res2.status}`);
        }
        console.log("✅ [TEST 2 PASSED] Unauthenticated access blocked.");

        // TEST 3: Request Phone Linking OTP for Patient 1
        console.log("\n[TEST 3] POST /api/auth/patient/link-phone/request");
        const targetLinkPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
        const res3 = await request("POST", "/api/auth/patient/link-phone/request", { phone: targetLinkPhone }, { Authorization: `Bearer ${token1}` });
        if (res3.status !== 200 || !res3.body.verificationId) {
            throw new Error(`Test 3 failed: Expected 200 with verificationId, got ${res3.status} ${JSON.stringify(res3.body)}`);
        }
        const verificationId = res3.body.verificationId;
        const mockOtp = res3.body.mockOtp || "123456";
        console.log(`✅ [TEST 3 PASSED] Phone OTP requested. VerificationId: ${verificationId}`);

        // TEST 4: Invalid OTP verification rejected
        console.log("\n[TEST 4] POST /api/auth/patient/link-phone/verify with wrong OTP");
        const res4 = await request("POST", "/api/auth/patient/link-phone/verify", { verificationId, otp: "000000" }, { Authorization: `Bearer ${token1}` });
        if (res4.status !== 400) {
            throw new Error(`Test 4 failed: Expected 400 for wrong OTP, got ${res4.status}`);
        }
        console.log("✅ [TEST 4 PASSED] Invalid OTP rejected.");

        // TEST 5: Valid OTP verification links phone to Patient 1
        console.log("\n[TEST 5] POST /api/auth/patient/link-phone/verify with valid OTP");
        // Create a local dev_mock OTP record to ensure deterministic test verification regardless of 2factor key presence
        const { hashOTP } = require("../services/otpService");
        const testOtp = "123456";
        const testHash = hashOTP(testOtp);
        const insertMockRes = await pool.query(
            `INSERT INTO otp_verifications (phone, identifier_type, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'phone', 'phone_link', $2, $3, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [targetLinkPhone, testHash, JSON.stringify({ provider: "dev_mock", userId: user1Id })]
        );
        const testVerificationId = insertMockRes.rows[0].id;

        const res5 = await request("POST", "/api/auth/patient/link-phone/verify", { verificationId: testVerificationId, otp: testOtp }, { Authorization: `Bearer ${token1}` });
        if (res5.status !== 200 || !res5.body.success) {
            throw new Error(`Test 5 failed: Expected 200 OK, got ${res5.status} ${JSON.stringify(res5.body)}`);
        }
        console.log("✅ [TEST 5 PASSED] Phone linked successfully.");

        // TEST 6: Re-query GET /api/auth/me to verify phone is updated and verified
        console.log("\n[TEST 6] Re-fetching GET /api/auth/me for Patient 1");
        const res6 = await request("GET", "/api/auth/me", null, { Authorization: `Bearer ${token1}` });
        if (res6.body.user.phone !== targetLinkPhone || !res6.body.user.phoneVerified) {
            throw new Error(`Test 6 failed: Expected phone ${targetLinkPhone} and phoneVerified true, got ${JSON.stringify(res6.body.user)}`);
        }
        console.log("✅ [TEST 6 PASSED] Authenticated profile reflects newly linked phone number.");

        // TEST 7: Update patient personal profile & onboarding preferences
        console.log("\n[TEST 7] PATCH /api/patient/profile");
        const res7 = await request("PATCH", "/api/patient/profile", {
            firstName: "PallavUpdated",
            lastName: "DeshmukhUpdated",
            state: "Gujarat",
            preferredLanguage: "gu",
            interactionMode: "voice",
            accessibilityPreference: "large_text"
        }, { Authorization: `Bearer ${token1}` });
        if (res7.status !== 200 || !res7.body.success) {
            throw new Error(`Test 7 failed: Expected 200 OK, got ${res7.status} ${JSON.stringify(res7.body)}`);
        }
        console.log("✅ [TEST 7 PASSED] Patient profile updated.");

        // TEST 8: Verify profile update is scoped to Patient 1 and doesn't affect Patient 2
        console.log("\n[TEST 8] GET /api/auth/me for Patient 2 to check isolation");
        const res8 = await request("GET", "/api/auth/me", null, { Authorization: `Bearer ${token2}` });
        if (res8.body.user.firstName === "PallavUpdated") {
            throw new Error("Test 8 failed: Patient 1 update bled into Patient 2 profile!");
        }
        console.log("✅ [TEST 8 PASSED] Patient profiles are strictly isolated per user ID.");

        console.log("\n🎉 ALL PATIENT ACCOUNT INTEGRATION TESTS PASSED 100%! 🎉");
    } catch (err) {
        console.error("❌ Test suite error:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        if (user1Id) await pool.query("DELETE FROM users WHERE id = $1;", [user1Id]);
        if (user2Id) await pool.query("DELETE FROM users WHERE id = $1;", [user2Id]);
        pool.end();
    }
}

runTests();
