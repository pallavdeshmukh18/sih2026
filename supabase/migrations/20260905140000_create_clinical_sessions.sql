-- Supabase Migration: 20260905140000_create_clinical_sessions.sql
-- Description: Create clinical_sessions table for storing adaptive questioning state

CREATE TABLE IF NOT EXISTS clinical_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    consultation_type VARCHAR(20) NOT NULL CHECK (consultation_type IN ('allopathic', 'ayush')),
    chief_complaint VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_sessions_patient_id ON clinical_sessions (patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_sessions_status ON clinical_sessions (status);

-- Trigger for clinical_sessions updated_at
DROP TRIGGER IF EXISTS trg_clinical_sessions_updated_at ON clinical_sessions;
CREATE TRIGGER trg_clinical_sessions_updated_at
BEFORE UPDATE ON clinical_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
