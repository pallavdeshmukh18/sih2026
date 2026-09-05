/**
 * Normalizes email address input by trimming whitespace and converting to lowercase.
 */
function normalizeEmail(email) {
    if (!email) return "";
    return String(email).trim().toLowerCase();
}

/**
 * Validates whether the email format is valid.
 */
function isValidEmail(email) {
    const normalized = normalizeEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(normalized);
}

module.exports = {
    normalizeEmail,
    isValidEmail,
};
