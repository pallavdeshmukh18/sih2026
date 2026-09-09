-- ============================================================
-- MEDIKIOSK - TELECONSULTATION SESSIONS & MESSAGES MIGRATION
-- Migration: 20260909100000
-- ============================================================

-- 1. TELECONSULTATION SESSIONS (Separate from physical appointments)
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_teleconsult_call_type CHECK (
        call_type IN ('video', 'voice')
    ),

    CONSTRAINT chk_teleconsult_status CHECK (
        status IN ('pending_approval', 'approved', 'rejected', 'in_call', 'completed', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_teleconsult_patient_id ON teleconsult_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_teleconsult_doctor_id ON teleconsult_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_teleconsult_status ON teleconsult_sessions(status);
CREATE INDEX IF NOT EXISTS idx_teleconsult_channel ON teleconsult_sessions(channel_name);
CREATE INDEX IF NOT EXISTS idx_teleconsult_created_at ON teleconsult_sessions(created_at DESC);

-- 2. TELECONSULTATION MESSAGES
CREATE TABLE IF NOT EXISTS teleconsult_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES teleconsult_sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_teleconsult_msg_role CHECK (
        sender_role IN ('doctor', 'patient', 'system')
    ),

    CONSTRAINT chk_teleconsult_msg_type CHECK (
        message_type IN ('text', 'prescription', 'system')
    )
);

CREATE INDEX IF NOT EXISTS idx_teleconsult_msg_session ON teleconsult_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_teleconsult_msg_created_at ON teleconsult_messages(created_at ASC);
