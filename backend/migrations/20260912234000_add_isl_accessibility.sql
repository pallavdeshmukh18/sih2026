-- Migration: Add Indian Sign Language (ISL) support to patient_profiles

-- 1. Add isl_enabled boolean column
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS isl_enabled BOOLEAN DEFAULT FALSE;

-- 2. Update check constraint to allow 'sign_language'
ALTER TABLE patient_profiles
DROP CONSTRAINT IF EXISTS chk_patient_profiles_accessibility;

ALTER TABLE patient_profiles
ADD CONSTRAINT chk_patient_profiles_accessibility
CHECK (
    accessibility_preference IS NULL OR 
    accessibility_preference IN ('none', 'large_text', 'voice_guidance', 'hearing_assistance', 'sign_language')
);
