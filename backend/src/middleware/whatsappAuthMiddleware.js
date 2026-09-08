/**
 * WhatsApp Server-to-Server Authentication Middleware
 *
 * Verifies that incoming requests from the WhatsApp Bot originate from a
 * trusted internal service by validating the X-WhatsApp-Service-Key header.
 *
 * Security Requirements:
 * - Secret is read exclusively from process.env.WHATSAPP_SERVICE_KEY
 * - The secret is NEVER logged or echoed back in responses
 * - Missing header results in 401 Unauthorized
 * - Invalid secret results in 403 Forbidden
 */

function authenticateWhatsAppService(req, res, next) {
    const expectedKey = process.env.WHATSAPP_SERVICE_KEY;
    const providedKey = req.headers["x-whatsapp-service-key"];

    if (!providedKey) {
        return res.status(401).json({
            success: false,
            message: "Missing X-WhatsApp-Service-Key header.",
        });
    }

    if (!expectedKey || providedKey !== expectedKey) {
        return res.status(403).json({
            success: false,
            message: "Invalid X-WhatsApp-Service-Key.",
        });
    }

    next();
}

module.exports = authenticateWhatsAppService;
