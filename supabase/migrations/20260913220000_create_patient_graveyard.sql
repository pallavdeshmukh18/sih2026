-- Migration: 20260913220000_create_patient_graveyard.sql
-- Description: Create patient_graveyard_items table and add graveyard_retention_policy to patient_profiles

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

-- Policy configuration on patient profiles
ALTER TABLE patient_profiles 
ADD COLUMN IF NOT EXISTS graveyard_retention_policy VARCHAR(20) DEFAULT '1_year';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_graveyard_retention_policy'
    ) THEN
        ALTER TABLE patient_profiles
        ADD CONSTRAINT chk_graveyard_retention_policy
        CHECK (
            graveyard_retention_policy IS NULL OR 
            graveyard_retention_policy IN ('never', '3_months', '6_months', '1_year', '2_years', '5_years')
        );
    END IF;
END $$;
