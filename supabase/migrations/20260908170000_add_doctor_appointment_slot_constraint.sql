-- Supabase Migration: 20260908170000_add_doctor_appointment_slot_constraint.sql
-- Description: Prevent double booking of active appointment slots for doctors

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_doctor_scheduled_active
ON appointments (doctor_id, scheduled_at)
WHERE status IN ('scheduled', 'confirmed');
