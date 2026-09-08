require("dotenv").config();
const axios = require("axios");
const pool = require("../config/db");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const whatsappRoutes = require("../routes/whatsappRoutes");
const sessionRoutes = require("../routes/sessionRoutes");
const jwt = require("jsonwebtoken");

const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const SERVICE_KEY = process.env.WHATSAPP_SERVICE_KEY || "medikiosk_whatsapp_service_secret_2026_x89f2";
const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

let server;
let patientUser1;
let patientUser2;
let whatsappId1;
let whatsappId2;
let unlinkedWhatsappId;
let patientToken1;

async function setupTestData() {
    // 1. Create Patient User 1
    const email1 = `test_wa_pat1_${Date.now()}@medikiosk.internal`;
    const res1 = await pool.query(
        `INSERT INTO users (email, phone, role, first_name, last_name, login_method)
         VALUES ($1, $2, 'patient', 'Aarav', 'Sharma', 'phone')
         RETURNING id, email;`,
        [email1, `+9198${Math.floor(10000000 + Math.random() * 90000000)}`]
    );
    patientUser1 = res1.rows[0];
    patientToken1 = jwt.sign({ sub: patientUser1.id, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });

    // 2. Create Patient User 2
    const email2 = `test_wa_pat2_${Date.now()}@medikiosk.internal`;
    const res2 = await pool.query(
        `INSERT INTO users (email, phone, role, first_name, last_name, login_method)
         VALUES ($1, $2, 'patient', 'Priya', 'Patel', 'phone')
         RETURNING id, email;`,
        [email2, `+9198${Math.floor(10000000 + Math.random() * 90000000)}`]
    );
    patientUser2 = res2.rows[0];

    // 3. Link WhatsApp ID 1 to Patient 1
    whatsappId1 = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    await pool.query(
        `INSERT INTO whatsapp_accounts (user_id, whatsapp_id)
         VALUES ($1, $2);`,
        [patientUser1.id, whatsappId1]
    );

    // 4. Link WhatsApp ID 2 to Patient 2
    whatsappId2 = `+9198766${Math.floor(10000 + Math.random() * 90000)}`;
    await pool.query(
        `INSERT INTO whatsapp_accounts (user_id, whatsapp_id)
         VALUES ($1, $2);`,
        [patientUser2.id, whatsappId2]
    );

    unlinkedWhatsappId = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
}

async function cleanupTestData() {
    try {
        if (patientUser1) {
            await pool.query(`DELETE FROM clinical_sessions WHERE patient_id = $1;`, [patientUser1.id]);
            await pool.query(`DELETE FROM whatsapp_accounts WHERE user_id = $1;`, [patientUser1.id]);
            await pool.query(`DELETE FROM users WHERE id = $1;`, [patientUser1.id]);
        }
        if (patientUser2) {
            await pool.query(`DELETE FROM clinical_sessions WHERE patient_id = $1;`, [patientUser2.id]);
            await pool.query(`DELETE FROM whatsapp_accounts WHERE user_id = $1;`, [patientUser2.id]);
            await pool.query(`DELETE FROM users WHERE id = $1;`, [patientUser2.id]);
        }
    } catch (err) {
        console.warn("Cleanup error:", err.message);
    }
}

async function runTests() {
    console.log("=== STARTING WHATSAPP CLINICAL PIPELINE INTEGRATION & SECURITY TESTS ===");

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/whatsapp", whatsappRoutes);
    app.use("/api/sessions", sessionRoutes);

    server = app.listen(TEST_PORT);
    console.log(`Test server running on port ${TEST_PORT}`);

    try {
        await setupTestData();
        console.log(`Test data initialized. Patient 1: ${patientUser1.id}, WhatsApp: ${whatsappId1}`);

        // TEST 11: Missing X-WhatsApp-Service-Key is rejected (401)
        console.log("\n[TEST 11] Request missing X-WhatsApp-Service-Key (expected 401)...");
        try {
            await axios.post(`${BASE_URL}/api/whatsapp/clinical/session/start`, {
                whatsapp_id: whatsappId1,
                chief_complaint: "chest pain",
            });
            throw new Error("Should have failed without X-WhatsApp-Service-Key");
        } catch (err) {
            if (err.response && err.response.status === 401) {
                console.log("✅ [TEST 11 PASSED] Missing service key rejected with 401.");
            } else {
                throw err;
            }
        }

        // TEST 12: Invalid X-WhatsApp-Service-Key is rejected (403)
        console.log("\n[TEST 12] Request with invalid X-WhatsApp-Service-Key (expected 403)...");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/clinical/session/start`,
                {
                    whatsapp_id: whatsappId1,
                    chief_complaint: "chest pain",
                },
                {
                    headers: { "X-WhatsApp-Service-Key": "WRONG_SECRET_KEY_123" },
                }
            );
            throw new Error("Should have failed with invalid service key");
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log("✅ [TEST 12 PASSED] Invalid service key rejected with 403.");
            } else {
                throw err;
            }
        }

        // TEST 2: Unlinked WhatsApp ID cannot start clinical session (403)
        console.log("\n[TEST 2] Unlinked WhatsApp ID cannot start session (expected 403)...");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/clinical/session/start`,
                {
                    whatsapp_id: unlinkedWhatsappId,
                    chief_complaint: "fever",
                },
                {
                    headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
                }
            );
            throw new Error("Should have failed for unlinked WhatsApp ID");
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log("✅ [TEST 2 PASSED] Unlinked WhatsApp ID rejected with 403.");
            } else {
                throw err;
            }
        }

        // TEST 1 & 3 & 4 & 5: Linked WhatsApp ID can start session; arbitrary patient_id is IGNORED; patient_id equals linked user_id
        console.log("\n[TEST 1, 3, 4, 5] Starting clinical session for linked WhatsApp ID (with spoofed patient_id)...");
        const spoofedPatientId = crypto.randomUUID();
        const startRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/session/start`,
            {
                whatsapp_id: whatsappId1,
                chief_complaint: "Chest pain since morning",
                patient_id: spoofedPatientId, // Must be ignored!
                patientId: spoofedPatientId,  // Must be ignored!
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );

        if (startRes.status !== 201 && startRes.status !== 200) {
            throw new Error(`Unexpected start status: ${startRes.status}`);
        }
        const sessionId = startRes.data.sessionId || startRes.data.session_id;
        if (!sessionId) throw new Error("No sessionId returned");
        console.log(`Session started successfully. ID: ${sessionId}`);

        // Verify in PostgreSQL that patient_id === patientUser1.id (NOT spoofedPatientId, NOT whatsappId1)
        const dbCheck = await pool.query(
            `SELECT * FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        if (dbCheck.rows.length === 0) throw new Error("Session row not found in PostgreSQL");
        const sessionRow = dbCheck.rows[0];

        if (sessionRow.patient_id !== patientUser1.id) {
            throw new Error(`patient_id in DB (${sessionRow.patient_id}) does not match linked user (${patientUser1.id})`);
        }
        console.log("✅ [TEST 1 PASSED] Linked WhatsApp ID correctly resolved to user_id.");
        console.log("✅ [TEST 3 PASSED] Linked WhatsApp ID started clinical session.");
        console.log("✅ [TEST 4 PASSED] clinical_sessions.patient_id in PostgreSQL strictly equals linked user UUID.");
        console.log("✅ [TEST 5 PASSED] Spoofed client-supplied patient_id was ignored.");

        // TEST 14: Duplicate start request for the same linked patient returns existing active session (200)
        console.log("\n[TEST 14] Duplicate start request for same patient (expected 200 with existing session)...");
        const dupRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/session/start`,
            {
                whatsapp_id: whatsappId1,
                chief_complaint: "Another complaint",
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );
        if (dupRes.status !== 200 || !dupRes.data.isExisting) {
            throw new Error("Did not return existing active session with 200");
        }
        const dupSessionId = dupRes.data.sessionId || dupRes.data.session_id;
        if (dupSessionId !== sessionId) {
            throw new Error("Duplicate session created instead of reusing existing active session");
        }
        console.log("✅ [TEST 14 PASSED] Reused existing active session; prevented duplicate creation.");

        // TEST 6: WhatsApp cannot access another patient's session (403)
        console.log("\n[TEST 6] WhatsApp user 2 attempts to send text turn to session belonging to user 1 (expected 403)...");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/clinical/session/${sessionId}/text-turn`,
                {
                    whatsapp_id: whatsappId2, // User 2 trying to hijack User 1's session!
                    patient_text: "Malicious response",
                },
                {
                    headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
                }
            );
            throw new Error("Should have failed with 403 unauthorized ownership");
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log("✅ [TEST 6 PASSED] Session ownership mismatch rejected with 403.");
            } else {
                throw err;
            }
        }

        // TEST 7: Subsequent text turns update the correct clinical session
        console.log("\n[TEST 7] Sending legitimate patient text turn for User 1...");
        const turnRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/session/${sessionId}/text-turn`,
            {
                whatsapp_id: whatsappId1,
                patient_text: "It started 2 hours ago and radiates to my left arm",
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );
        if (turnRes.status !== 200 || !turnRes.data.success) {
            throw new Error("Text turn failed");
        }
        const updatedDb = await pool.query(
            `SELECT current_state FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        const stateHistory = updatedDb.rows[0].current_state.conversation_history;
        const foundTurn = stateHistory.some(m => m.role === "patient" && m.content.includes("2 hours ago"));
        if (!foundTurn) throw new Error("Patient turn was not recorded in session state");
        console.log("✅ [TEST 7 PASSED] Text turn advanced session and persisted in PostgreSQL.");

        // TEST 8 & 9: Finalize session, save completed status and physician summary
        console.log("\n[TEST 8 & 9] Finalizing session for User 1...");
        const finRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/session/${sessionId}/finalize`,
            {
                whatsapp_id: whatsappId1,
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );
        if (finRes.status !== 200 || !finRes.data.summary) {
            throw new Error("Finalize session failed");
        }
        const finDb = await pool.query(
            `SELECT status, summary FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        if (finDb.rows[0].status !== "completed") {
            throw new Error(`Expected status 'completed', got '${finDb.rows[0].status}'`);
        }
        if (!finDb.rows[0].summary || !finDb.rows[0].summary.includes("Clinical Intake Summary")) {
            throw new Error("Summary not saved to clinical_sessions.summary");
        }
        console.log("✅ [TEST 8 PASSED] Session status updated to 'completed'.");
        console.log("✅ [TEST 9 PASSED] Summary saved to PostgreSQL clinical_sessions.summary.");

        // TEST 13: Completed session rejects further text turns (400)
        console.log("\n[TEST 13] Sending text turn to completed session (expected 400)...");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/clinical/session/${sessionId}/text-turn`,
                {
                    whatsapp_id: whatsappId1,
                    patient_text: "Another message after completion",
                },
                {
                    headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
                }
            );
            throw new Error("Should have failed for completed session");
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log("✅ [TEST 13 PASSED] Turn to completed session rejected with 400.");
            } else {
                throw err;
            }
        }

        // TEST 10: Existing website clinical APIs continue working unchanged
        console.log("\n[TEST 10] Verifying website JWT /api/sessions/start continues working unchanged...");
        const websiteStart = await axios.post(
            `${BASE_URL}/api/sessions/start`,
            {
                chiefComplaint: "Skin rash",
            },
            {
                headers: { Authorization: `Bearer ${patientToken1}` },
            }
        );
        if (websiteStart.status !== 201) {
            throw new Error(`Website start failed with status ${websiteStart.status}`);
        }
        console.log("✅ [TEST 10 PASSED] Website clinical API (/api/sessions/start) works unchanged.");

        console.log("\n🎉 ALL 14 BACKEND SECURITY AND INTEGRATION TESTS PASSED! 🎉\n");
    } finally {
        await cleanupTestData();
        if (server) server.close();
    }
}

runTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("\n❌ TEST FAILED:", err.response?.data || err.message, err.stack);
    if (server) server.close();
    process.exit(1);
});
