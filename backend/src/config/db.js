const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : {
        // Preserve existing local development connectivity; deployments verify TLS.
        rejectUnauthorized: process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
        ...(process.env.DATABASE_SSL_CA && { ca: process.env.DATABASE_SSL_CA }),
    },
    connectionTimeoutMillis: 10000,
});

pool.on("connect", () => {
    console.log("PostgreSQL database connected ✅");
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;