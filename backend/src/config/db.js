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

// Ensure graveyard table and policy column exist
pool.query(`
    CREATE TABLE IF NOT EXISTS patient_graveyard_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('document', 'medical_history', 'clinical_session', 'consultation')),
        source_id UUID NOT NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        archive_mode VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (archive_mode IN ('manual', 'automatic')),
        archived_reason TEXT,
        archived_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_patient_source UNIQUE (patient_id, source_type, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_graveyard_lookup ON patient_graveyard_items (patient_id, source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_graveyard_patient ON patient_graveyard_items (patient_id, archived_at DESC);
    ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS graveyard_retention_policy VARCHAR(20) DEFAULT '1_year';
`).catch((err) => {
    console.warn("patient_graveyard startup check:", err.message);
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;