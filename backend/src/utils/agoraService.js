const { RtcTokenBuilder, RtcRole } = require("agora-token");

/**
 * Agora Token Generator Service
 * Generates secure Token007 RTC tokens for Doctor & Patient video/voice sessions.
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
        const appId = (process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID || "fd374bd20e2e4cec988fc77c63f8eb38").trim();
        const appCertificate = (process.env.AGORA_APP_CERTIFICATE || "").trim();

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;
        const numericUid = typeof uid === "number" && !isNaN(uid) && uid > 0 ? uid : 0;

        // If no app certificate is supplied, return null token for testing mode
        if (!appCertificate) {
            console.warn("[AgoraService] AGORA_APP_CERTIFICATE is not configured in backend/.env.");
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
            const rtcRole = role === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
            // Build Universal Token007 for Agora Web SDK v4
            // Passing uid = 0 builds a wildcard token that permits any UID to join and publish in the specified channel securely
            const token = RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                channelName,
                0,
                rtcRole,
                expireTimeInSeconds,
                expireTimeInSeconds
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
            console.error("Agora Token Generation Error:", error.message);
            return {
                appId,
                channelName,
                token: null,
                uid: numericUid,
                expiresAt: privilegeExpiredTs,
                isTestingMode: true,
            };
        }
    }
}

module.exports = AgoraService;

