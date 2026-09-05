-- Supabase Migration: 20260905130000_create_user_identity_tables.sql
-- Scope: User / Authentication / Identity Schema ONLY

-- 1. Enable pgcrypto extension for UUID generation fallback if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at trigger function if it does not already exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create 'users' table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    login_method VARCHAR(20) NOT NULL CHECK (login_method IN ('phone', 'email', 'google', 'digilocker')),
    provider_id VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'receptionist')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: A user must have at least email OR phone
    CONSTRAINT chk_users_at_least_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),

    -- Constraint: Enforce login_method consistency rules
    CONSTRAINT chk_users_login_method_consistency CHECK (
        (login_method = 'phone' AND phone IS NOT NULL) OR
        (login_method = 'email' AND email IS NOT NULL) OR
        (login_method = 'google' AND provider_id IS NOT NULL) OR
        (login_method = 'digilocker' AND provider_id IS NOT NULL)
    )
);

-- Partial unique index for (login_method, provider_id) when provider_id is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_method_provider_id 
ON users (login_method, provider_id) 
WHERE provider_id IS NOT NULL;

-- Useful performance indexes (non-unique columns)
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_login_method ON users (login_method);

-- Trigger for users updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- 4. Create 'patient_profiles' table
CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    abha_id VARCHAR(50) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for patient_profiles updated_at
DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER trg_patient_profiles_updated_at
BEFORE UPDATE ON patient_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- 5. Create 'doctor_profiles' table
CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    specialization VARCHAR(100),
    department VARCHAR(100),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Useful index for doctor verification status filtering
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_verification_status ON doctor_profiles (verification_status);

-- Trigger for doctor_profiles updated_at
DROP TRIGGER IF EXISTS trg_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER trg_doctor_profiles_updated_at
BEFORE UPDATE ON doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- 6. Create 'receptionist_profiles' table
CREATE TABLE IF NOT EXISTS receptionist_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL UNIQUE,
    department VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for receptionist_profiles updated_at
DROP TRIGGER IF EXISTS trg_receptionist_profiles_updated_at ON receptionist_profiles;
CREATE TRIGGER trg_receptionist_profiles_updated_at
BEFORE UPDATE ON receptionist_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
