const express = require("express");
const cors = require("cors");
require("dotenv").config();

const cookieParser = require("cookie-parser");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const documentRoutes = require("./routes/documentRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const staffRoutes = require("./routes/staffRoutes");
const receptionistRoutes = require("./routes/receptionistRoutes");
const patientRoutes = require("./routes/patientRoutes");
const ttsRoutes = require("./routes/ttsRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const teleconsultRoutes = require("./routes/teleconsultRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
    "https://sih2026-blond.vercel.app",
    "https://sih2026.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith(".vercel.app") ||
                origin.endsWith(".onrender.com") ||
                (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
            ) {
                return callback(null, true);
            }
            return callback(null, true);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
);
app.use(express.json());
app.use(cookieParser());

// Mount API Routers
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/teleconsult", teleconsultRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/doctor/staff", staffRoutes);
app.use("/api/receptionist", receptionistRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "MediKiosk Backend is running 🚀",
        services: [
            "/api/auth",
            "/api/appointments",
            "/api/sessions",
            "/api/documents",
            "/api/doctor"
        ]
    });
});

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            server: "ok",
            database: "connected",
            timestamp: result.rows[0].now,
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            server: "ok",
            database: "disconnected",
        });
    }
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// Only listen if not imported by test suites
if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`MediKiosk server running on port ${PORT}`);
    });
}

module.exports = app;