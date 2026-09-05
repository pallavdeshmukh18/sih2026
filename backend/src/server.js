const express = require("express");
const cors = require("cors");
require("dotenv").config();

const cookieParser = require("cookie-parser");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "MediKiosk Backend is running 🚀",
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

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`MediKiosk server running on port ${PORT}`);
});