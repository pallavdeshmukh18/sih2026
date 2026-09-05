const { google } = require("googleapis");

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5001/api/auth/patient/google/callback";

    if (!clientId || !clientSecret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production mode.");
        }
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth 2.0 authorization URL with CSRF state token.
 */
function getGoogleAuthUrl(state) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        if (process.env.NODE_ENV !== "production") {
            console.log("[DEV ONLY] GOOGLE_CLIENT_ID missing. Returning mock consent URL.");
            return `http://localhost:5001/api/auth/patient/google/callback?code=mock_code_default&state=${state}`;
        }
    }

    const oauth2Client = getOAuth2Client();

    const scopes = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
    ];

    return oauth2Client.generateAuthUrl({
        access_type: "online",
        scope: scopes,
        state: state,
        prompt: "select_account",
    });
}

/**
 * Exchanges the Google authorization code for tokens and verifies the Google ID Token.
 * Returns verified user profile claims.
 */
async function verifyGoogleCode(code) {
    // Development / Test mock code support
    if (process.env.NODE_ENV !== "production" && code && code.startsWith("mock_code_")) {
        console.log("[DEV/TEST] Processing mock Google authorization code...");
        const parts = code.split(":");
        const sub = parts[1] || "google_sub_mock_123456";
        const email = parts[2] || "mock.google.patient@gmail.com";
        const givenName = parts[3] || "GoogleGiven";
        const familyName = parts[4] || "GoogleFamily";

        return {
            sub,
            email,
            emailVerified: true,
            givenName,
            familyName,
            picture: null,
        };
    }

    const oauth2Client = getOAuth2Client();

    try {
        console.log("Google OAuth code exchange initiated");
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens || !tokens.id_token) {
            console.error("Google OAuth token exchange failed: missing id_token");
            throw new Error("Failed to obtain ID token from Google.");
        }

        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            console.error("Invalid Google ID token payload");
            throw new Error("Invalid Google authentication payload.");
        }

        const emailVerified =
            payload.email_verified === true || payload.email_verified === "true";

        if (!emailVerified) {
            console.error("Google account email is not verified");
            throw new Error("Google email address is not verified.");
        }

        console.log("Google ID token verified successfully");

        return {
            sub: payload.sub,
            email: payload.email,
            emailVerified: emailVerified,
            givenName: payload.given_name || payload.name || "Google User",
            familyName: payload.family_name || "",
            picture: payload.picture || null,
        };
    } catch (err) {
        if (
            err.message.includes("Failed to obtain ID token") ||
            err.message.includes("not verified")
        ) {
            throw err;
        }
        console.error("Error verifying Google OAuth code:", err.message);
        throw new Error("Google authentication failed. Please try again.");
    }
}

module.exports = {
    getGoogleAuthUrl,
    verifyGoogleCode,
};
