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
