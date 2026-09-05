const crypto = require("crypto");
const pool = require("../config/db");
const mlService = require("../services/mlService");
const supabaseStorageService = require("../services/supabaseStorageService");
const vectorService = require("../services/vectorService");

/**
 * 1. Upload Medical Document, Run OCR, Extract Entities & Index Vectors
 * POST /api/documents/upload
 */
async function uploadDocument(req, res, next) {
    const client = await pool.connect();
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: "Medical document file is required.",
            });
        }

        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;
        const uploadedBy = req.user.id;
        const documentType = req.body.documentType || "other";
        const filename = req.file.originalname;
        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;
        const documentId = crypto.randomUUID();

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: "patientId is required.",
            });
        }

        // 1. Upload to Supabase Storage (or local storage fallback)
        const storageResult = await supabaseStorageService.uploadMedicalDocument(
            patientId,
            documentId,
            filename,
            req.file.buffer,
            mimeType
        );

        await client.query("BEGIN;");

        // 2. Insert into documents table
        const docInsertQuery = `
            INSERT INTO documents (id, patient_id, uploaded_by, file_name, file_type, file_size, storage_path, document_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const docRes = await client.query(docInsertQuery, [
            documentId,
            patientId,
            uploadedBy,
            filename,
            mimeType,
            fileSize,
            storageResult.storagePath,
            documentType,
        ]);
        const document = docRes.rows[0];

        // 3. Grant uploader and patient document access
        await client.query(
            `INSERT INTO document_access (document_id, user_id, access_type, granted_by)
             VALUES ($1, $2, 'download', $3)
             ON CONFLICT (document_id, user_id) DO NOTHING;`,
            [documentId, patientId, uploadedBy]
        );

        await client.query("COMMIT;");

        // 4. Run OCR & Structured Entity Extraction via FastAPI ML Service
        let ocrResult = null;
        let ocrText = "";
        let extractedEntities = null;

        try {
            ocrResult = await mlService.processDocumentOCR(
                patientId,
                documentId,
                req.file.buffer,
                filename
            );
            ocrText = ocrResult.ocr_text || "";
            extractedEntities = ocrResult.extracted || null;
        } catch (ocrErr) {
            console.warn("[OCR WARNING] OCR service error (recording pending status):", ocrErr.message);
        }

        // 5. Store OCR result in document_ocr table
        if (ocrText) {
            await pool.query(
                `INSERT INTO document_ocr (document_id, extracted_text, status, processed_at)
                 VALUES ($1, $2, 'completed', CURRENT_TIMESTAMP)
                 ON CONFLICT DO NOTHING;`,
                [documentId, ocrText]
            );

            // 6. Store document text chunks and vector embeddings in PostgreSQL (Supabase pgvector)
            await vectorService.storeDocumentChunksAndEmbeddings(pool, documentId, ocrText);

            // 7. Auto-populate medical_history from extracted diagnoses if present
            if (extractedEntities && Array.isArray(extractedEntities.diagnoses)) {
                for (const diagnosis of extractedEntities.diagnoses) {
                    if (diagnosis && diagnosis.trim()) {
                        await pool.query(
                            `INSERT INTO medical_history (patient_id, category, condition, status, notes)
                             VALUES ($1, 'condition', $2, 'active', 'Extracted from document ' || $3)
                             ON CONFLICT DO NOTHING;`,
                            [patientId, diagnosis.trim(), filename]
                        );
                    }
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: "Document uploaded and processed successfully",
            document,
            ocr: {
                extractedText: ocrText,
                entities: extractedEntities,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK;");
        next(error);
    } finally {
        client.release();
    }
}

/**
 * 2. Get All Documents for a Patient
 * GET /api/documents/patient/:patientId
 */
async function getPatientDocuments(req, res, next) {
    try {
        const targetPatientId = req.params.patientId;

        // Security check: Must be the patient or a doctor/staff
        if (req.user.role === "patient" && req.user.id !== targetPatientId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to patient documents.",
            });
        }

        const result = await pool.query(
            `SELECT d.*, 
                    o.extracted_text, o.status AS ocr_status,
                    s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
             ORDER BY d.created_at DESC;`,
            [targetPatientId]
        );

        return res.status(200).json({
            success: true,
            documents: result.rows,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Get Signed Download URL for a Document
 * GET /api/documents/:id/url
 */
async function getDocumentDownloadUrl(req, res, next) {
    try {
        const documentId = req.params.id;

        const docRes = await pool.query(
            `SELECT * FROM documents WHERE id = $1;`,
            [documentId]
        );
        if (docRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found",
            });
        }

        const document = docRes.rows[0];

        // Access check
        if (req.user.role === "patient" && document.patient_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied to this document.",
            });
        }

        const downloadUrl = await supabaseStorageService.getDocumentDownloadUrl(document.storage_path);

        return res.status(200).json({
            success: true,
            downloadUrl,
            fileName: document.file_name,
            fileType: document.file_type,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    uploadDocument,
    getPatientDocuments,
    getDocumentDownloadUrl,
};
