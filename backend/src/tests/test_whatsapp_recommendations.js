require("dotenv").config();
const axios = require("axios");
const pool = require("../config/db");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const whatsappRoutes = require("../routes/whatsappRoutes");
const appointmentRoutes = require("../routes/appointmentRoutes");
const jwt = require("jsonwebtoken");

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const SERVICE_KEY = process.env.WHATSAPP_SERVICE_KEY || "medikiosk_whatsapp_service_secret_2026_x89f2";
const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

let server;
let patientUser;
let whatsappId;
let cardiDoc;
let unverifiedDoc;
let completedSessionId;
let bookedAppointmentId;

async function setupTestData() {
    // 1. Create Patient User
    const patEmail = `rec_pat_${Date.now()}@medikiosk.internal`;
    const pRes = await pool.query(
        `INSERT INTO users (email, phone, role, first_name, last_name, login_method, is_active)
         VALUES ($1, $2, 'patient', 'Vikram', 'Sharma', 'phone', true)
         RETURNING id;`,
        [patEmail, `+9198${Math.floor(10000000 + Math.random() * 90000000)}`]
    );
    patientUser = pRes.rows[0];

    await pool.query(
        `INSERT INTO patient_profiles (user_id, preferred_language, accessibility_preference)
         VALUES ($1, 'hi', 'voice_guidance');`,
        [patientUser.id]
    );

    // 2. Link WhatsApp account
    whatsappId = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    await pool.query(
        `INSERT INTO whatsapp_accounts (user_id, whatsapp_id)
         VALUES ($1, $2);`,
        [patientUser.id, whatsappId]
    );

    // 3. Create Verified Cardiologist Doctor
    const docEmail1 = `rec_cardi_${Date.now()}@medikiosk.internal`;
    const docRes1 = await pool.query(
        `INSERT INTO users (email, phone, role, first_name, last_name, login_method, is_active)
         VALUES ($1, $2, 'doctor', 'Ramesh', 'Cardio', 'email', true)
         RETURNING id;`,
        [docEmail1, `+9197${Math.floor(10000000 + Math.random() * 90000000)}`]
    );
    cardiDoc = docRes1.rows[0];
    await pool.query(
        `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
         VALUES ($1, $2, 'Cardiology', 'Cardiovascular Clinic', 'verified');`,
        [cardiDoc.id, `REG_CARDI_${Date.now()}`]
    );

    // 4. Create Pending/Unverified Doctor (must NOT be recommended)
    const docEmail2 = `rec_unver_${Date.now()}@medikiosk.internal`;
    const docRes2 = await pool.query(
        `INSERT INTO users (email, phone, role, first_name, last_name, login_method, is_active)
         VALUES ($1, $2, 'doctor', 'Pending', 'Doc', 'email', true)
         RETURNING id;`,
        [docEmail2, `+9196${Math.floor(10000000 + Math.random() * 90000000)}`]
    );
    unverifiedDoc = docRes2.rows[0];
    await pool.query(
        `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status)
         VALUES ($1, $2, 'Cardiology', 'Cardiology', 'pending');`,
        [unverifiedDoc.id, `REG_UNVER_${Date.now()}`]
    );

    // 5. Create Completed Clinical Session for Patient (Chest pain -> Cardiology)
    completedSessionId = crypto.randomUUID();
    await pool.query(
        `INSERT INTO clinical_sessions (id, patient_id, language, consultation_type, chief_complaint, status, current_state, summary)
         VALUES ($1, $2, 'hi', 'allopathic', 'I have severe chest pain and breathlessness since morning', 'completed', $3, $4);`,
        [
            completedSessionId,
            patientUser.id,
            JSON.stringify({ chief_complaint: "chest pain", red_flags: ["Potential cardiac event"] }),
            "# Physician Summary: Patient reports acute chest pain."
        ]
    );
}

async function cleanupTestData() {
    try {
        if (completedSessionId) {
            await pool.query(`DELETE FROM clinical_sessions WHERE id = $1;`, [completedSessionId]);
        }
        if (bookedAppointmentId) {
            await pool.query(`DELETE FROM appointments WHERE id = $1;`, [bookedAppointmentId]);
        }
        if (patientUser) {
            await pool.query(`DELETE FROM whatsapp_accounts WHERE user_id = $1;`, [patientUser.id]);
            await pool.query(`DELETE FROM patient_profiles WHERE user_id = $1;`, [patientUser.id]);
            await pool.query(`DELETE FROM users WHERE id = $1;`, [patientUser.id]);
        }
        if (cardiDoc) {
            await pool.query(`DELETE FROM doctor_profiles WHERE user_id = $1;`, [cardiDoc.id]);
            await pool.query(`DELETE FROM users WHERE id = $1;`, [cardiDoc.id]);
        }
        if (unverifiedDoc) {
            await pool.query(`DELETE FROM doctor_profiles WHERE user_id = $1;`, [unverifiedDoc.id]);
            await pool.query(`DELETE FROM users WHERE id = $1;`, [unverifiedDoc.id]);
        }
    } catch (err) {
        console.warn("Cleanup error:", err.message);
    }
}

async function runTests() {
    console.log("=== STARTING WHATSAPP DOCTOR RECOMMENDATION & BOOKING TESTS ===");

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/whatsapp", whatsappRoutes);

    server = app.listen(TEST_PORT);
    await new Promise((r) => setTimeout(r, 600));

    try {
        await setupTestData();

        // TEST 1: Service Key Security on Recommendations
        console.log("\n[TEST 1] Service key authentication required");
        try {
            await axios.post(`${BASE_URL}/api/whatsapp/clinical/recommendations`, {
                whatsapp_id: whatsappId,
                session_id: completedSessionId,
            });
            throw new Error("Test 1 Failed: Should have rejected without service key");
        } catch (err) {
            if (err.response?.status !== 401) throw err;
            console.log("✔ Missing service key returns 401 Unauthorized");
        }

        // TEST 2: Doctor recommendations based on completed clinical intake
        console.log("\n[TEST 2] Doctor recommendations for chest pain case");
        const recRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/recommendations`,
            {
                whatsapp_id: whatsappId,
                session_id: completedSessionId,
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );

        if (recRes.status !== 200 || !recRes.data.success) {
            throw new Error(`Test 2 Failed: ${JSON.stringify(recRes.data)}`);
        }
        console.log(`✔ Recommendations response: specialization='${recRes.data.specialization}', returned ${recRes.data.doctors.length} doctors`);
        if (recRes.data.specialization !== "Cardiology") {
            throw new Error(`Test 2 Failed: Expected Cardiology, got ${recRes.data.specialization}`);
        }
        if (recRes.data.language !== "hi" || recRes.data.accessibilityPreference !== "voice_guidance") {
            throw new Error("Test 2 Failed: Account language or accessibility preference not respected");
        }

        const returnedDocIds = recRes.data.doctors.map((d) => d.id);
        if (!returnedDocIds.includes(cardiDoc.id)) {
            throw new Error("Test 2 Failed: Verified cardiologist was not recommended");
        }
        if (returnedDocIds.includes(unverifiedDoc.id)) {
            throw new Error("Test 2 Failed: Unverified doctor was erroneously recommended");
        }
        if (recRes.data.doctors.length > 5) {
            throw new Error("Test 2 Failed: Returned more than 5 doctors");
        }
        console.log("✔ Verified doctor included, unverified excluded, max 5 respected");

        // TEST 3: Fetch Available Slots for Selected Doctor
        console.log("\n[TEST 3] Fetch available slots for doctor");
        const slotsRes = await axios.get(
            `${BASE_URL}/api/whatsapp/clinical/doctors/${cardiDoc.id}/slots`,
            {
                params: { whatsapp_id: whatsappId },
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );

        if (slotsRes.status !== 200 || !slotsRes.data.success || !Array.isArray(slotsRes.data.slots)) {
            throw new Error(`Test 3 Failed: Invalid slots response ${JSON.stringify(slotsRes.data)}`);
        }
        if (slotsRes.data.slots.length === 0) {
            throw new Error("Test 3 Failed: No available slots returned for valid doctor");
        }
        console.log(`✔ Found ${slotsRes.data.slots.length} available slots for date ${slotsRes.data.date}`);
        const selectedSlot = slotsRes.data.slots[0];
        console.log(`Selected slot: ${selectedSlot.time12} (${selectedSlot.scheduledAt})`);

        // TEST 4: Book WhatsApp Appointment
        console.log("\n[TEST 4] Book appointment with doctor");
        const bookRes = await axios.post(
            `${BASE_URL}/api/whatsapp/clinical/book`,
            {
                whatsapp_id: whatsappId,
                sessionId: completedSessionId,
                doctorId: cardiDoc.id,
                scheduledAt: selectedSlot.scheduledAt,
            },
            {
                headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
            }
        );

        if (bookRes.status !== 201 || !bookRes.data.success || !bookRes.data.appointment) {
            throw new Error(`Test 4 Failed: ${JSON.stringify(bookRes.data)}`);
        }
        bookedAppointmentId = bookRes.data.appointment.id;
        console.log(`✔ Appointment booked successfully. ID: ${bookedAppointmentId}`);

        // Verify database link between appointment and clinical_session
        const checkLink = await pool.query(
            `SELECT appointment_id FROM clinical_sessions WHERE id = $1;`,
            [completedSessionId]
        );
        if (checkLink.rows[0].appointment_id !== bookedAppointmentId) {
            throw new Error("Test 4 Failed: clinical_sessions.appointment_id not linked properly");
        }
        console.log("✔ Clinical session successfully linked to appointment in database");

        // TEST 5: Double-Booking Protection on Same Slot
        console.log("\n[TEST 5] Double-booking protection");
        try {
            await axios.post(
                `${BASE_URL}/api/whatsapp/clinical/book`,
                {
                    whatsapp_id: whatsappId,
                    sessionId: completedSessionId,
                    doctorId: cardiDoc.id,
                    scheduledAt: selectedSlot.scheduledAt,
                },
                {
                    headers: { "X-WhatsApp-Service-Key": SERVICE_KEY },
                }
            );
            throw new Error("Test 5 Failed: Should have rejected double booking");
        } catch (err) {
            if (err.response?.status !== 409) {
                throw new Error(`Test 5 Failed: Expected 409 conflict, got ${err.response?.status}`);
            }
            console.log("✔ Duplicate booking rejected with 409 Conflict");
        }

        console.log("\n=======================================================");
        console.log("ALL BACKEND DOCTOR RECOMMENDATION & BOOKING TESTS PASSED!");
        console.log("=======================================================");
    } catch (testErr) {
        console.error("\n❌ TEST SUITE ERROR:", testErr.message);
        throw testErr;
    } finally {
        await cleanupTestData();
        if (server) server.close();
        await pool.end();
    }
}

runTests().then(
    () => process.exit(0),
    () => process.exit(1)
);
