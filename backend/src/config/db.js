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

    CREATE TABLE IF NOT EXISTS teleconsult_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_name VARCHAR(255) NOT NULL UNIQUE,
        call_type VARCHAR(20) NOT NULL DEFAULT 'video',
        status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
        requested_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scheduled_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER DEFAULT 0,
        reason TEXT,
        patient_notes TEXT,
        doctor_notes TEXT,
        prescription TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        teleconsult_id UUID REFERENCES teleconsult_sessions(id) ON DELETE SET NULL,
        consultation_type VARCHAR(20) NOT NULL DEFAULT 'in_person' CHECK (consultation_type IN ('in_person', 'teleconsultation', 'virtual')),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_title VARCHAR(255),
        review_text TEXT NOT NULL,
        is_verified_patient BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor ON doctor_reviews (doctor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_doctor_reviews_patient ON doctor_reviews (patient_id);
    CREATE INDEX IF NOT EXISTS idx_doctor_reviews_appt ON doctor_reviews (appointment_id);
    CREATE INDEX IF NOT EXISTS idx_doctor_reviews_tele ON doctor_reviews (teleconsult_id);

    CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
        discount NUMERIC(10, 2) DEFAULT 0.00,
        tax NUMERIC(10, 2) DEFAULT 0.00,
        total_amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(30) DEFAULT 'Cash',
        service_type VARCHAR(100) DEFAULT 'OPD Consultation Fee',
        notes TEXT,
        refund_amount NUMERIC(10, 2) DEFAULT 0.00,
        refund_reason TEXT,
        paid_at TIMESTAMPTZ,
        refunded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices (patient_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_doctor ON invoices (doctor_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (payment_status);
`).catch((err) => {
    console.warn("startup database check:", err.message);
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;