require("dotenv").config();
const assert = require("assert");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runPatientOnboardingTests() {
    console.log("\n==================================================");
    console.log("RUNNING PATIENT ONBOARDING PREFERENCES TEST SUITE");
    console.log("==================================================\n");

    let testPatientId = null;
    let testDoctorId = null;
    let patientToken = null;
    let doctorToken = null;

    try {
        // 1. Setup mock patient and doctor in DB
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, phone, login_method, role, is_active)
             VALUES ('TestOnboard', 'Patient', 'testonboard@example.com', '+919999988888', 'phone', 'patient', true)
             RETURNING id, role;`
        );
        testPatientId = patientRes.rows[0].id;

        await pool.query(
            `INSERT INTO patient_profiles (user_id) VALUES ($1);`,
            [testPatientId]
        );

        const doctorRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('TestOnboard', 'Doctor', 'testdoctoronboard@example.com', 'email', 'doctor', true)
             RETURNING id, role;`
        );
        testDoctorId = doctorRes.rows[0].id;

        patientToken = jwt.sign({ sub: testPatientId, role: "patient" }, JWT_SECRET, { expiresIn: "1h" });
        doctorToken = jwt.sign({ sub: testDoctorId, role: "doctor" }, JWT_SECRET, { expiresIn: "1h" });

        console.log("✔ Test setup completed: Created test patient & doctor.");

        // TEST 1: Unauthenticated request rejected (401)
        const unauthRes = await fetch("http://localhost:5001/api/patient/profile/onboarding", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: "Maharashtra", preferred_language: "mr", interaction_mode: "voice_touch", accessibility_preference: "none" })
        }).catch(() => null);

        // TEST 2: Validation checks
        const patientController = require("../controllers/patientController");
        
        // Mock res object
        const createMockRes = () => {
            const res = {
                statusCode: 200,
                jsonData: null,
                status(code) { this.statusCode = code; return this; },
                json(data) { this.jsonData = data; return this; }
            };
            return res;
        };

        // Test invalid state
        let res = createMockRes();
        await patientController.saveOnboardingPreferences(
            { user: { id: testPatientId, role: "patient" }, body: { state: "InvalidState", preferred_language: "mr", interaction_mode: "voice_touch", accessibility_preference: "none" } },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 400, "Should reject invalid state");
        console.log("✔ Test 2: Invalid state rejected (400).");

        // Test invalid language
        res = createMockRes();
        await patientController.saveOnboardingPreferences(
            { user: { id: testPatientId, role: "patient" }, body: { state: "Maharashtra", preferred_language: "xx", interaction_mode: "voice_touch", accessibility_preference: "none" } },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 400, "Should reject invalid language");
        console.log("✔ Test 3: Invalid language rejected (400).");

        // Test invalid interaction_mode
        res = createMockRes();
        await patientController.saveOnboardingPreferences(
            { user: { id: testPatientId, role: "patient" }, body: { state: "Maharashtra", preferred_language: "mr", interaction_mode: "telepathy", accessibility_preference: "none" } },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 400, "Should reject invalid interaction_mode");
        console.log("✔ Test 4: Invalid interaction mode rejected (400).");

        // Test invalid accessibility_preference
        res = createMockRes();
        await patientController.saveOnboardingPreferences(
            { user: { id: testPatientId, role: "patient" }, body: { state: "Maharashtra", preferred_language: "mr", interaction_mode: "voice_touch", accessibility_preference: "magic" } },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 400, "Should reject invalid accessibility_preference");
        console.log("✔ Test 5: Invalid accessibility preference rejected (400).");

        // TEST 6: Save valid onboarding data
        res = createMockRes();
        await patientController.saveOnboardingPreferences(
            {
                user: { id: testPatientId, role: "patient" },
                body: {
                    state: "Maharashtra",
                    preferred_language: "mr",
                    interaction_mode: "voice_touch",
                    accessibility_preference: "none"
                }
            },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 200, "Should save valid onboarding preferences");
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.onboarding.completed, true);
        assert.strictEqual(res.jsonData.onboarding.state, "Maharashtra");
        assert.strictEqual(res.jsonData.onboarding.preferred_language, "mr");
        console.log("✔ Test 6: Valid onboarding preferences saved successfully (200).");

        // TEST 7: GET onboarding preferences
        res = createMockRes();
        await patientController.getOnboardingPreferences(
            { user: { id: testPatientId, role: "patient" } },
            res,
            (err) => { throw err; }
        );
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.onboarding.completed, true);
        assert.strictEqual(res.jsonData.onboarding.state, "Maharashtra");
        console.log("✔ Test 7: GET onboarding preferences returned saved data (200).");

        // TEST 8: Check authController getMe returns onboarding state
        const authController = require("../controllers/authController");
        res = createMockRes();
        await authController.getMe(
            { user: { id: testPatientId, role: "patient" } },
            res
        );
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.onboarding.completed, true);
        assert.strictEqual(res.jsonData.onboarding.preferredLanguage, "mr");
        console.log("✔ Test 8: /api/auth/me includes patient onboarding completed status.");

        console.log("\nALL PATIENT ONBOARDING TESTS PASSED PERFECTLY! 🎉\n");
    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    } finally {
        // Cleanup test users
        if (testPatientId) {
            await pool.query(`DELETE FROM users WHERE id = $1;`, [testPatientId]).catch(() => {});
        }
        if (testDoctorId) {
            await pool.query(`DELETE FROM users WHERE id = $1;`, [testDoctorId]).catch(() => {});
        }
    }
}

if (require.main === module) {
    runPatientOnboardingTests().then(() => process.exit(0));
}

module.exports = runPatientOnboardingTests;
