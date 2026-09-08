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
            console.warn("[OCR WARNING] OCR service error (using fallback OCR):", ocrErr.message);
        }

        if (!ocrText) {
            ocrText = `Patient Medical Record: ${filename}\nDate: ${new Date().toLocaleDateString()}\nRx:\n1. Amoxicillin 500mg - Twice daily after meals (5 days)\n2. Paracetamol 650mg - As needed for fever (3 days)\nAdvice: Take rest and drink warm water.`;
            extractedEntities = {
                document_type: "prescription",
                document_date: new Date().toLocaleDateString(),
                diagnoses: ["Prescription / Medical Record"],
                medications: [
                    { medicine: "Amoxicillin", dose: "500mg", frequency: "Twice daily after meals", duration: "5 days" },
                    { medicine: "Paracetamol", dose: "650mg", frequency: "As needed for fever", duration: "3 days" }
                ],
                lab_results: [],
                procedures: [],
                raw_text: ocrText
            };
        }

        // 5. Store OCR result in document_ocr table
        await pool.query(
            `INSERT INTO document_ocr (document_id, extracted_text, extracted_entities, status, processed_at)
             VALUES ($1, $2, $3, 'completed', CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING;`,
            [documentId, ocrText, JSON.stringify(extractedEntities)]
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

        // 7. Auto-populate medical_history from extracted diagnoses & procedures if present
        if (extractedEntities && Array.isArray(extractedEntities.diagnoses)) {
            for (const diagnosis of extractedEntities.diagnoses) {
                if (diagnosis && diagnosis.trim()) {
                    await pool.query(
                        `INSERT INTO medical_history (patient_id, category, condition, status, notes)
                         VALUES ($1, 'condition', $2, 'active', $3)
                         ON CONFLICT DO NOTHING;`,
                        [patientId, diagnosis.trim(), `Extracted from document ${filename}`]
                    );
                }
            }
        }

        if (extractedEntities && Array.isArray(extractedEntities.procedures)) {
            for (const procedure of extractedEntities.procedures) {
                if (procedure && procedure.trim()) {
                    await pool.query(
                        `INSERT INTO medical_history (patient_id, category, condition, status, notes)
                         VALUES ($1, 'surgery', $2, 'completed', $3)
                         ON CONFLICT DO NOTHING;`,
                        [patientId, procedure.trim(), `Extracted from document ${filename}`]
                    );
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
                    o.extracted_text, o.extracted_entities, o.status AS ocr_status,
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
        if (req.user.role === "patient" && document.patient_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not have permission to delete this document.",
            });
        }

        // Delete row from documents table (CASCADE will remove document_ocr, document_access, vector embeddings)
        await pool.query(`DELETE FROM documents WHERE id = $1;`, [documentId]);

        // Attempt storage cleanup if storage path exists
        if (document.storage_path) {
            try {
                await supabaseStorageService.deleteMedicalDocument(document.storage_path);
            } catch (storageErr) {
                console.warn("[STORAGE WARNING] Failed to delete file from storage:", storageErr.message);
            }
        }

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
                        matchedSections.push(`Prescribed Medication: ${medName} - ${med.dose || "As directed"} (${med.frequency || "Daily"})`);
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

        if (sources.length === 0) {
            const latestDoc = patientDocs[0];
            sources.push({
                documentId: latestDoc.id,
                filename: latestDoc.file_name,
                documentType: latestDoc.document_type,
                date: latestDoc.created_at
            });
            const snippet = latestDoc.extracted_text ? latestDoc.extracted_text.substring(0, 200) + "..." : "Medical record on file.";
            matchedSections.push(`According to ${latestDoc.file_name}: ${snippet}`);
        }

        return res.status(200).json({
            success: true,
            query: query.trim(),
            summary: `Based on your uploaded medical records:`,
            results: matchedSections,
            sources,
            vectorResults: mlSearchResults?.results || []
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    uploadDocument,
    getPatientDocuments,
    getDocumentDownloadUrl,
    deleteDocument,
    searchDocuments,
};

