/**
 * Normalizes phone number input to standard E.164 format (+91XXXXXXXXXX).
 * Strips whitespace, hyphens, and leading zero for Indian mobile numbers.
 */
function normalizePhone(phone) {
    if (!phone) return "";
    let cleaned = String(phone).trim().replace(/[\s\-()]/g, "");

    // If starts with 0 (e.g. 09876543210), strip 0
    if (/^0[6-9]\d{9}$/.test(cleaned)) {
        cleaned = cleaned.substring(1);
    }

    // If 10 digits starting with 6-9, prepend +91
    if (/^[6-9]\d{9}$/.test(cleaned)) {
        return `+91${cleaned}`;
    }

    // If 12 digits starting with 91, prepend +
    if (/^91[6-9]\d{9}$/.test(cleaned)) {
        return `+${cleaned}`;
    }

    return cleaned;
}

/**
 * Validates whether the normalized phone is a valid 10-digit Indian mobile number with +91 prefix.
 */
function isValidIndianPhone(phone) {
    const normalized = normalizePhone(phone);
    return /^\+91[6-9]\d{9}$/.test(normalized);
}

module.exports = {
    normalizePhone,
    isValidIndianPhone,
};
