-- ================================================================
-- Migration: Add Extracted Entities JSONB to document_ocr table
-- Timestamp: 20260907211000
-- ================================================================

ALTER TABLE document_ocr
ADD COLUMN IF NOT EXISTS extracted_entities JSONB;
