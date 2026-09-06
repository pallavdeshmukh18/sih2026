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
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Mount API Routers
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/doctor/staff", staffRoutes);

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