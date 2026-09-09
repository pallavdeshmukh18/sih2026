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

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;