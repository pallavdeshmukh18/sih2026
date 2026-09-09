const crypto = require("crypto");
const { canAccessDocument, documentConsentSql } = require("../services/documentAccessService");
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
    let uploadedStoragePath = null;
    let committed = false;
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

        uploadedStoragePath = storageResult.storagePath;
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
        committed = true;

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
            console.warn("[OCR WARNING] OCR service error:", ocrErr.message);
        }

        const ocrStatus = typeof ocrText === "string" && ocrText.trim() ? "completed" : "failed";
        await pool.query(
            `INSERT INTO document_ocr (document_id, extracted_text, extracted_entities, status, processed_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);`,
            [documentId, ocrText, JSON.stringify(extractedEntities), ocrStatus]
        );

        // Store AI summary in ai_summaries table if available
        if (extractedEntities && extractedEntities.summary) {
            try {
                await pool.query(
                    `INSERT INTO ai_summaries (document_id, summary, summary_type, model, status)
                     VALUES ($1, $2, 'general', 'openai/gpt-oss-20b', 'completed')
                     ON CONFLICT DO NOTHING;`,
                    [documentId, extractedEntities.summary]
                );
            } catch (sumErr) {
                console.warn("[SUMMARY WARNING] AI summary insert skipped:", sumErr.message);
            }
        }

        // 6. Store document text chunks and vector embeddings in PostgreSQL (Supabase pgvector)
        try {
            await vectorService.storeDocumentChunksAndEmbeddings(pool, documentId, ocrText);
        } catch (vErr) {
            console.warn("[VECTOR WARNING] Vector embedding skipped:", vErr.message);
        }

        return res.status(201).json({
            success: true,
            message: ocrStatus === "completed" ? "Document uploaded and processed successfully" : "Original document saved. Text extraction failed; no clinical information was inferred.",
            document,
            ocr: {
                status: ocrStatus,
                extractedText: ocrText,
                entities: extractedEntities,
            },
        });
    } catch (error) {
        if (!committed) {
            await client.query("ROLLBACK;").catch(() => {});
            if (uploadedStoragePath) await supabaseStorageService.deleteMedicalDocument(uploadedStoragePath).catch(() => {});
        }
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
                    o.extracted_text, o.extracted_entities, o.status AS ocr_status,
                    s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
               AND ($3 = 'patient' OR ($3 = 'doctor' AND ${documentConsentSql('d', '$2')}))
             ORDER BY d.created_at DESC;`,
            [targetPatientId, req.user.id, req.user.role]
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
        if (!await canAccessDocument(req.user, document, true)) {
            return res.status(403).json({
                success: false,
                message: "Access denied to this document.",
            });
        }

        const local = await supabaseStorageService.getLocalDocumentPath(document.storage_path);
        if (local) return res.status(200).json({ success: true, localDownload: true, fileName: document.file_name });
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

/**
 * 4. Delete Medical Document
 * DELETE /api/documents/:id
 */
async function deleteDocument(req, res, next) {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

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

        // Access check: User must be the patient who owns the document or a doctor
        if (req.user.role !== "patient" || document.patient_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not have permission to delete this document.",
            });
        }

        try {
            await mlService.deleteDocumentVectors(document.patient_id, documentId);
        } catch (vErr) {
            console.warn("[DELETE WARNING] Vector cleanup skipped:", vErr.message);
        }

        if (document.storage_path) {
            try {
                await supabaseStorageService.deleteMedicalDocument(document.storage_path);
            } catch (sErr) {
                console.warn("[DELETE WARNING] Storage file cleanup skipped:", sErr.message);
            }
        }

        await pool.query(`DELETE FROM documents WHERE id = $1;`, [documentId]);

        return res.status(200).json({
            success: true,
            message: "Medical record deleted successfully",
            documentId,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. Search Patient Documents / Ask About History
 * POST /api/documents/search
 */
async function searchDocuments(req, res, next) {
    try {
        const { query } = req.body;
        if (!query || typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: "Search query is required.",
            });
        }

        const patientId = req.user.id; // Patient isolation enforced via JWT token

        // Call ML service for semantic vector search
        let mlSearchResults = null;
        try {
            mlSearchResults = await mlService.searchDocuments(patientId, query.trim(), 5);
        } catch (searchErr) {
            console.warn("[SEARCH WARNING] Semantic vector search service error:", searchErr.message);
        }

        // Query documents and OCR records directly from DB for this patient
        const docsRes = await pool.query(
            `SELECT d.id, d.file_name, d.document_type, d.created_at,
                    o.extracted_text, o.extracted_entities, s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
             ORDER BY d.created_at DESC;`,
            [patientId]
        );

        const patientDocs = docsRes.rows;

        if (patientDocs.length === 0) {
            return res.status(200).json({
                success: true,
                query: query.trim(),
                summary: "No uploaded medical records found for your account.",
                results: [],
                sources: []
            });
        }

        const lowerQuery = query.toLowerCase();
        let matchedSections = [];
        let sources = [];

        patientDocs.forEach(doc => {
            const text = doc.extracted_text || "";
            let entities = doc.extracted_entities;
            if (typeof entities === "string") {
                try { entities = JSON.parse(entities); } catch (e) { entities = {}; }
            }
            entities = entities || {};

            let matched = false;

            // Check lab results
            if (entities.lab_results && Array.isArray(entities.lab_results)) {
                entities.lab_results.forEach(lab => {
                    if (lowerQuery.includes("lab") || lowerQuery.includes("blood") || lowerQuery.includes("test") || lowerQuery.includes("hemoglobin") || (lab.test && lowerQuery.includes(lab.test.toLowerCase()))) {
                        matched = true;
                        matchedSections.push(`Laboratory Result: ${lab.test} - ${lab.value || "N/A"} ${lab.unit || ""} (Reference Range: ${lab.reference_range || "Not reported"})`);
                    }
                });
            }

            // Check medications
            if (entities.medications && Array.isArray(entities.medications)) {
                entities.medications.forEach(med => {
                    const medName = med.medicine || med.name || "";
                    if (lowerQuery.includes("medicin") || lowerQuery.includes("prescript") || lowerQuery.includes("dose") || (medName && lowerQuery.includes(medName.toLowerCase()))) {
                        matched = true;
                        matchedSections.push(`Prescribed Medication: ${medName} - ${med.dose || "As directed"} (${med.frequency || "Not reported"})`);
                    }
                });
            }

            // Check diagnoses
            if (entities.diagnoses && Array.isArray(entities.diagnoses)) {
                entities.diagnoses.forEach(diag => {
                    if (lowerQuery.includes("diagnos") || lowerQuery.includes("condition") || (diag && lowerQuery.includes(diag.toLowerCase()))) {
                        matched = true;
                        matchedSections.push(`Recorded Diagnosis: ${diag}`);
                    }
                });
            }

            // Fallback match in raw OCR text
            if (!matched && text && (lowerQuery.split(" ").some(w => w.length > 3 && text.toLowerCase().includes(w)))) {
                matched = true;
                const snippet = text.substring(0, 180).replace(/\s+/g, " ") + "...";
                matchedSections.push(`Record Excerpt: "${snippet}"`);
            }

            if (matched) {
                sources.push({
                    documentId: doc.id,
                    filename: doc.file_name,
                    documentType: doc.document_type,
                    date: doc.created_at
                });
            }
        });

        return res.status(200).json({
            success: true,
            query: query.trim(),
            summary: sources.length ? "Matching excerpts from your uploaded medical records:" : "No matching information found in your uploaded records.",
            results: matchedSections,
            sources,
            vectorResults: (mlSearchResults?.results || []).filter(result => patientDocs.some(doc => doc.id === result.metadata?.document_id))
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 6. Get Single Document By ID
 * GET /api/documents/:id
 */
async function getDocumentById(req, res, next) {
    try {
        const documentId = req.params.id;
        const userId = req.user.id;

        const docRes = await pool.query(
            `SELECT d.*, 
                    o.extracted_text, o.extracted_entities, o.status AS ocr_status,
                    s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.id = $1;`,
            [documentId]
        );

        if (docRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical document not found.",
            });
        }

        const document = docRes.rows[0];

        if (!await canAccessDocument(req.user, document)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: You do not own this document.",
            });
        }

        return res.status(200).json({
            success: true,
            document,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 7. Ask Document-Specific Grounded Question
 * POST /api/documents/:documentId/ask
 */
async function askDocumentQuestion(req, res, next) {
    try {
        const { documentId } = req.params;
        const { question, language, history } = req.body;
        const patientId = req.user.id; // Enforce strict JWT ownership

        if (!question || typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                success: false,
                message: "Question is required.",
            });
        }

        // Verify document ownership & fetch record context
        const docRes = await pool.query(
            `SELECT d.id, d.patient_id, d.file_name, d.file_type, d.document_type,
                    o.extracted_text, o.extracted_entities, o.status AS ocr_status,
                    s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.id = $1;`,
            [documentId]
        );

        if (docRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found.",
            });
        }

        const doc = docRes.rows[0];

        // Security check: Must belong to authenticated patient
        if (!await canAccessDocument(req.user, doc)) {
            return res.status(403).json({
                success: false,
                message: "Access denied: You do not own this medical document.",
            });
        }

        let entities = doc.extracted_entities;
        if (typeof entities === "string") {
            try { entities = JSON.parse(entities); } catch (e) { entities = {}; }
        }

        if (!doc.extracted_text?.trim()) {
            return res.status(409).json({ message: "This document has no extracted text yet. Please review the original file." });
        }
        // Call ML service for grounded document explanation
        const qaResult = await mlService.askDocumentQuestion(
            doc.patient_id,
            documentId,
            doc.file_name,
            question.trim(),
            doc.extracted_text,
            entities,
            doc.ai_summary,
            language || "en",
            history || []
        );

        return res.status(200).json({
            success: true,
            ...qaResult
        });
    } catch (error) {
        next(error);
    }
}

async function downloadLocalDocument(req, res, next) {
    try {
        const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
        const document = result.rows[0];
        if (!document) return res.status(404).json({ message: 'Document not found.' });
        if (!await canAccessDocument(req.user, document, true)) return res.status(403).json({ message: 'Document access denied.' });
        const local = await supabaseStorageService.getLocalDocumentPath(document.storage_path);
        if (!local) return res.status(404).json({ message: 'Local document not found.' });
        res.setHeader('Cache-Control', 'no-store');
        return res.download(local, document.file_name);
    } catch (error) { next(error); }
}

async function getDocumentAccess(req, res, next) {
    try {
        const owned = await pool.query('SELECT id FROM documents WHERE id = $1 AND patient_id = $2', [req.params.id, req.user.id]);
        if (!owned.rows.length) return res.status(404).json({ message: 'Document not found.' });
        const result = await pool.query(
            `SELECT da.user_id AS doctor_id, da.access_type, da.expires_at
             FROM document_access da WHERE da.document_id = $1 AND da.user_id <> $2
               AND da.granted_by = $2 AND da.revoked_at IS NULL
               AND (da.expires_at IS NULL OR da.expires_at > CURRENT_TIMESTAMP)`, [req.params.id, req.user.id]
        );
        res.json({ success: true, access: result.rows });
    } catch (error) { next(error); }
}

async function setDocumentAccess(req, res, next) {
    try {
        const { doctorId, accessType = 'view', revoke = false } = req.body;
        if (!doctorId || !['view', 'download'].includes(accessType) || typeof revoke !== 'boolean') {
            return res.status(400).json({ message: 'Doctor and valid document permission are required.' });
        }
        const owned = await pool.query('SELECT id FROM documents WHERE id = $1 AND patient_id = $2', [req.params.id, req.user.id]);
        if (!owned.rows.length) return res.status(404).json({ message: 'Document not found.' });
        if (revoke) {
            await pool.query('UPDATE document_access SET revoked_at = CURRENT_TIMESTAMP WHERE document_id = $1 AND user_id = $2', [req.params.id, doctorId]);
        } else {
            const connected = await pool.query(
                `SELECT 1 FROM patient_doctor_relationships r JOIN users u ON u.id = r.doctor_id
                 JOIN doctor_profiles dp ON dp.user_id = u.id
                 WHERE r.patient_id = $1 AND r.doctor_id = $2 AND r.status = 'active'
                   AND u.is_active = true AND dp.verification_status = 'verified'`, [req.user.id, doctorId]
            );
            if (!connected.rows.length) return res.status(403).json({ message: 'Connect with a verified doctor before sharing a document.' });
            await pool.query(
                `INSERT INTO document_access (document_id, user_id, access_type, granted_by)
                 VALUES ($1, $2, $3, $4) ON CONFLICT (document_id, user_id) DO UPDATE
                 SET access_type = EXCLUDED.access_type, granted_by = EXCLUDED.granted_by,
                     granted_at = CURRENT_TIMESTAMP, expires_at = NULL, revoked_at = NULL`,
                [req.params.id, doctorId, accessType, req.user.id]
            );
        }
        res.json({ success: true });
    } catch (error) { next(error); }
}

module.exports = {
    getDocumentAccess,
    setDocumentAccess,
    downloadLocalDocument,
    uploadDocument,
    getPatientDocuments,
    getDocumentDownloadUrl,
    deleteDocument,
    searchDocuments,
    getDocumentById,
    askDocumentQuestion,
};

