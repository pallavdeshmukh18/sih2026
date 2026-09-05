const crypto = require("crypto");

/**
 * In-memory single-use exchange code store
 * Key: exchangeCode (64-char hex string)
 * Value: { payload: { token, user }, expiresAt: number }
 */
const exchangeCodes = new Map();

// Automatic cleanup interval for expired, unconsumed exchange codes (every 60s)
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [code, record] of exchangeCodes.entries()) {
        if (now > record.expiresAt) {
            exchangeCodes.delete(code);
        }
    }
}, 60000);

if (cleanupInterval.unref) {
    cleanupInterval.unref();
}

/**
 * Creates a short-lived (2 minutes) single-use exchange code for Google OAuth payload.
 * @param {object} payload - { token, user }
 * @returns {string} exchangeCode
 */
function createExchangeCode(payload) {
    const exchangeCode = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes TTL

    exchangeCodes.set(exchangeCode, {
        payload,
        expiresAt,
    });

    return exchangeCode;
}

/**
 * Consumes an exchange code atomically (single-use).
 * @param {string} code - Cryptographic exchange code hex string
 * @returns {{ success: boolean, payload?: object, reason?: string }}
 */
function consumeExchangeCode(code) {
    if (!code || typeof code !== "string") {
        return { success: false, reason: "INVALID" };
    }

    const record = exchangeCodes.get(code);

    if (!record) {
        return { success: false, reason: "INVALID" };
    }

    // Atomically delete entry immediately upon consume attempt to guarantee single-use / replay protection
    exchangeCodes.delete(code);

    if (Date.now() > record.expiresAt) {
        return { success: false, reason: "EXPIRED" };
    }

    return { success: true, payload: record.payload };
}

module.exports = {
    createExchangeCode,
    consumeExchangeCode,
};
