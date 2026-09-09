-- Match the staff roles supported by account creation and portal routing.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'receptionist', 'admin', 'nurse'));
