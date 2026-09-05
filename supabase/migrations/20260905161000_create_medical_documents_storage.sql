-- ============================================================
-- MEDIKIOSK - MEDICAL DOCUMENT STORAGE
-- ============================================================

-- Create a PRIVATE storage bucket for medical documents.
INSERT INTO storage.buckets (
    id,
    name,
    public
)
VALUES (
    'medical-documents',
    'medical-documents',
    false
)
ON CONFLICT (id) DO NOTHING;