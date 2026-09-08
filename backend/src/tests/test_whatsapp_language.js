require("dotenv").config();
const axios = require("axios");
const pool = require("../config/db");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const whatsappRoutes = require("../routes/whatsappRoutes");
const authRoutes = require("../routes/authRoutes");

const TEST_PORT = 5097;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const SERVICE_KEY = process.env.WHATSAPP_SERVICE_KEY || "medikiosk_whatsapp_service_secret_2026_x89f2";

let server;

async function runLanguageTests() {
    console.log("=== STARTING WHATSAPP ACCOUNT-AUTHORITATIVE LANGUAGE TESTS ===");

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/whatsapp", whatsappRoutes);
    app.use("/api/auth", authRoutes);

    await new Promise((resolve) => {
        server = app.listen(TEST_PORT, () => {
            console.log(`Test server running on port ${TEST_PORT}`);
            resolve();
        });
    });

    try {
        // Setup a test patient user
        const email = `test_lang_${Date.now()}@medikiosk.internal`;
        const userRes = await pool.query(
            `INSERT INTO users (email, phone, role, first_name, last_name, login_method)
             VALUES ($1, $2, 'patient', 'Vikram', 'Patil', 'phone')
             RETURNING id, email;`,
            [email, `+9198${Math.floor(10000000 + Math.random() * 90000000)}`]
        );
        const userId = userRes.rows[0].id;
        const whatsappId = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;

        // TEST 1: Unlinked user returns linked: false, language: null
        console.log("\n[TEST 1] Check status for unlinked user...");
        const statusRes1 = await axios.get(`${BASE_URL}/api/auth/whatsapp/status?whatsapp_id=${encodeURIComponent(whatsappId)}`);
        if (statusRes1.data.linked !== false) {
            throw new Error("Expected unlinked status");
        }
        console.log("✅ [TEST 1 PASSED] Unlinked user returns linked: false");

        // TEST 2: Generate link token and link with language = "hi"
        console.log("\n[TEST 2] Link user with chosen language 'hi'...");
        const rawToken = "TESTHI";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        await pool.query(
            `INSERT INTO whatsapp_link_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '10 minutes');`,
            [userId, tokenHash]
        );

        const linkRes = await axios.post(`${BASE_URL}/api/auth/whatsapp/link`, {
            whatsapp_id: whatsappId,
            token: rawToken,
            language: "hi",
        });

        if (!linkRes.data.success || linkRes.data.language !== "hi") {
            throw new Error(`Link failed or wrong language: ${JSON.stringify(linkRes.data)}`);
        }

        // Verify in database patient_profiles
        const profRes = await pool.query(
            `SELECT preferred_language FROM patient_profiles WHERE user_id = $1;`,
            [userId]
        );
        if (profRes.rows.length === 0 || profRes.rows[0].preferred_language !== "hi") {
            throw new Error(`DB preferred_language not updated to 'hi': ${JSON.stringify(profRes.rows)}`);
        }
        console.log("✅ [TEST 2 PASSED] Linked user and persisted language 'hi' to patient_profiles");

        // TEST 3: Status check now returns linked: true and language: 'hi'
        console.log("\n[TEST 3] Status check returns authoritative account language...");
        const statusRes2 = await axios.get(`${BASE_URL}/api/auth/whatsapp/status?whatsapp_id=${encodeURIComponent(whatsappId)}`);
        if (!statusRes2.data.linked || statusRes2.data.language !== "hi") {
            throw new Error(`Expected linked: true with language 'hi': ${JSON.stringify(statusRes2.data)}`);
        }
        console.log("✅ [TEST 3 PASSED] Status check returns linked: true with account language 'hi'");

        // TEST 4: Update language to 'mr' via /api/whatsapp/language
        console.log("\n[TEST 4] Update account language to 'mr' via /api/whatsapp/language...");
        const updateRes = await axios.post(
            `${BASE_URL}/api/whatsapp/language`,
            { whatsapp_id: whatsappId, language: "mr" },
            { headers: { "X-WhatsApp-Service-Key": SERVICE_KEY } }
        );
        if (!updateRes.data.success || updateRes.data.language !== "mr") {
            throw new Error(`Failed to update language: ${JSON.stringify(updateRes.data)}`);
        }

        const profRes2 = await pool.query(
            `SELECT preferred_language FROM patient_profiles WHERE user_id = $1;`,
            [userId]
        );
        if (profRes2.rows[0].preferred_language !== "mr") {
            throw new Error("DB preferred_language not 'mr'");
        }
        console.log("✅ [TEST 4 PASSED] Successfully updated account language to 'mr'");

        // TEST 5: Language update requires valid X-WhatsApp-Service-Key
        console.log("\n[TEST 5] Service key security enforcement on language update...");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/language`,
                { whatsapp_id: whatsappId, language: "gu" }
            );
            throw new Error("Should have failed without service key");
        } catch (err) {
            if (err.response && err.response.status === 401) {
                console.log("✅ [TEST 5a PASSED] Missing service key rejected with 401");
            } else {
                throw err;
            }
        }

        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/language`,
                { whatsapp_id: whatsappId, language: "gu" },
                { headers: { "X-WhatsApp-Service-Key": "WRONG_KEY" } }
            );
            throw new Error("Should have failed with invalid service key");
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log("✅ [TEST 5b PASSED] Invalid service key rejected with 403");
            } else {
                throw err;
            }
        }

        // Cleanup
        await pool.query(`DELETE FROM whatsapp_accounts WHERE user_id = $1;`, [userId]);
        await pool.query(`DELETE FROM whatsapp_link_tokens WHERE user_id = $1;`, [userId]);
        await pool.query(`DELETE FROM patient_profiles WHERE user_id = $1;`, [userId]);
        await pool.query(`DELETE FROM users WHERE id = $1;`, [userId]);

        console.log("\n🎉 ALL BACKEND LANGUAGE INTEGRATION TESTS PASSED! 🎉");
    } finally {
        if (server) server.close();
    }
}

runLanguageTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Test failed:", err);
        process.exit(1);
    });
