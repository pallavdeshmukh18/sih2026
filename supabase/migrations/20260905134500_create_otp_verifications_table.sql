-- Supabase Migration: 20260905134500_create_otp_verifications_table.sql
-- Description: Create otp_verifications table for OTP-based patient authentication

CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('registration', 'login')),
    otp_hash VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for lookup and expiration checks
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone_purpose ON otp_verifications (phone, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications (expires_at);
