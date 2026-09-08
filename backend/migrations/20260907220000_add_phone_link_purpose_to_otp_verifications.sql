-- Migration: 20260907220000_add_phone_link_purpose_to_otp_verifications.sql
-- Description: Expand otp_verifications purpose check constraint to allow 'phone_link'

ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check 
CHECK (purpose IN ('registration', 'login', 'phone_link'));
