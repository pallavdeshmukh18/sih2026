const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { normalizePhone, isValidIndianPhone } = require("../utils/phoneUtils");
const { normalizeEmail, isValidEmail } = require("../utils/emailUtils");
const {
    generateOTP,
    hashOTP,
    verifyOTP,
    sendOTP2Factor,
    verifyOTP2Factor,
} = require("../services/otpService");
const { sendEmailOTP } = require("../services/emailService");
const googleAuthService = require("../services/googleAuthService");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ==================================================
// PHONE AUTHENTICATION CONTROLLERS
// ==================================================

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
            `INSERT INTO otp_verifications (phone, identifier_type, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'phone', 'registration', $2, $3, NOW() + INTERVAL '5 minutes')
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
            `INSERT INTO otp_verifications (phone, identifier_type, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'phone', 'login', $2, $3, NOW() + INTERVAL '5 minutes')
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


// ==================================================
// EMAIL AUTHENTICATION CONTROLLERS
// ==================================================

/**
 * 5. Register Patient via Email - Step 1: Request OTP
 * POST /api/auth/patient/register/email
 */
async function registerEmail(req, res) {
    try {
        const { firstName, lastName, email, dateOfBirth, gender } = req.body;

        if (!firstName || !email || !dateOfBirth || !gender) {
            return res.status(400).json({
                message: "Missing required fields: firstName, email, dateOfBirth, gender",
            });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Invalid email address format.",
            });
        }

        // Check if email is already registered in users table
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1;",
            [normalizedEmail]
        );
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                message: "Email is already registered.",
            });
        }

        // 1. Cooldown Check: Enforce 60-second wait between consecutive email OTP resends
        const cooldownCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE email = $1 AND purpose = 'registration' AND created_at > NOW() - INTERVAL '60 seconds';`,
            [normalizedEmail]
        );
        if (parseInt(cooldownCheck.rows[0].count, 10) > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another OTP.",
            });
        }

        // 2. Sliding Window Rate Limiting Check: Max 3 registration OTP requests per 10 mins
        const rateCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE email = $1 AND purpose = 'registration' AND created_at > NOW() - INTERVAL '10 minutes';`,
            [normalizedEmail]
        );
        if (parseInt(rateCheck.rows[0].count, 10) >= 3) {
            return res.status(429).json({
                message: "Too many OTP requests. Please wait a few minutes before trying again.",
            });
        }

        // 3. Invalidate previous unverified active OTPs for this email + purpose
        await pool.query(
            `UPDATE otp_verifications
             SET expires_at = NOW()
             WHERE email = $1
               AND purpose = 'registration'
               AND verified_at IS NULL
               AND expires_at > NOW();`,
            [normalizedEmail]
        );

        // Generate and Hash OTP
        const otp = generateOTP();
        const hashedOtp = hashOTP(otp);

        const metadata = {
            firstName,
            lastName: lastName || "",
            dateOfBirth,
            gender,
        };

        // Store OTP Verification Record
        const result = await pool.query(
            `INSERT INTO otp_verifications (email, identifier_type, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'email', 'registration', $2, $3, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [normalizedEmail, hashedOtp, JSON.stringify(metadata)]
        );

        const verificationId = result.rows[0].id;

        // Dispatch Email OTP via Gmail SMTP (Nodemailer)
        await sendEmailOTP(normalizedEmail, otp);

        return res.status(200).json({
            message: "OTP sent",
            verificationId,
        });
    } catch (error) {
        console.error("Error in registerEmail:", error.message);
        return res.status(500).json({
            message: error.message.includes("Unable to send verification email")
                ? error.message
                : "Internal server error during email registration",
        });
    }
}

/**
 * 6. Register Patient via Email - Step 2: Verify OTP & Create User
 * POST /api/auth/patient/verify-email
 */
async function verifyEmail(req, res) {
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

        // Verify OTP hash
        const isMatch = verifyOTP(otp, record.otp_hash);
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
        const email = record.email;

        // Perform atomic Database Transaction to create user and profile
        await client.query("BEGIN;");

        // Double check email doesn't already exist
        const checkUser = await client.query(
            "SELECT id FROM users WHERE email = $1;",
            [email]
        );
        if (checkUser.rows.length > 0) {
            await client.query("ROLLBACK;");
            return res.status(400).json({
                message: "Email is already registered.",
            });
        }

        // Insert into users (role = 'patient', login_method = 'email')
        const userInsert = await client.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role)
             VALUES ($1, $2, $3, 'email', 'patient')
             RETURNING id, first_name, last_name, role, login_method;`,
            [firstName, lastName || null, email]
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
            message: "Email verified successfully",
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
        console.error("Error in verifyEmail:", error.message);
        return res.status(500).json({
            message: "Internal server error during email verification",
        });
    } finally {
        client.release();
    }
}

/**
 * 7. Patient Login via Email - Step 1: Request OTP
 * POST /api/auth/patient/login/email
 */
async function loginEmail(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Invalid email address format.",
            });
        }

        // Find user by email
        const userResult = await pool.query(
            "SELECT id, role, login_method FROM users WHERE email = $1;",
            [normalizedEmail]
        );

        if (
            userResult.rows.length === 0 ||
            userResult.rows[0].role !== "patient" ||
            userResult.rows[0].login_method !== "email"
        ) {
            return res.status(404).json({
                message: "No patient account found with this email address.",
            });
        }

        // 1. Cooldown Check: Enforce 60-second wait between consecutive email OTP resends
        const cooldownCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE email = $1 AND purpose = 'login' AND created_at > NOW() - INTERVAL '60 seconds';`,
            [normalizedEmail]
        );
        if (parseInt(cooldownCheck.rows[0].count, 10) > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another OTP.",
            });
        }

        // 2. Sliding Window Rate Limiting Check: Max 3 login OTP requests per 10 mins
        const rateCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE email = $1 AND purpose = 'login' AND created_at > NOW() - INTERVAL '10 minutes';`,
            [normalizedEmail]
        );
        if (parseInt(rateCheck.rows[0].count, 10) >= 3) {
            return res.status(429).json({
                message: "Too many login OTP requests. Please wait a few minutes before trying again.",
            });
        }

        // 3. Invalidate previous unverified active OTPs for this email + purpose
        await pool.query(
            `UPDATE otp_verifications
             SET expires_at = NOW()
             WHERE email = $1
               AND purpose = 'login'
               AND verified_at IS NULL
               AND expires_at > NOW();`,
            [normalizedEmail]
        );

        // Generate & Hash OTP
        const otp = generateOTP();
        const hashedOtp = hashOTP(otp);

        // Insert new OTP verification record
        const result = await pool.query(
            `INSERT INTO otp_verifications (email, identifier_type, purpose, otp_hash, expires_at)
             VALUES ($1, 'email', 'login', $2, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [normalizedEmail, hashedOtp]
        );

        const verificationId = result.rows[0].id;

        // Dispatch Email OTP via Gmail SMTP
        await sendEmailOTP(normalizedEmail, otp);

        return res.status(200).json({
            message: "OTP sent",
            verificationId,
        });
    } catch (error) {
        console.error("Error in loginEmail:", error.message);
        return res.status(500).json({
            message: "Internal server error during login OTP request",
        });
    }
}

/**
 * 8. Patient Login via Email - Step 2: Verify OTP & Return JWT
 * POST /api/auth/patient/login/email/verify
 */
async function verifyLoginEmail(req, res) {
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
        const isMatch = verifyOTP(otp, record.otp_hash);
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
            `SELECT id, first_name, last_name, role, login_method FROM users WHERE email = $1;`,
            [record.email]
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
        console.error("Error in verifyLoginEmail:", error.message);
        return res.status(500).json({
            message: "Internal server error during login verification",
        });
    }
}


// ==================================================
// GOOGLE OAUTH 2.0 CONTROLLERS
// ==================================================

/**
 * 9. Initiate Google OAuth 2.0 Consent Flow
 * GET /api/auth/patient/google
 */
async function initiateGoogleAuth(req, res) {
    try {
        const state = crypto.randomBytes(32).toString("hex");

        res.cookie("google_oauth_state", state, {
            httpOnly: true,
            maxAge: 10 * 60 * 1000, // 10 minutes
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        const authUrl = googleAuthService.getGoogleAuthUrl(state);
        return res.redirect(authUrl);
    } catch (error) {
        console.error("Error in initiateGoogleAuth:", error.message);
        return res.status(500).json({
            message: "Internal server error initiating Google authentication",
        });
    }
}

/**
 * 10. Handle Google OAuth 2.0 Callback
 * GET /api/auth/patient/google/callback
 */
async function handleGoogleCallback(req, res) {
    const client = await pool.connect();
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.status(400).json({
                message: `Google OAuth authorization error: ${error}`,
            });
        }

        const storedState = req.cookies ? req.cookies.google_oauth_state : null;
        res.clearCookie("google_oauth_state");

        if (!state || !storedState || state !== storedState) {
            return res.status(400).json({
                message: "Invalid OAuth state parameter (CSRF protection failed).",
            });
        }

        if (!code) {
            return res.status(400).json({
                message: "Authorization code is missing.",
            });
        }

        // Exchange code & verify Google ID Token
        const googleUser = await googleAuthService.verifyGoogleCode(code);
        const { sub, email, givenName, familyName } = googleUser;

        // Step A: Check if Google patient already exists by provider_id = sub
        const existingGoogleUser = await client.query(
            "SELECT id, first_name, last_name, role, login_method, is_active FROM users WHERE login_method = 'google' AND provider_id = $1;",
            [sub]
        );

        if (existingGoogleUser.rows.length > 0) {
            const user = existingGoogleUser.rows[0];

            if (user.role !== "patient" || !user.is_active) {
                return res.status(403).json({
                    message: "Account inactive or unauthorized role.",
                });
            }

            const token = jwt.sign(
                { sub: user.id, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return res.status(200).json({
                message: "Google login successful",
                token,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    loginMethod: user.login_method,
                },
            });
        }

        // Step B: Account Collision Check - check if email is registered via another login method (e.g. email/phone)
        const emailCollision = await client.query(
            "SELECT id, login_method FROM users WHERE email = $1;",
            [email]
        );

        if (emailCollision.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email address already exists using a different login method. Account linking is required.",
            });
        }

        // Step C: Create new Google Patient User in atomic DB Transaction
        await client.query("BEGIN;");

        const userInsert = await client.query(
            `INSERT INTO users (first_name, last_name, email, login_method, provider_id, role, is_active)
             VALUES ($1, $2, $3, 'google', $4, 'patient', true)
             RETURNING id, first_name, last_name, role, login_method;`,
            [givenName, familyName || null, email, sub]
        );

        const newUser = userInsert.rows[0];

        // Insert into patient_profiles
        await client.query(
            `INSERT INTO patient_profiles (user_id) VALUES ($1);`,
            [newUser.id]
        );

        await client.query("COMMIT;");

        // Issue JWT Token
        const token = jwt.sign(
            { sub: newUser.id, role: newUser.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({
            message: "Google registration successful",
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
        console.error("Error in handleGoogleCallback:", error.message);
        return res.status(500).json({
            message: error.message.includes("Google")
                ? error.message
                : "Internal server error during Google authentication",
        });
    } finally {
        client.release();
    }
}


// ==================================================
// SHARED AUTHENTICATED USER CONTROLLER
// ==================================================

/**
 * 11. Get Authenticated Patient Info
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

// ==================================================
// DOCTOR AUTHENTICATION CONTROLLERS
// ==================================================

/**
 * 12. Doctor Login via Email + Password
 * POST /api/auth/doctor/login
 */
async function loginDoctor(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Missing required fields: email and password are required.",
            });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Invalid email address format.",
            });
        }

        // Query user and doctor profile
        const userResult = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.role, u.login_method, u.is_active,
                    d.user_id AS doctor_profile_id, d.verification_status
             FROM users u
             LEFT JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.email = $1;`,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const user = userResult.rows[0];

        // Security check: Must have role = 'doctor'
        if (user.role !== "doctor") {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        // Security check: Must be active
        if (!user.is_active) {
            return res.status(403).json({
                message: "Doctor account is inactive.",
            });
        }

        // Security check: Doctor profile must exist
        if (!user.doctor_profile_id) {
            return res.status(403).json({
                message: "Doctor profile not found.",
            });
        }

        // Security check: Verification status must equal 'verified'
        if (user.verification_status !== "verified") {
            return res.status(403).json({
                message: `Doctor account verification status is ${user.verification_status}. Access restricted to verified doctors.`,
            });
        }

        // Verify password hash
        if (!user.password_hash) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        // Issue standard MediKiosk JWT token
        const token = jwt.sign(
            { sub: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            message: "Doctor login successful",
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
        console.error("Error in loginDoctor:", error.message);
        return res.status(500).json({
            message: "Internal server error during doctor login",
        });
    }
}

module.exports = {
    registerPhone,
    verifyPhone,
    loginPhone,
    verifyLoginPhone,
    registerEmail,
    verifyEmail,
    loginEmail,
    verifyLoginEmail,
    initiateGoogleAuth,
    handleGoogleCallback,
    getMe,
    loginDoctor,
};
