const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { normalizePhone, isValidIndianPhone } = require("../utils/phoneUtils");
const {
    hashOTP,
    verifyOTP,
    sendOTP2Factor,
    verifyOTP2Factor,
} = require("../services/otpService");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * 1. Register Patient via Phone - Step 1: Request OTP via 2Factor
 * POST /api/auth/patient/register/phone
 */
async function registerPhone(req, res) {
    try {
        const { firstName, lastName, phone, dateOfBirth, gender } = req.body;

        if (!firstName || !phone || !dateOfBirth || !gender) {
            return res.status(400).json({
                message: "Missing required fields: firstName, phone, dateOfBirth, gender",
            });
        }

        const normalizedPhone = normalizePhone(phone);
        if (!isValidIndianPhone(normalizedPhone)) {
            return res.status(400).json({
                message: "Invalid Indian phone number format. Must be 10 digits (e.g. +919876543210).",
            });
        }

        // Check if phone number is already registered in users table
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE phone = $1;",
            [normalizedPhone]
        );
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                message: "Phone number is already registered.",
            });
        }

        // 1. Cooldown Check: Enforce 60-second wait between consecutive OTP resends
        const cooldownCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'registration' AND created_at > NOW() - INTERVAL '60 seconds';`,
            [normalizedPhone]
        );
        if (parseInt(cooldownCheck.rows[0].count, 10) > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another OTP.",
            });
        }

        // 2. Sliding Window Rate Limiting Check: Max 3 registration OTP requests per 10 mins
        const rateCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'registration' AND created_at > NOW() - INTERVAL '10 minutes';`,
            [normalizedPhone]
        );
        if (parseInt(rateCheck.rows[0].count, 10) >= 3) {
            return res.status(429).json({
                message: "Too many OTP requests. Please wait a few minutes before trying again.",
            });
        }

        // 3. Invalidate previous unverified active OTPs for this phone + purpose
        await pool.query(
            `UPDATE otp_verifications
             SET expires_at = NOW()
             WHERE phone = $1
               AND purpose = 'registration'
               AND verified_at IS NULL
               AND expires_at > NOW();`,
            [normalizedPhone]
        );

        // Send OTP via 2Factor.in Provider
        const providerRes = await sendOTP2Factor(normalizedPhone);

        let hashedOtp;
        let metadata;

        if (providerRes.isProvider) {
            hashedOtp = hashOTP("2FACTOR_PROVIDER_MANAGED");
            metadata = {
                provider: "2factor",
                providerSessionId: providerRes.sessionId,
                firstName,
                lastName: lastName || "",
                dateOfBirth,
                gender,
            };
        } else {
            hashedOtp = hashOTP(providerRes.mockOtp);
            metadata = {
                provider: "dev_mock",
                firstName,
                lastName: lastName || "",
                dateOfBirth,
                gender,
            };
        }

        // Store new OTP Verification Record
        const result = await pool.query(
            `INSERT INTO otp_verifications (phone, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'registration', $2, $3, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [normalizedPhone, hashedOtp, JSON.stringify(metadata)]
        );

        const verificationId = result.rows[0].id;

        return res.status(200).json({
            message: "OTP sent successfully",
            verificationId,
        });
    } catch (error) {
        console.error("Error in registerPhone:", error.message);
        return res.status(error.message.includes("Unable to send OTP") ? 502 : 500).json({
            message: error.message.includes("Unable to send OTP")
                ? error.message
                : "Internal server error during registration",
        });
    }
}

/**
 * 2. Register Patient via Phone - Step 2: Verify 2Factor OTP & Create User
 * POST /api/auth/patient/verify-phone
 */
async function verifyPhone(req, res) {
    const client = await pool.connect();
    try {
        const { verificationId, otp } = req.body;

        if (!verificationId || !otp) {
            return res.status(400).json({
                message: "Missing required fields: verificationId, otp",
            });
        }

        // Fetch OTP verification record
        const otpResult = await client.query(
            `SELECT * FROM otp_verifications WHERE id = $1 AND purpose = 'registration';`,
            [verificationId]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({
                message: "Invalid verification record",
            });
        }

        const record = otpResult.rows[0];

        if (record.verified_at) {
            return res.status(400).json({
                message: "OTP has already been verified",
            });
        }

        if (new Date(record.expires_at) < new Date()) {
            return res.status(400).json({
                message: "OTP has expired. Please request a new one.",
            });
        }

        if (record.attempts >= record.max_attempts) {
            return res.status(400).json({
                message: "Maximum verification attempts exceeded. Please request a new OTP.",
            });
        }

        // Increment attempt count
        await client.query(
            `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1;`,
            [verificationId]
        );

        // Verify OTP via Provider or local Mock
        let isMatch = false;
        if (record.metadata && record.metadata.provider === "2factor") {
            isMatch = await verifyOTP2Factor(record.metadata.providerSessionId, otp);
        } else {
            isMatch = verifyOTP(otp, record.otp_hash);
        }

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid OTP code",
            });
        }

        // Mark OTP as verified
        await client.query(
            `UPDATE otp_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1;`,
            [verificationId]
        );

        const { firstName, lastName, dateOfBirth, gender } = record.metadata || {};
        const phone = record.phone;

        // Perform atomic Database Transaction to create user and profile
        await client.query("BEGIN;");

        // Double check user doesn't already exist
        const checkUser = await client.query(
            "SELECT id FROM users WHERE phone = $1;",
            [phone]
        );
        if (checkUser.rows.length > 0) {
            await client.query("ROLLBACK;");
            return res.status(400).json({
                message: "Phone number is already registered.",
            });
        }

        // Insert into users (role = 'patient', login_method = 'phone')
        const userInsert = await client.query(
            `INSERT INTO users (first_name, last_name, phone, login_method, role)
             VALUES ($1, $2, $3, 'phone', 'patient')
             RETURNING id, first_name, last_name, role, login_method;`,
            [firstName, lastName || null, phone]
        );

        const newUser = userInsert.rows[0];

        // Insert into patient_profiles
        await client.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, $2, $3);`,
            [newUser.id, dateOfBirth, gender]
        );

        await client.query("COMMIT;");

        // Generate JWT Token
        const token = jwt.sign(
            { sub: newUser.id, role: newUser.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({
            message: "Phone verified successfully",
            token,
            user: {
                id: newUser.id,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                loginMethod: newUser.login_method,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        console.error("Error in verifyPhone:", error.message);
        return res.status(500).json({
            message: "Internal server error during phone verification",
        });
    } finally {
        client.release();
    }
}

/**
 * 3. Patient Login via Phone - Step 1: Request OTP via 2Factor
 * POST /api/auth/patient/login/phone
 */
async function loginPhone(req, res) {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                message: "Phone number is required",
            });
        }

        const normalizedPhone = normalizePhone(phone);
        if (!isValidIndianPhone(normalizedPhone)) {
            return res.status(400).json({
                message: "Invalid phone number format.",
            });
        }

        // Find user by phone number
        const userResult = await pool.query(
            "SELECT id, role, login_method FROM users WHERE phone = $1;",
            [normalizedPhone]
        );

        if (
            userResult.rows.length === 0 ||
            userResult.rows[0].role !== "patient" ||
            userResult.rows[0].login_method !== "phone"
        ) {
            return res.status(404).json({
                message: "No patient account found with this phone number.",
            });
        }

        // 1. Cooldown Check: Enforce 60-second wait between consecutive login OTP resends
        const cooldownCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'login' AND created_at > NOW() - INTERVAL '60 seconds';`,
            [normalizedPhone]
        );
        if (parseInt(cooldownCheck.rows[0].count, 10) > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another OTP.",
            });
        }

        // 2. Sliding Window Rate Limiting Check: Max 3 login OTP requests per 10 mins
        const rateCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'login' AND created_at > NOW() - INTERVAL '10 minutes';`,
            [normalizedPhone]
        );
        if (parseInt(rateCheck.rows[0].count, 10) >= 3) {
            return res.status(429).json({
                message: "Too many login OTP requests. Please wait a few minutes before trying again.",
            });
        }

        // 3. Invalidate previous unverified active OTPs for this phone + purpose
        await pool.query(
            `UPDATE otp_verifications
             SET expires_at = NOW()
             WHERE phone = $1
               AND purpose = 'login'
               AND verified_at IS NULL
               AND expires_at > NOW();`,
            [normalizedPhone]
        );

        // Send OTP via 2Factor.in Provider
        const providerRes = await sendOTP2Factor(normalizedPhone);

        let hashedOtp;
        let metadata;

        if (providerRes.isProvider) {
            hashedOtp = hashOTP("2FACTOR_PROVIDER_MANAGED");
            metadata = {
                provider: "2factor",
                providerSessionId: providerRes.sessionId,
            };
        } else {
            hashedOtp = hashOTP(providerRes.mockOtp);
            metadata = {
                provider: "dev_mock",
            };
        }

        // Insert new OTP verification record
        const result = await pool.query(
            `INSERT INTO otp_verifications (phone, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'login', $2, $3, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [normalizedPhone, hashedOtp, JSON.stringify(metadata)]
        );

        const verificationId = result.rows[0].id;

        return res.status(200).json({
            message: "OTP sent successfully",
            verificationId,
        });
    } catch (error) {
        console.error("Error in loginPhone:", error.message);
        return res.status(error.message.includes("Unable to send OTP") ? 502 : 500).json({
            message: error.message.includes("Unable to send OTP")
                ? error.message
                : "Internal server error during login OTP request",
        });
    }
}

/**
 * 4. Patient Login via Phone - Step 2: Verify 2Factor OTP & Return JWT
 * POST /api/auth/patient/login/phone/verify
 */
async function verifyLoginPhone(req, res) {
    try {
        const { verificationId, otp } = req.body;

        if (!verificationId || !otp) {
            return res.status(400).json({
                message: "Missing required fields: verificationId, otp",
            });
        }

        // Fetch OTP record
        const otpResult = await pool.query(
            `SELECT * FROM otp_verifications WHERE id = $1 AND purpose = 'login';`,
            [verificationId]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({
                message: "Invalid login verification record",
            });
        }

        const record = otpResult.rows[0];

        if (record.verified_at) {
            return res.status(400).json({
                message: "OTP has already been verified",
            });
        }

        if (new Date(record.expires_at) < new Date()) {
            return res.status(400).json({
                message: "OTP has expired. Please request a new one.",
            });
        }

        if (record.attempts >= record.max_attempts) {
            return res.status(400).json({
                message: "Maximum verification attempts exceeded. Please request a new OTP.",
            });
        }

        // Increment attempts
        await pool.query(
            `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1;`,
            [verificationId]
        );

        // Verify OTP match
        let isMatch = false;
        if (record.metadata && record.metadata.provider === "2factor") {
            isMatch = await verifyOTP2Factor(record.metadata.providerSessionId, otp);
        } else {
            isMatch = verifyOTP(otp, record.otp_hash);
        }

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid OTP code",
            });
        }

        // Mark verified
        await pool.query(
            `UPDATE otp_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1;`,
            [verificationId]
        );

        // Fetch User Identity
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, role, login_method FROM users WHERE phone = $1;`,
            [record.phone]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User account not found",
            });
        }

        const user = userResult.rows[0];

        // Generate JWT Token
        const token = jwt.sign(
            { sub: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                loginMethod: user.login_method,
            },
        });
    } catch (error) {
        console.error("Error in verifyLoginPhone:", error.message);
        return res.status(500).json({
            message: "Internal server error during login verification",
        });
    }
}

/**
 * 5. Get Authenticated Patient Info
 * GET /api/auth/me
 */
async function getMe(req, res) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.role, u.login_method, u.email, u.phone,
                    p.date_of_birth, p.gender, p.abha_id
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             WHERE u.id = $1 AND u.is_active = true;`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found or account inactive",
            });
        }

        const row = result.rows[0];

        return res.status(200).json({
            user: {
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                role: row.role,
                loginMethod: row.login_method,
            },
            profile: {
                dateOfBirth: row.date_of_birth,
                gender: row.gender,
                abhaId: row.abha_id,
            },
        });
    } catch (error) {
        console.error("Error in getMe:", error.message);
        return res.status(500).json({
            message: "Internal server error fetching user profile",
        });
    }
}

module.exports = {
    registerPhone,
    verifyPhone,
    loginPhone,
    verifyLoginPhone,
    getMe,
};
