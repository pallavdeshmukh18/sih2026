require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

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
    console.log("=== STARTING WHATSAPP AUTHENTICATION & LINKING INTEGRATION TESTS ===");
    
    const server = app.listen(5098);
    await new Promise((res) => setTimeout(res, 800));
    console.log("Test server running on port 5098");

    const testEmail = `wa_test_${Date.now()}@example.com`;
    const testWhatsAppId = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    let userToken, userId;

    try {
        // Setup Test Patient User
        const userRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('WhatsAppTest', 'Patient', $1, 'email', 'patient', true)
             RETURNING id;`,
            [testEmail]
        );
        userId = userRes.rows[0].id;
        userToken = jwt.sign({ sub: userId, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

        // 1. Unlinked status check
        console.log("Test 1: Check link status for unlinked WhatsApp ID...");
        const statusUnlinked = await request("GET", `/api/auth/whatsapp/status?whatsapp_id=${encodeURIComponent(testWhatsAppId)}`);
        if (statusUnlinked.status !== 200 || statusUnlinked.body.linked !== false) {
            throw new Error(`Test 1 Failed: Expected linked: false, got ${JSON.stringify(statusUnlinked.body)}`);
        }
        console.log("✅ Test 1 Passed: Unlinked user returns linked: false");

        // 2. Link with invalid token fails
        console.log("Test 2: Attempt linking with invalid token...");
        const linkInvalid = await request("POST", "/api/auth/whatsapp/link", {
            whatsapp_id: testWhatsAppId,
            token: "INVALID_TOKEN_999",
        });
        if (linkInvalid.status !== 400 || linkInvalid.body.success !== false) {
            throw new Error(`Test 2 Failed: Expected status 400, got ${linkInvalid.status}`);
        }
        console.log("✅ Test 2 Passed: Invalid token rejected");

        // 3. Generate linking token on website
        console.log("Test 3: Authenticated user generates WhatsApp token...");
        const tokenRes = await request("POST", "/api/auth/whatsapp/token", null, {
            Authorization: `Bearer ${userToken}`,
        });
        if (tokenRes.status !== 200 || !tokenRes.body.token) {
            throw new Error(`Test 3 Failed: Token generation failed: ${JSON.stringify(tokenRes.body)}`);
        }
        const generatedToken = tokenRes.body.token;
        console.log(`✅ Test 3 Passed: Token generated (${generatedToken.length} chars)`);

        // 4. CONFIRM RAW TOKEN IS NOT STORED IN DATABASE (Requirement 1)
        console.log("Test 4: Verify RAW token is NOT stored in database...");
        const colCheck = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_link_tokens' AND column_name = 'token_plain';"
        );
        if (colCheck.rows.length > 0) {
            throw new Error("Test 4 Failed: token_plain column still exists in whatsapp_link_tokens!");
        }

        const expectedHash = crypto.createHash("sha256").update(generatedToken).digest("hex");
        const tokenRows = await pool.query(
            "SELECT * FROM whatsapp_link_tokens WHERE user_id = $1 AND used = FALSE;",
            [userId]
        );
        if (tokenRows.rows.length === 0) {
            throw new Error("Test 4 Failed: No token record found for user");
        }
        const tokenRecord = tokenRows.rows[0];
        if (tokenRecord.token_hash !== expectedHash) {
            throw new Error(`Test 4 Failed: Stored hash does not match sha256 of token`);
        }
        // Verify raw token is not anywhere in the record values
        const recordValues = Object.values(tokenRecord).map(v => String(v));
        if (recordValues.some(v => v.includes(generatedToken))) {
            throw new Error("Test 4 Failed: RAW token found in database row values!");
        }
        console.log("✅ Test 4 Passed: Only SHA-256 hash is stored, RAW token is never persisted in database");

        // 5. CONFIRM TOKEN EXPIRES (Requirement 2)
        console.log("Test 5: Verify expired token is rejected...");
        const expiredRaw = "EXP999";
        const expiredHash = crypto.createHash("sha256").update(expiredRaw).digest("hex");
        await pool.query(
            `INSERT INTO whatsapp_link_tokens (user_id, token_hash, expires_at, used)
             VALUES ($1, $2, NOW() - INTERVAL '1 minute', FALSE);`,
            [userId, expiredHash]
        );
        const linkExpired = await request("POST", "/api/auth/whatsapp/link", {
            whatsapp_id: testWhatsAppId,
            token: expiredRaw,
        });
        if (linkExpired.status !== 400 || linkExpired.body.success !== false) {
            throw new Error("Test 5 Failed: Expired token was not rejected");
        }
        console.log("✅ Test 5 Passed: Expired token correctly rejected");

        // 6. Link WhatsApp account with valid token
        console.log("Test 6: WhatsApp bot submits token to link account...");
        const linkValid = await request("POST", "/api/auth/whatsapp/link", {
            whatsapp_id: testWhatsAppId,
            token: generatedToken,
        });
        if (linkValid.status !== 200 || linkValid.body.success !== true || linkValid.body.user_id !== userId) {
            throw new Error(`Test 6 Failed: Expected success: true with user_id ${userId}, got ${JSON.stringify(linkValid.body)}`);
        }
        console.log("✅ Test 6 Passed: WhatsApp account linked successfully");

        // 7. CONFIRM SUCCESSFUL LINKING INVALIDATES THE TOKEN (Requirement 4)
        console.log("Test 7: Verify token is marked used/invalidated in database...");
        const invalidatedRows = await pool.query(
            "SELECT used, used_at FROM whatsapp_link_tokens WHERE token_hash = $1;",
            [expectedHash]
        );
        if (invalidatedRows.rows.length === 0 || invalidatedRows.rows[0].used !== true || !invalidatedRows.rows[0].used_at) {
            throw new Error(`Test 7 Failed: Token was not marked used/invalidated after linking`);
        }
        console.log("✅ Test 7 Passed: Token was immediately invalidated in database upon successful linking");

        // 8. CONFIRM TOKEN IS SINGLE-USE (Requirement 3)
        console.log("Test 8: Verify token cannot be reused (single-use)...");
        const linkReuse = await request("POST", "/api/auth/whatsapp/link", {
            whatsapp_id: `+9111${Math.floor(10000000 + Math.random() * 90000000)}`,
            token: generatedToken,
        });
        if (linkReuse.status !== 400 || linkReuse.body.success !== false) {
            throw new Error("Test 8 Failed: Reused token was not rejected");
        }
        console.log("✅ Test 8 Passed: Token is strictly single-use; reuse attempt rejected");

        // 9. CONFIRM WHATSAPP IDENTITY REMAINS LINKED TO THE USER (Requirement 5)
        console.log("Test 9: Verify permanent association in whatsapp_accounts...");
        const accountRows = await pool.query(
            "SELECT user_id, whatsapp_id FROM whatsapp_accounts WHERE whatsapp_id = $1;",
            [testWhatsAppId]
        );
        if (accountRows.rows.length === 0 || accountRows.rows[0].user_id !== userId) {
            throw new Error("Test 9 Failed: WhatsApp identity not permanently mapped to user_id in whatsapp_accounts");
        }
        console.log("✅ Test 9 Passed: WhatsApp identity is permanently linked to user in whatsapp_accounts");

        // 10. CONFIRM ALREADY-LINKED USER DOES NOT NEED TOKEN AGAIN (Requirement 6)
        console.log("Test 10: Verify already-linked user does not need token again...");
        const statusLinked = await request("GET", `/api/auth/whatsapp/status?whatsapp_id=${encodeURIComponent(testWhatsAppId)}`);
        if (statusLinked.status !== 200 || statusLinked.body.linked !== true || statusLinked.body.user_id !== userId) {
            throw new Error(`Test 10 Failed: Expected linked: true, got ${JSON.stringify(statusLinked.body)}`);
        }
        console.log("✅ Test 10 Passed: Already-linked user recognized immediately by WhatsApp ID without requiring token");

        // 11. Check /me for user
        console.log("Test 11: Check /api/auth/whatsapp/me for authenticated user...");
        const meRes = await request("GET", "/api/auth/whatsapp/me", null, {
            Authorization: `Bearer ${userToken}`,
        });
        if (meRes.status !== 200 || meRes.body.linked !== true || meRes.body.whatsapp_id !== testWhatsAppId) {
            throw new Error(`Test 11 Failed: Expected linked: true, got ${JSON.stringify(meRes.body)}`);
        }
        console.log("✅ Test 11 Passed: /me confirms linked WhatsApp ID");

        // 12. Unlink WhatsApp
        console.log("Test 12: Unlink WhatsApp...");
        const unlinkRes = await request("POST", "/api/auth/whatsapp/unlink", null, {
            Authorization: `Bearer ${userToken}`,
        });
        if (unlinkRes.status !== 200 || unlinkRes.body.success !== true) {
            throw new Error(`Test 12 Failed: Unlink failed: ${JSON.stringify(unlinkRes.body)}`);
        }
        const statusAfterUnlink = await request("GET", `/api/auth/whatsapp/status?whatsapp_id=${encodeURIComponent(testWhatsAppId)}`);
        if (statusAfterUnlink.body.linked !== false) {
            throw new Error("Test 12 Failed: Still linked after unlink");
        }
        console.log("✅ Test 12 Passed: Successfully unlinked WhatsApp");

        console.log("=== ALL 12 WHATSAPP AUTH BACKEND INTEGRATION TESTS PASSED ===");
    } catch (err) {
        console.error("Test Failure:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        if (userId) {
            await pool.query("DELETE FROM users WHERE id = $1;", [userId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        process.exit(process.exitCode || 0);
    }
}

runTests();
