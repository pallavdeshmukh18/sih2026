const crypto = require("crypto");

/**
 * Validates and retrieves the OTP secret salt.
 * Throws a fatal error in production if OTP_SECRET is missing.
 */
function getOtpSecret() {
    if (process.env.NODE_ENV === "production") {
        if (!process.env.OTP_SECRET || process.env.OTP_SECRET.trim() === "") {
            throw new Error("FATAL: OTP_SECRET environment variable is required in production mode.");
        }
        return process.env.OTP_SECRET;
    }
    return process.env.OTP_SECRET || "medikiosk_otp_secret_salt_dev_only";
}

/**
 * Generates a cryptographically secure 6-digit OTP string.
 */
function generateOTP() {
    const num = crypto.randomInt(100000, 1000000);
    return num.toString();
}

/**
 * Computes a secure SHA-256 HMAC hash of the OTP.
 */
function hashOTP(otp) {
    const secret = getOtpSecret();
    return crypto
        .createHmac("sha256", secret)
        .update(String(otp))
        .digest("hex");
}

/**
 * Verifies if the provided local OTP matches the stored hash in constant time.
 */
function verifyOTP(otp, storedHash) {
    if (!otp || !storedHash) return false;
    const computedHash = hashOTP(otp);
    return crypto.timingSafeEqual(
        Buffer.from(computedHash, "hex"),
        Buffer.from(storedHash, "hex")
    );
}

/**
 * 2Factor.in Real SMS Provider Integration
 */
async function sendOTP2Factor(phone) {
    const apiKey = process.env.TWOFACTOR_API_KEY;

    if (!apiKey) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: TWOFACTOR_API_KEY is missing in production mode.");
        }
        // Dev fallback if TWOFACTOR_API_KEY is omitted
        console.log(`[DEV FALLBACK] 2Factor key missing. Generating mock OTP for ${phone}.`);
        const mockOtp = generateOTP();
        if (process.env.NODE_ENV !== "production") {
            console.log(`[DEV ONLY] 🔑 Mock OTP for ${phone}: ${mockOtp}`);
        }
        return { isProvider: false, mockOtp };
    }

    // Clean phone number format for 2Factor (strip non-digits, e.g. +919876543210 -> 919876543210)
    const cleanPhone = String(phone).replace(/\D/g, "");
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/AUTOGEN`;

    console.log("2Factor OTP request initiated");
    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
            console.error("2Factor HTTP response failed with status:", response.status);
            throw new Error("Unable to send OTP. Please try again.");
        }

        const data = await response.json();
        if (data && data.Status === "Success" && data.Details) {
            console.log("2Factor OTP request succeeded");
            return { isProvider: true, sessionId: data.Details };
        } else {
            console.error("2Factor returned non-success response state");
            throw new Error("Unable to send OTP via SMS provider. Please try again.");
        }
    } catch (err) {
        if (err.message.includes("Unable to send OTP")) {
            throw err;
        }
        console.error("Network error during 2Factor OTP request:", err.message);
        throw new Error("Unable to send OTP due to network issues. Please try again.");
    }
}

async function verifyOTP2Factor(sessionId, otp) {
    const apiKey = process.env.TWOFACTOR_API_KEY;
    if (!apiKey || !sessionId) return false;

    const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
            console.error("2Factor verification HTTP failed with status:", response.status);
            return false;
        }

        const data = await response.json();
        if (data && data.Status === "Success" && data.Details === "OTP Matched") {
            console.log("2Factor OTP verification succeeded");
            return true;
        }
        return false;
    } catch (err) {
        console.error("Network error during 2Factor verification check");
        return false;
    }
}

module.exports = {
    generateOTP,
    hashOTP,
    verifyOTP,
    getOtpSecret,
    sendOTP2Factor,
    verifyOTP2Factor,
};
