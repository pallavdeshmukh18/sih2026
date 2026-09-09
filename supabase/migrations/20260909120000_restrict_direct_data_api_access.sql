-- Authentication uses application JWTs, not Supabase Auth JWTs.
-- Only the trusted backend database role should access these tables.
-- Browser anon/authenticated roles must not bypass application authorization.
-- Apply via the normal Supabase migration process; no patient records are changed.
BEGIN;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patient_profiles FROM anon, authenticated;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doctor_profiles FROM anon, authenticated;
ALTER TABLE public.receptionist_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.receptionist_profiles FROM anon, authenticated;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.otp_verifications FROM anon, authenticated;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appointments FROM anon, authenticated;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.consultations FROM anon, authenticated;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.medical_history FROM anon, authenticated;
ALTER TABLE public.clinical_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clinical_sessions FROM anon, authenticated;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.documents FROM anon, authenticated;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_access FROM anon, authenticated;
ALTER TABLE public.document_ocr ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_ocr FROM anon, authenticated;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_chunks FROM anon, authenticated;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_embeddings FROM anon, authenticated;
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_summaries FROM anon, authenticated;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_accounts FROM anon, authenticated;
ALTER TABLE public.whatsapp_link_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_link_tokens FROM anon, authenticated;
ALTER TABLE public.patient_doctor_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patient_doctor_relationships FROM anon, authenticated;
ALTER TABLE public.patient_qr_pairing_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patient_qr_pairing_tokens FROM anon, authenticated;
ALTER TABLE public.teleconsult_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teleconsult_sessions FROM anon, authenticated;
ALTER TABLE public.teleconsult_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teleconsult_messages FROM anon, authenticated;
UPDATE storage.buckets SET public = false WHERE id = 'medical-documents';
COMMIT;
