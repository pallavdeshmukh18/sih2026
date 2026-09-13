const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isLocal = !connectionString || connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

let sslConfig = false;
if (process.env.DATABASE_SSL === "disable") {
    sslConfig = false;
} else if (process.env.DATABASE_SSL === "require" || !isLocal || process.env.NODE_ENV === "production" || process.env.RENDER) {
    sslConfig = {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        ...(process.env.DATABASE_SSL_CA && { ca: process.env.DATABASE_SSL_CA }),
    };
}

const pool = new Pool({
    connectionString,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
});

pool.on("connect", () => {
    console.log("PostgreSQL database connected ✅");
});

// Ensure blood_group column exists on patient_profiles
pool.query(`ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);`)
    .catch((err) => {
        console.warn("patient_profiles blood_group check:", err.message);
    });

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;