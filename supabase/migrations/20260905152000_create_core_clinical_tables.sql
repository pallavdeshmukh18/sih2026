-- ============================================================
-- MEDIKIOSK - CORE CLINICAL TABLES
-- Migration: 20260905152000
-- ============================================================

-- ============================================================
-- 1. APPOINTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Patient and doctor come from the identity/profile tables
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,

    scheduled_at TIMESTAMPTZ NOT NULL,

    duration_minutes INTEGER NOT NULL DEFAULT 30,

    appointment_type VARCHAR(20) NOT NULL DEFAULT 'in_person',

    location TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    reason TEXT,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Patient must exist
    CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient_profiles(user_id)
        ON DELETE RESTRICT,

    -- Doctor must exist
    CONSTRAINT fk_appointments_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctor_profiles(user_id)
        ON DELETE RESTRICT,

    -- Appointment duration must be reasonable
    CONSTRAINT chk_appointments_duration
        CHECK (
            duration_minutes > 0
            AND duration_minutes <= 480
        ),

    -- Allowed appointment types
    CONSTRAINT chk_appointments_type
        CHECK (
            appointment_type IN (
                'in_person',
                'video',
                'follow_up'
            )
        ),

    -- Allowed appointment statuses
    CONSTRAINT chk_appointments_status
        CHECK (
            status IN (
                'scheduled',
                'confirmed',
                'completed',
                'cancelled',
                'no_show'
            )
        )
);


-- ============================================================
-- APPOINTMENT INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_patient
    ON appointments(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor
    ON appointments(doctor_id);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at
    ON appointments(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_scheduled
    ON appointments(patient_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_scheduled
    ON appointments(doctor_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON appointments(status);


-- ============================================================
-- APPOINTMENT UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. CONSULTATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- One appointment can have at most one consultation
    appointment_id UUID NOT NULL UNIQUE,

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ,

    chief_complaint TEXT,

    clinical_notes TEXT,

    diagnosis TEXT,

    treatment_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Consultation must belong to an appointment
    CONSTRAINT fk_consultations_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE RESTRICT,

    -- End time cannot be before start time
    CONSTRAINT chk_consultations_time
        CHECK (
            ended_at IS NULL
            OR started_at IS NULL
            OR ended_at >= started_at
        )
);


-- ============================================================
-- CONSULTATION UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_consultations_updated_at
BEFORE UPDATE ON consultations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. MEDICAL HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_id UUID NOT NULL,

    category VARCHAR(30) NOT NULL DEFAULT 'condition',

    condition VARCHAR(255) NOT NULL,

    description TEXT,

    diagnosed_at DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Medical history must belong to a patient
    CONSTRAINT fk_medical_history_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient_profiles(user_id)
        ON DELETE RESTRICT,

    -- Allowed history categories
    CONSTRAINT chk_medical_history_category
        CHECK (
            category IN (
                'condition',
                'allergy',
                'surgery',
                'hospitalization',
                'family_history',
                'other'
            )
        ),

    -- Allowed history statuses
    CONSTRAINT chk_medical_history_status
        CHECK (
            status IN (
                'active',
                'resolved',
                'inactive'
            )
        )
);


-- ============================================================
-- MEDICAL HISTORY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_medical_history_patient
    ON medical_history(patient_id);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient_status
    ON medical_history(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient_category
    ON medical_history(patient_id, category);

CREATE INDEX IF NOT EXISTS idx_medical_history_diagnosed_at
    ON medical_history(diagnosed_at);


-- ============================================================
-- MEDICAL HISTORY UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_medical_history_updated_at
BEFORE UPDATE ON medical_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();