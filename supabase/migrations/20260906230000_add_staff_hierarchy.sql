-- ================================================================
-- Migration: Staff Hierarchy Support
-- Run this once against your PostgreSQL database.
-- ================================================================

-- 1. Add `created_by_doctor_id` to the users table so that staff accounts
--    are linked to the doctor (superadmin) who created them.
--    Uses UUID to match the users.id primary key type.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_by_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add a comment for documentation
COMMENT ON COLUMN users.created_by_doctor_id IS 
  'FK to the doctor user who created this staff account. NULL for patients and standalone doctors.';

-- 3. Create an index for fast lookups when a doctor fetches their staff list
CREATE INDEX IF NOT EXISTS idx_users_created_by_doctor 
ON users(created_by_doctor_id) 
WHERE created_by_doctor_id IS NOT NULL;
