const nodemailer = require("nodemailer");

/**
 * Creates and returns the Nodemailer transporter instance using environment variables.
 */
function createTransporter() {
    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
}

/**
 * Sends a passwordless verification OTP code via Email using Nodemailer (Gmail SMTP).
 * Never logs the OTP or credentials.
 */
async function sendEmailOTP(email, otp) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: EMAIL_USER and EMAIL_APP_PASSWORD are required in production mode.");
        }
        console.log(`[DEV FALLBACK] Email credentials missing in .env. Skipping SMTP dispatch for ${email}.`);
        return true;
    }

    const transporter = createTransporter();

    const mailOptions = {
        from: `"MediKiosk" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "MediKiosk Verification Code",
        text: `Your MediKiosk verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this code, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2c3e50; margin-top: 0;">MediKiosk Verification Code</h2>
                <p style="font-size: 16px; color: #333;">Your MediKiosk verification code is:</p>
                <div style="background-color: #f4f6f7; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2980b9; padding: 12px 20px; text-align: center; border-radius: 6px; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="font-size: 14px; color: #7f8c8d;">This code expires in <strong>5 minutes</strong>.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #bdc3c7;">If you did not request this code, please ignore this email.</p>
            </div>
        `,
    };

    try {
        console.log("Email OTP request initiated");
        await transporter.sendMail(mailOptions);
        console.log("Email OTP sent successfully");
        return true;
    } catch (error) {
        console.error("Failed to send email via SMTP:", error.message);
        throw new Error("Unable to send verification email. Please check credentials or try again later.");
    }
}

module.exports = {
    sendEmailOTP,
};
