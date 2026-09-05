-- ============================================================
-- MEDIKIOSK - PHASE 2
-- DOCUMENTS, OCR, EMBEDDINGS & AI SUMMARIES
-- Migration: 20260905160000
-- ============================================================


-- ============================================================
-- 0. ENABLE PGVECTOR
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- 1. DOCUMENTS
-- ============================================================
-- Stores metadata about the actual files.
-- The actual PDF/image/etc. is stored in Supabase Storage.
--
-- Example storage path:
-- medical-documents/<patient_id>/<document_id>/report.pdf
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_id UUID NOT NULL,

    -- User who uploaded the document.
    -- This does NOT automatically grant them ongoing access.
    uploaded_by UUID NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    file_type VARCHAR(100) NOT NULL,

    file_size BIGINT,

    -- Path/key of the file inside Supabase Storage.
    storage_path TEXT NOT NULL UNIQUE,

    document_type VARCHAR(50) NOT NULL DEFAULT 'other',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_documents_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient_profiles(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_documents_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_documents_file_size
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        ),

    CONSTRAINT chk_documents_type
        CHECK (
            document_type IN (
                'lab_report',
                'prescription',
                'discharge_summary',
                'medical_report',
                'scan',
                'insurance',
                'personal',
                'other'
            )
        )
);


-- ============================================================
-- DOCUMENT INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_patient
    ON documents(patient_id);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by
    ON documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_documents_patient_type
    ON documents(patient_id, document_type);

CREATE INDEX IF NOT EXISTS idx_documents_created_at
    ON documents(created_at);


-- ============================================================
-- DOCUMENT UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. DOCUMENT ACCESS
-- ============================================================
-- IMPORTANT:
--
-- Appointment access DOES NOT imply document access.
--
-- A doctor/receptionist handling appointments cannot access
-- personal documents unless explicit access has been granted.
--
-- This table represents that separate authorization.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL,

    user_id UUID NOT NULL,

    access_type VARCHAR(20) NOT NULL DEFAULT 'view',

    granted_by UUID NOT NULL,

    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expires_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_access_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_document_access_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_document_access_granted_by
        FOREIGN KEY (granted_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_document_access_type
        CHECK (
            access_type IN (
                'view',
                'download'
            )
        ),

    CONSTRAINT chk_document_access_expiry
        CHECK (
            expires_at IS NULL
            OR expires_at >= granted_at
        ),

    CONSTRAINT chk_document_access_revoked
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= granted_at
        ),

    CONSTRAINT uq_document_user_access
        UNIQUE (document_id, user_id)
);


-- ============================================================
-- DOCUMENT ACCESS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_document_access_document
    ON document_access(document_id);

CREATE INDEX IF NOT EXISTS idx_document_access_user
    ON document_access(user_id);

CREATE INDEX IF NOT EXISTS idx_document_access_active
    ON document_access(user_id, revoked_at, expires_at);


-- ============================================================
-- 3. DOCUMENT OCR
-- ============================================================
-- Stores text extracted from the original document.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_ocr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL,

    extracted_text TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    confidence NUMERIC(5,4),

    processed_at TIMESTAMPTZ,

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_ocr_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_document_ocr_status
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed'
            )
        ),

    CONSTRAINT chk_document_ocr_confidence
        CHECK (
            confidence IS NULL
            OR (
                confidence >= 0
                AND confidence <= 1
            )
        )
);


-- ============================================================
-- DOCUMENT OCR INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_document_ocr_document
    ON document_ocr(document_id);

CREATE INDEX IF NOT EXISTS idx_document_ocr_status
    ON document_ocr(status);


-- ============================================================
-- DOCUMENT OCR UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_document_ocr_updated_at
BEFORE UPDATE ON document_ocr
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. DOCUMENT CHUNKS
-- ============================================================
-- OCR text is divided into smaller chunks before embeddings
-- are generated.
--
-- Example:
--
-- Document
--    |
--    +-- Chunk 1
--    +-- Chunk 2
--    +-- Chunk 3
--    +-- Chunk 4
-- ============================================================

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL,

    chunk_index INTEGER NOT NULL,

    content TEXT NOT NULL,

    -- Useful for showing the source page to the user.
    page_number INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_document_chunks_index
        CHECK (chunk_index >= 0),

    CONSTRAINT chk_document_chunks_page
        CHECK (
            page_number IS NULL
            OR page_number > 0
        ),

    CONSTRAINT uq_document_chunk
        UNIQUE (document_id, chunk_index)
);


-- ============================================================
-- DOCUMENT CHUNK INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_document_chunks_document
    ON document_chunks(document_id);


-- ============================================================
-- 5. DOCUMENT EMBEDDINGS
-- ============================================================
-- Stores vector embeddings for semantic search.
--
-- IMPORTANT:
-- The dimension below must match the embedding model selected
-- by the AI/backend team.
--
-- Change it if the selected model uses another dimension.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    chunk_id UUID NOT NULL UNIQUE,

    embedding VECTOR(384) NOT NULL,

    embedding_model VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_embeddings_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES document_chunks(id)
        ON DELETE CASCADE
);


-- ============================================================
-- EMBEDDING INDEX
-- ============================================================
-- Add the vector similarity index after confirming the
-- embedding model/dimension and search strategy.
--
-- Example for cosine similarity:
--
-- CREATE INDEX idx_document_embeddings_vector
--     ON document_embeddings
--     USING hnsw (embedding vector_cosine_ops);
--
-- We intentionally leave it commented until the model is
-- finalized.
-- ============================================================


-- ============================================================
-- 6. AI SUMMARIES
-- ============================================================
-- Stores AI-generated summaries.
-- The original document remains the source of truth.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL,

    summary TEXT NOT NULL,

    summary_type VARCHAR(30) NOT NULL DEFAULT 'general',

    model VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'completed',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ai_summaries_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_ai_summaries_type
        CHECK (
            summary_type IN (
                'general',
                'clinical',
                'medications',
                'lab_results',
                'discharge'
            )
        ),

    CONSTRAINT chk_ai_summaries_status
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed'
            )
        )
);


-- ============================================================
-- AI SUMMARY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_summaries_document
    ON ai_summaries(document_id);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_type
    ON ai_summaries(document_id, summary_type);


-- ============================================================
-- AI SUMMARY UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER trg_ai_summaries_updated_at
BEFORE UPDATE ON ai_summaries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();