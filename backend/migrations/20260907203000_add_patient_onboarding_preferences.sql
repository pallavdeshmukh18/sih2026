-- ================================================================
-- Migration: Add Patient Onboarding Preferences to patient_profiles
-- Timestamp: 20260907203000
-- ================================================================

ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10),
ADD COLUMN IF NOT EXISTS interaction_mode VARCHAR(20),
ADD COLUMN IF NOT EXISTS accessibility_preference VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_profiles_language'
    ) THEN
        ALTER TABLE patient_profiles
        ADD CONSTRAINT chk_patient_profiles_language
        CHECK (
            preferred_language IS NULL OR 
            preferred_language IN ('en', 'hi', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'or', 'as')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_profiles_interaction'
    ) THEN
        ALTER TABLE patient_profiles
        ADD CONSTRAINT chk_patient_profiles_interaction
        CHECK (
            interaction_mode IS NULL OR 
            interaction_mode IN ('voice', 'touch', 'voice_touch')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_profiles_accessibility'
    ) THEN
        ALTER TABLE patient_profiles
        ADD CONSTRAINT chk_patient_profiles_accessibility
        CHECK (
            accessibility_preference IS NULL OR 
            accessibility_preference IN ('none', 'large_text', 'voice_guidance', 'hearing_assistance')
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_profiles_language 
ON patient_profiles (preferred_language) 
WHERE preferred_language IS NOT NULL;
