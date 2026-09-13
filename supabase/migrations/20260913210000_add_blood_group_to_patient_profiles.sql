-- Migration: 20260913210000_add_blood_group_to_patient_profiles.sql
-- Description: Add blood_group column to patient_profiles table

ALTER TABLE patient_profiles 
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);

-- Optional check constraint for standard blood groups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_patient_profiles_blood_group'
    ) THEN
        ALTER TABLE patient_profiles
        ADD CONSTRAINT chk_patient_profiles_blood_group
        CHECK (
            blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
        );
    END IF;
END $$;
