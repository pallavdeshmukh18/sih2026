-- ============================================================
-- MEDIKIOSK - PATIENT DOCTOR RELATIONSHIPS & QR PAIRING TOKENS
-- Migration: 20260908183000
-- ============================================================

-- 1. PATIENT DOCTOR RELATIONSHIPS TABLE
CREATE TABLE IF NOT EXISTS patient_doctor_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    consent_method VARCHAR(30) NOT NULL DEFAULT 'qr_scan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pdr_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient_profiles(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pdr_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctor_profiles(user_id)
        ON DELETE CASCADE,

    CONSTRAINT unq_patient_doctor_pair
        UNIQUE (patient_id, doctor_id),

    CONSTRAINT chk_pdr_status
        CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_pdr_patient ON patient_doctor_relationships(patient_id);
CREATE INDEX IF NOT EXISTS idx_pdr_doctor ON patient_doctor_relationships(doctor_id);
CREATE INDEX IF NOT EXISTS idx_pdr_status ON patient_doctor_relationships(status);

-- 2. PATIENT QR PAIRING TOKENS TABLE
CREATE TABLE IF NOT EXISTS patient_qr_pairing_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_display_code VARCHAR(12) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by_doctor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pqpt_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient_profiles(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pqpt_doctor
        FOREIGN KEY (used_by_doctor_id)
        REFERENCES doctor_profiles(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pqpt_token_hash ON patient_qr_pairing_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pqpt_display_code ON patient_qr_pairing_tokens(token_display_code);
CREATE INDEX IF NOT EXISTS idx_pqpt_patient ON patient_qr_pairing_tokens(patient_id);
