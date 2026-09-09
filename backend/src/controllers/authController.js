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
const oauthExchangeService = require("../services/oauthExchangeService");

const { JWT_SECRET } = require("../config/auth");
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

/**
 * 4b. Request Phone Linking OTP for Authenticated Patient
 * POST /api/auth/patient/link-phone/request
 */
async function requestPhoneLink(req, res) {
    try {
        const userId = req.user.id;
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                message: "Phone number is required.",
            });
        }

        const normalizedPhone = normalizePhone(phone);
        if (!isValidIndianPhone(normalizedPhone)) {
            return res.status(400).json({
                message: "Invalid Indian phone number format. Must be 10 digits (e.g. +919876543210).",
            });
        }

        // Check if phone number is already registered to another user
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE phone = $1 AND id != $2;",
            [normalizedPhone, userId]
        );
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                message: "Phone number is already linked to another account.",
            });
        }

        // 1. Cooldown Check: Enforce 60-second wait between consecutive OTP resends
        const cooldownCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'phone_link' AND created_at > NOW() - INTERVAL '60 seconds';`,
            [normalizedPhone]
        );
        if (parseInt(cooldownCheck.rows[0].count, 10) > 0) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another OTP.",
            });
        }

        // 2. Sliding Window Rate Limiting Check: Max 3 OTP requests per 10 mins
        const rateCheck = await pool.query(
            `SELECT COUNT(*) FROM otp_verifications 
             WHERE phone = $1 AND purpose = 'phone_link' AND created_at > NOW() - INTERVAL '10 minutes';`,
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
               AND purpose = 'phone_link'
               AND verified_at IS NULL
               AND expires_at > NOW();`,
            [normalizedPhone]
        );

        // Send OTP via 2Factor Provider or local Mock
        const providerRes = await sendOTP2Factor(normalizedPhone);

        let hashedOtp;
        let metadata;

        if (providerRes.isProvider) {
            hashedOtp = hashOTP("2FACTOR_PROVIDER_MANAGED");
            metadata = {
                provider: "2factor",
                providerSessionId: providerRes.sessionId,
                userId,
            };
        } else {
            hashedOtp = hashOTP(providerRes.mockOtp);
            metadata = {
                provider: "dev_mock",
                userId,
            };
        }

        const result = await pool.query(
            `INSERT INTO otp_verifications (phone, identifier_type, purpose, otp_hash, metadata, expires_at)
             VALUES ($1, 'phone', 'phone_link', $2, $3, NOW() + INTERVAL '5 minutes')
             RETURNING id;`,
            [normalizedPhone, hashedOtp, JSON.stringify(metadata)]
        );

        const verificationId = result.rows[0].id;

        return res.status(200).json({
            message: "OTP sent successfully",
            verificationId,
            mockOtp: providerRes.isProvider ? undefined : providerRes.mockOtp,
        });
    } catch (error) {
        console.error("Error in requestPhoneLink:", error.message);
        return res.status(error.message.includes("Unable to send OTP") ? 502 : 500).json({
            message: error.message.includes("Unable to send OTP")
                ? error.message
                : "Internal server error requesting phone link OTP",
        });
    }
}

/**
 * 4c. Verify Phone Linking OTP & Update User Phone
 * POST /api/auth/patient/link-phone/verify
 */
async function verifyPhoneLink(req, res) {
    try {
        const userId = req.user.id;
        const { verificationId, otp } = req.body;

        if (!verificationId || !otp) {
            return res.status(400).json({
                message: "Missing required fields: verificationId, otp",
            });
        }

        const otpResult = await pool.query(
            `SELECT * FROM otp_verifications WHERE id = $1 AND purpose = 'phone_link';`,
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

        if (record.metadata && record.metadata.userId && record.metadata.userId !== userId) {
            return res.status(403).json({
                message: "Unauthorized verification record.",
            });
        }

        // Increment attempt count
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

        // Mark OTP as verified
        await pool.query(
            `UPDATE otp_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1;`,
            [verificationId]
        );

        // Update User's phone in users table
        await pool.query(
            `UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
            [record.phone, userId]
        );

        return res.status(200).json({
            success: true,
            message: "Phone number linked successfully",
            phone: record.phone,
        });
    } catch (error) {
        console.error("Error in verifyPhoneLink:", error.message);
        return res.status(500).json({
            message: "Internal server error verifying phone link OTP",
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
 * Generate a cryptographically signed HMAC-SHA256 OAuth state token
 */
function generateOAuthState() {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const secret = JWT_SECRET || process.env.JWT_SECRET || "medikiosk_oauth_state_secret_2026";
    const payload = `${timestamp}:${nonce}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return `${timestamp}.${nonce}.${signature}`;
}

/**
 * Verify OAuth state token (via cookie match or cryptographic HMAC signature)
 */
function verifyOAuthState(state, storedCookieState = null) {
    if (!state) return false;

    // If cookie matches returned state, accept immediately
    if (storedCookieState && state === storedCookieState) {
        return true;
    }

    // Verify cryptographic signature and timestamp expiration
    const parts = state.split(".");
    if (parts.length !== 3) return false;

    const [timestampStr, nonce, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Reject state tokens older than 15 minutes or from the future
    const now = Date.now();
    if (now - timestamp > 15 * 60 * 1000 || timestamp - now > 60 * 1000) {
        return false;
    }

    const secret = JWT_SECRET || process.env.JWT_SECRET || "medikiosk_oauth_state_secret_2026";
    const payload = `${timestampStr}:${nonce}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    try {
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expectedSignature, "hex");
        if (sigBuf.length !== expBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

/**
 * 9. Initiate Google OAuth 2.0 Consent Flow
 * GET /api/auth/patient/google
 */
async function initiateGoogleAuth(req, res) {
    try {
        const state = generateOAuthState();

        res.cookie("google_oauth_state", state, {
            httpOnly: true,
            maxAge: 15 * 60 * 1000, // 15 minutes
            sameSite: "none",
            secure: true,
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
        try {
            res.clearCookie("google_oauth_state", {
                httpOnly: true,
                sameSite: "none",
                secure: true,
            });
        } catch (e) {}

        if (!state || !verifyOAuthState(state, storedState)) {
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

        const defaultFrontendUrl = process.env.FRONTEND_URL || "https://sih2026-blond.vercel.app";

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

            const exchangeCode = oauthExchangeService.createExchangeCode({
                token,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    loginMethod: user.login_method,
                },
            });

            return res.redirect(`${defaultFrontendUrl}/auth/google/callback?code=${exchangeCode}`);
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

        const exchangeCode = oauthExchangeService.createExchangeCode({
            token,
            user: {
                id: newUser.id,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                loginMethod: newUser.login_method,
            },
        });

        return res.redirect(`${defaultFrontendUrl}/auth/google/callback?code=${exchangeCode}`);
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

/**
 * 11. Exchange Google OAuth Single-Use Code for JWT Token and User Profile
 * POST /api/auth/patient/google/exchange
 */
async function exchangeGoogleCode(req, res) {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                message: "Authorization code is required.",
            });
        }

        const result = oauthExchangeService.consumeExchangeCode(code);

        if (!result.success) {
            if (result.reason === "EXPIRED") {
                return res.status(400).json({
                    message: "Exchange code has expired. Please try logging in again.",
                });
            }
            return res.status(400).json({
                message: "Invalid or expired exchange code.",
            });
        }

        return res.status(200).json({
            message: "Google authentication successful",
            token: result.payload.token,
            user: result.payload.user,
        });
    } catch (error) {
        console.error("Error in exchangeGoogleCode:", error.message);
        return res.status(500).json({
            message: "Internal server error during exchange code consumption",
        });
    }
}


// ==================================================
// SHARED AUTHENTICATED USER CONTROLLER
// ==================================================

/**
 * 11. Get Authenticated User Info (Patient, Doctor, Receptionist, Staff)
 * GET /api/auth/me
 */
async function getMe(req, res) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.role, u.login_method, u.email, u.phone, u.created_by_doctor_id,
                    p.date_of_birth, p.gender, p.abha_id,
                    p.state, p.preferred_language, p.interaction_mode, p.accessibility_preference,
                    d.registration_number, d.specialization, d.department AS doctor_department, d.verification_status
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             LEFT JOIN doctor_profiles d ON u.id = d.user_id
             WHERE u.id = $1 AND u.is_active = true;`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found or account inactive",
            });
        }

        const row = result.rows[0];
        const isCompleted = !!(row.state && row.preferred_language && row.interaction_mode && row.accessibility_preference);

        return res.status(200).json({
            user: {
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                phone: row.phone,
                phoneVerified: !!row.phone,
                role: row.role,
                loginMethod: row.login_method,
                doctorId: row.created_by_doctor_id,
            },
            profile: {
                dateOfBirth: row.date_of_birth,
                gender: row.gender,
                abhaId: row.abha_id,
                registrationNumber: row.registration_number,
                specialization: row.specialization,
                department: row.doctor_department,
                verificationStatus: row.verification_status,
            },
            onboarding: row.role === 'patient' ? {
                state: row.state,
                preferredLanguage: row.preferred_language,
                interactionMode: row.interaction_mode,
                accessibilityPreference: row.accessibility_preference,
                completed: isCompleted
            } : null,
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
 * 12. Doctor Registration via Email + Password
 * POST /api/auth/doctor/register
 */
async function registerDoctor(req, res) {
    try {
        const { firstName, lastName, email, password, registrationNumber, specialization, department } = req.body;

        if (!firstName || !email || !password || !registrationNumber) {
            return res.status(400).json({
                message: "Missing required fields: firstName, email, password, registrationNumber",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters." });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ message: "Invalid email address format." });
        }

        // Check email uniqueness
        const existingEmail = await pool.query(
            "SELECT id FROM users WHERE email = $1;",
            [normalizedEmail]
        );
        if (existingEmail.rows.length > 0) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }

        // Check registration number uniqueness
        const existingReg = await pool.query(
            "SELECT user_id FROM doctor_profiles WHERE registration_number = $1;",
            [registrationNumber]
        );
        if (existingReg.rows.length > 0) {
            return res.status(409).json({ message: "This medical registration number is already in use." });
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // Insert into users
            const userResult = await client.query(
                `INSERT INTO users (first_name, last_name, email, password_hash, role, login_method, is_active)
                 VALUES ($1, $2, $3, $4, 'doctor', 'email', TRUE)
                 RETURNING id, first_name, last_name, email, role;`,
                [firstName, lastName || null, normalizedEmail, passwordHash]
            );

            const newUser = userResult.rows[0];

            // Insert into doctor_profiles (verification_status = 'pending' by default)
            await client.query(
                `INSERT INTO doctor_profiles (user_id, registration_number, specialization, department)
                 VALUES ($1, $2, $3, $4);`,
                [newUser.id, registrationNumber, specialization || null, department || null]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                message: "Doctor account created. Your account is pending verification by the admin.",
                user: {
                    id: newUser.id,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    email: newUser.email,
                    role: newUser.role,
                    verificationStatus: "pending",
                },
            });
        } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error in registerDoctor:", error.message);
        return res.status(500).json({ message: "Internal server error during doctor registration." });
    }
}

/**
 * 13. Doctor Login via Email + Password
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

// ==================================================
// WHATSAPP LINKING & AUTHENTICATION CONTROLLERS
// ==================================================

/**
 * Generate a secure linking token for logged-in user
 * POST /api/auth/whatsapp/token
 */
async function generateWhatsAppToken(req, res) {
    try {
        const userId = req.user.id;

        // Generate a clean 6-character alphanumeric token (e.g. 'E4A9F2')
        const rawBytes = crypto.randomBytes(3);
        const token = rawBytes.toString("hex").toUpperCase();
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        // Invalidate previous unexpired/unused tokens for this user
        await pool.query(
            `UPDATE whatsapp_link_tokens
             SET used = TRUE, used_at = NOW()
             WHERE user_id = $1 AND used = FALSE;`,
            [userId]
        );

        // Store new temporary token with 10-minute expiration (HASH ONLY, NO RAW TOKEN STORED)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await pool.query(
            `INSERT INTO whatsapp_link_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3);`,
            [userId, tokenHash, expiresAt]
        );

        return res.status(200).json({
            success: true,
            token,
            expiresAt: expiresAt.toISOString(),
            message: "WhatsApp linking token generated successfully",
        });
    } catch (error) {
        console.error("Error in generateWhatsAppToken:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error generating WhatsApp token",
        });
    }
}

/**
 * Check if a WhatsApp ID is linked to a MediKiosk account
 * GET /api/auth/whatsapp/status?whatsapp_id=...
 * POST /api/auth/whatsapp/status
 */
async function getWhatsAppStatus(req, res) {
    try {
        const whatsappId = req.query.whatsapp_id || req.body.whatsapp_id;

        if (!whatsappId) {
            return res.status(400).json({
                success: false,
                message: "whatsapp_id query parameter or body field is required",
            });
        }

        const normalizedId = whatsappId.trim();

        const result = await pool.query(
            `SELECT w.user_id, u.first_name, u.last_name, u.role, p.preferred_language AS language,
                    p.accessibility_preference AS accessibility_preference
             FROM whatsapp_accounts w
             JOIN users u ON w.user_id = u.id
             LEFT JOIN patient_profiles p ON w.user_id = p.user_id
             WHERE w.whatsapp_id = $1;`,
            [normalizedId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                linked: false,
            });
        }

        const account = result.rows[0];
        return res.status(200).json({
            linked: true,
            user_id: account.user_id,
            user_name: account.first_name || "Patient",
            role: account.role,
            language: account.language || null,
            accessibility_preference: account.accessibility_preference || "none",
        });
    } catch (error) {
        console.error("Error in getWhatsAppStatus:", error.message);
        return res.status(500).json({
            linked: false,
            message: "Internal server error checking WhatsApp status",
        });
    }
}

/**
 * Link WhatsApp ID using a valid verification token
 * POST /api/auth/whatsapp/link
 * Body: { "whatsapp_id": "string", "token": "string", "language": Optional["string"] }
 */
async function linkWhatsAppAccount(req, res) {
    try {
        const { whatsapp_id, token, language } = req.body;

        if (!whatsapp_id || !token) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: whatsapp_id, token",
            });
        }

        const normalizedId = whatsapp_id.trim();
        const normalizedToken = token.trim().toUpperCase();
        const tokenHash = crypto.createHash("sha256").update(normalizedToken).digest("hex");

        // Verify token strictly by SHA-256 hash, non-expired, and unused
        const tokenQuery = await pool.query(
            `SELECT t.id, t.user_id, t.expires_at, t.used, u.first_name, u.last_name
             FROM whatsapp_link_tokens t
             JOIN users u ON t.user_id = u.id
             WHERE t.token_hash = $1
               AND t.expires_at > NOW()
               AND t.used = FALSE;`,
            [tokenHash]
        );

        if (tokenQuery.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The token entered could not be verified or has expired.",
            });
        }

        const record = tokenQuery.rows[0];

        // Immediately invalidate the temporary token (single use)
        await pool.query(
            `UPDATE whatsapp_link_tokens
             SET used = TRUE, used_at = NOW()
             WHERE id = $1;`,
            [record.id]
        );

        // Upsert permanent account linking association (whatsapp_id -> user_id)
        await pool.query(
            `INSERT INTO whatsapp_accounts (user_id, whatsapp_id)
             VALUES ($1, $2)
             ON CONFLICT (whatsapp_id) DO UPDATE
             SET user_id = EXCLUDED.user_id, updated_at = NOW();`,
            [record.user_id, normalizedId]
        );

        // If language was chosen during linking, persist to patient_profiles.preferred_language
        let finalLanguage = null;
        if (language && typeof language === "string") {
            const cleanLang = language.trim().toLowerCase();
            const allowedLangs = ["en", "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or", "as"];
            if (allowedLangs.includes(cleanLang)) {
                await pool.query(
                    `INSERT INTO patient_profiles (user_id, preferred_language)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id) DO UPDATE
                     SET preferred_language = EXCLUDED.preferred_language, updated_at = NOW();`,
                    [record.user_id, cleanLang]
                );
                finalLanguage = cleanLang;
            }
        }

        // If not explicitly set via linking payload, retrieve existing language if any
        if (!finalLanguage) {
            const profileRes = await pool.query(
                `SELECT preferred_language FROM patient_profiles WHERE user_id = $1;`,
                [record.user_id]
            );
            if (profileRes.rows.length > 0) {
                finalLanguage = profileRes.rows[0].preferred_language || null;
            }
        }

        return res.status(200).json({
            success: true,
            user_id: record.user_id,
            user_name: record.first_name || "Patient",
            language: finalLanguage,
            message: "WhatsApp account linked successfully",
        });
    } catch (error) {
        console.error("Error in linkWhatsAppAccount:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error during WhatsApp linking",
        });
    }
}

/**
 * Update Language for Linked WhatsApp User
 * POST /api/auth/whatsapp/language or POST /api/whatsapp/language
 * Body: { "whatsapp_id": "string", "language": "en" | "hi" | "mr" | "gu" }
 */
async function updateWhatsAppLanguage(req, res) {
    try {
        const { whatsapp_id, language } = req.body;

        if (!whatsapp_id || !language) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: whatsapp_id, language",
            });
        }

        const normalizedId = whatsapp_id.trim();
        const cleanLang = language.trim().toLowerCase();
        const allowedLangs = ["en", "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or", "as"];
        if (!allowedLangs.includes(cleanLang)) {
            return res.status(400).json({
                success: false,
                message: `Invalid language '${cleanLang}'. Allowed: [${allowedLangs.join(", ")}]`,
            });
        }

        // Resolve user_id from whatsapp_accounts
        const accountRes = await pool.query(
            `SELECT user_id FROM whatsapp_accounts WHERE whatsapp_id = $1;`,
            [normalizedId]
        );

        if (accountRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "WhatsApp account is not linked to any user.",
            });
        }

        const userId = accountRes.rows[0].user_id;

        // Persist language to patient_profiles
        await pool.query(
            `INSERT INTO patient_profiles (user_id, preferred_language)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE
             SET preferred_language = EXCLUDED.preferred_language, updated_at = NOW();`,
            [userId, cleanLang]
        );

        return res.status(200).json({
            success: true,
            language: cleanLang,
            message: "Account language updated successfully.",
        });
    } catch (error) {
        console.error("Error in updateWhatsAppLanguage:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error updating WhatsApp language.",
        });
    }
}

/**
 * Get current authenticated user's linked WhatsApp status
 * GET /api/auth/whatsapp/me
 */
async function getWhatsAppMe(req, res) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT whatsapp_id, created_at FROM whatsapp_accounts WHERE user_id = $1;`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                linked: false,
            });
        }

        return res.status(200).json({
            linked: true,
            whatsapp_id: result.rows[0].whatsapp_id,
            linked_at: result.rows[0].created_at,
        });
    } catch (error) {
        console.error("Error in getWhatsAppMe:", error.message);
        return res.status(500).json({
            message: "Internal server error fetching WhatsApp info",
        });
    }
}

/**
 * Unlink WhatsApp for current authenticated user
 * POST /api/auth/whatsapp/unlink
 */
async function unlinkWhatsApp(req, res) {
    try {
        const userId = req.user.id;

        await pool.query(
            `DELETE FROM whatsapp_accounts WHERE user_id = $1;`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "WhatsApp account unlinked successfully",
        });
    } catch (error) {
        console.error("Error in unlinkWhatsApp:", error.message);
        return res.status(500).json({
            message: "Internal server error unlinking WhatsApp",
        });
    }
}

module.exports = {
    registerPhone,
    verifyPhone,
    loginPhone,
    verifyLoginPhone,
    requestPhoneLink,
    verifyPhoneLink,
    registerEmail,
    verifyEmail,
    loginEmail,
    verifyLoginEmail,
    initiateGoogleAuth,
    handleGoogleCallback,
    exchangeGoogleCode,
    getMe,
    registerDoctor,
    loginDoctor,
    generateWhatsAppToken,
    getWhatsAppStatus,
    linkWhatsAppAccount,
    updateWhatsAppLanguage,
    getWhatsAppMe,
    unlinkWhatsApp,
};
