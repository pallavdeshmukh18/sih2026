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

-- Supabase Migration: 20260905162000_link_clinical_sessions_appointment.sql
-- Description: Enforce appointment linkage on clinical_sessions and consultation linkage

-- 1. Add appointment_id column to clinical_sessions if not exists
ALTER TABLE clinical_sessions 
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE;

-- 2. Add performance index on appointment_id
CREATE INDEX IF NOT EXISTS idx_clinical_sessions_appointment_id 
ON clinical_sessions (appointment_id);

-- 3. Add session_id to consultations table
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES clinical_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_session_id 
ON consultations (session_id);


