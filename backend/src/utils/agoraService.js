const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

/**
 * Agora Token Generator Service
 * Generates secure RTC tokens for Doctor & Patient video/voice sessions.
 */
class AgoraService {
    /**
     * Generate RTC Token for a given channel
     * @param {string} channelName Channel name for the call session
     * @param {number} uid User UID (positive integer)
     * @param {string} role 'publisher' | 'subscriber'
     * @param {number} expireTimeInSeconds Expiration duration in seconds (default 24h = 86400)
     */
    static generateRtcToken(channelName, uid = 0, role = "publisher", expireTimeInSeconds = 86400) {
        const appId = (process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID || "").trim();
        const appCertificate = (process.env.AGORA_APP_CERTIFICATE || "").trim();

        if (!appId || (!appCertificate && process.env.NODE_ENV === "production")) {
            throw Object.assign(new Error("Secure calling is not configured."), { statusCode: 503 });
        }
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;
        const numericUid = typeof uid === "number" && !isNaN(uid) && uid > 0 ? uid : 0;

        // If no app certificate is supplied (e.g. Testing App ID mode), return null token
        if (!appCertificate) {
            return {
                appId,
                channelName,
                token: null,
                uid: numericUid,
                expiresAt: privilegeExpiredTs,
                isTestingMode: true,
            };
        }

        try {
            // Build Universal Token006 for Agora Web SDK
            const token = RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                channelName,
                numericUid,
                role === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER,
                privilegeExpiredTs
            );

            return {
                appId,
                channelName,
                token,
                uid: numericUid,
                expiresAt: privilegeExpiredTs,
                isTestingMode: false,
            };
        } catch (error) {
            console.error("Agora Token006 Generation Error:", error.message);
            throw Object.assign(new Error("Call authorization failed."), { statusCode: 503 });
        }
    }
}

module.exports = AgoraService;



