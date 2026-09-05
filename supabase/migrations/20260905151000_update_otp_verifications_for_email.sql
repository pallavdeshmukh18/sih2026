-- Supabase Migration: 20260905151000_update_otp_verifications_for_email.sql
-- Description: Extend otp_verifications table to support email OTPs alongside phone OTPs

-- 1. Make phone column nullable
ALTER TABLE otp_verifications ALTER COLUMN phone DROP NOT NULL;

-- 2. Add email and identifier_type columns if they do not exist
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS identifier_type VARCHAR(20) DEFAULT 'phone';

-- 3. Add CHECK constraint requiring at least phone OR email
ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS chk_otp_verifications_contact;
ALTER TABLE otp_verifications ADD CONSTRAINT chk_otp_verifications_contact 
CHECK (phone IS NOT NULL OR email IS NOT NULL);

-- 4. Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_otp_verifications_email_purpose ON otp_verifications (email, purpose);
