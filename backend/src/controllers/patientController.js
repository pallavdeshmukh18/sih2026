const pool = require("../config/db");
const graveyardController = require("./graveyardController");

const ALLOWED_LANGUAGES = [
    "en", "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or", "as"
];

const ALLOWED_INTERACTION_MODES = [
    "voice", "touch", "voice_touch"
];

const ALLOWED_ACCESSIBILITY_PREFERENCES = [
    "none", "large_text", "voice_guidance", "hearing_assistance", "sign_language"
];

const ALLOWED_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi (NCT)", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

/**
 * 1. Save or Update Patient Onboarding Preferences
 * PATCH /api/patient/profile/onboarding
 * Access: Authenticated patient only (derived from JWT)
 */
async function saveOnboardingPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const { state, preferred_language, interaction_mode, accessibility_preference } = req.body;

        // Server-side validations
        if (!state || !ALLOWED_STATES.includes(state)) {
            return res.status(400).json({
                success: false,
                message: `Invalid state or UT '${state}'. Must be a valid Indian state or union territory.`,
            });
        }

        if (!preferred_language || !ALLOWED_LANGUAGES.includes(preferred_language)) {
            return res.status(400).json({
                success: false,
                message: `Invalid preferred_language '${preferred_language}'. Allowed: [${ALLOWED_LANGUAGES.join(", ")}]`,
            });
        }

        if (!interaction_mode || !ALLOWED_INTERACTION_MODES.includes(interaction_mode)) {
            return res.status(400).json({
                success: false,
                message: `Invalid interaction_mode '${interaction_mode}'. Allowed: [${ALLOWED_INTERACTION_MODES.join(", ")}]`,
            });
        }

        if (!accessibility_preference || !ALLOWED_ACCESSIBILITY_PREFERENCES.includes(accessibility_preference)) {
            return res.status(400).json({
                success: false,
                message: `Invalid accessibility_preference '${accessibility_preference}'. Allowed: [${ALLOWED_ACCESSIBILITY_PREFERENCES.join(", ")}]`,
            });
        }

        // Verify patient profile exists
        const profileCheck = await pool.query(
            `SELECT user_id FROM patient_profiles WHERE user_id = $1;`,
            [userId]
        );

        let result;
        if (profileCheck.rows.length === 0) {
            // Insert patient profile if missing
            const insertQuery = `
                INSERT INTO patient_profiles (user_id, state, preferred_language, interaction_mode, accessibility_preference)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING user_id, state, preferred_language, interaction_mode, accessibility_preference, updated_at;
            `;
            result = await pool.query(insertQuery, [
                userId, state, preferred_language, interaction_mode, accessibility_preference
            ]);
        } else {
            // Update patient profile
            const updateQuery = `
                UPDATE patient_profiles
                SET state = $1,
                    preferred_language = $2,
                    interaction_mode = $3,
                    accessibility_preference = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5
                RETURNING user_id, state, preferred_language, interaction_mode, accessibility_preference, updated_at;
            `;
            result = await pool.query(updateQuery, [
                state, preferred_language, interaction_mode, accessibility_preference, userId
            ]);
        }

        const row = result.rows[0];
        const isCompleted = !!(row.state && row.preferred_language && row.interaction_mode && row.accessibility_preference);

        return res.status(200).json({
            success: true,
            message: "Onboarding preferences saved successfully.",
            onboarding: {
                state: row.state,
                preferred_language: row.preferred_language,
                interaction_mode: row.interaction_mode,
                accessibility_preference: row.accessibility_preference,
                completed: isCompleted
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Get Patient Onboarding Preferences
 * GET /api/patient/profile/onboarding
 * Access: Authenticated patient only
 */
async function getOnboardingPreferences(req, res, next) {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT state, preferred_language, interaction_mode, accessibility_preference
             FROM patient_profiles
             WHERE user_id = $1;`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                onboarding: {
                    state: null,
                    preferred_language: null,
                    interaction_mode: null,
                    accessibility_preference: null,
                    completed: false
                }
            });
        }

        const row = result.rows[0];
        const isCompleted = !!(row.state && row.preferred_language && row.interaction_mode && row.accessibility_preference);

        return res.status(200).json({
            success: true,
            onboarding: {
                state: row.state,
                preferred_language: row.preferred_language,
                interaction_mode: row.interaction_mode,
                accessibility_preference: row.accessibility_preference,
                completed: isCompleted
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Update Patient Profile & Personal Information
 * PATCH /api/patient/profile
 * Access: Authenticated patient only
 */
const ALLOWED_BLOOD_GROUPS = [
    "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"
];

async function updatePatientProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const { firstName, lastName, dateOfBirth, gender, bloodGroup, state, preferredLanguage, interactionMode, accessibilityPreference, islEnabled } = req.body;

        // Validation for allowed dropdown values if supplied
        if (bloodGroup && !ALLOWED_BLOOD_GROUPS.includes(bloodGroup)) {
            return res.status(400).json({
                success: false,
                message: `Invalid bloodGroup '${bloodGroup}'. Allowed: [${ALLOWED_BLOOD_GROUPS.join(", ")}]`,
            });
        }
        if (state && !ALLOWED_STATES.includes(state)) {
            return res.status(400).json({
                success: false,
                message: `Invalid state '${state}'. Must be a valid Indian state or UT.`,
            });
        }
        if (preferredLanguage && !ALLOWED_LANGUAGES.includes(preferredLanguage)) {
            return res.status(400).json({
                success: false,
                message: `Invalid preferredLanguage '${preferredLanguage}'.`,
            });
        }
        if (interactionMode && !ALLOWED_INTERACTION_MODES.includes(interactionMode)) {
            return res.status(400).json({
                success: false,
                message: `Invalid interactionMode '${interactionMode}'.`,
            });
        }
        if (accessibilityPreference && !ALLOWED_ACCESSIBILITY_PREFERENCES.includes(accessibilityPreference)) {
            return res.status(400).json({
                success: false,
                message: `Invalid accessibilityPreference '${accessibilityPreference}'.`,
            });
        }

        const resolvedIslEnabled = (accessibilityPreference === "sign_language") 
            ? true 
            : (islEnabled !== undefined ? Boolean(islEnabled) : null);

        // Update users table (first_name, last_name) if passed
        if (firstName !== undefined || lastName !== undefined) {
            await pool.query(
                `UPDATE users 
                 SET first_name = COALESCE($1, first_name),
                     last_name = COALESCE($2, last_name),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3;`,
                [firstName || null, lastName || null, userId]
            );
        }

        // Update patient_profiles table
        const profileCheck = await pool.query(
            `SELECT user_id FROM patient_profiles WHERE user_id = $1;`,
            [userId]
        );

        if (profileCheck.rows.length === 0) {
            await pool.query(
                `INSERT INTO patient_profiles (user_id, date_of_birth, gender, blood_group, state, preferred_language, interaction_mode, accessibility_preference, isl_enabled)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
                [userId, dateOfBirth || null, gender || null, bloodGroup || null, state || null, preferredLanguage || null, interactionMode || null, accessibilityPreference || null, resolvedIslEnabled ?? false]
            );
        } else {
            await pool.query(
                `UPDATE patient_profiles
                 SET date_of_birth = COALESCE($1, date_of_birth),
                     gender = COALESCE($2, gender),
                     blood_group = COALESCE($3, blood_group),
                     state = COALESCE($4, state),
                     preferred_language = COALESCE($5, preferred_language),
                     interaction_mode = COALESCE($6, interaction_mode),
                     accessibility_preference = COALESCE($7, accessibility_preference),
                     isl_enabled = COALESCE($8, isl_enabled),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $9;`,
                [dateOfBirth || null, gender || null, bloodGroup || null, state || null, preferredLanguage || null, interactionMode || null, accessibilityPreference || null, resolvedIslEnabled, userId]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 4. Get Authenticated Patient Longitudinal Medical History
 * GET /api/patient/history
 * Access: Authenticated patient only (derived from JWT req.user.id)
 */
async function getPatientMedicalHistory(req, res, next) {
    try {
        const patientId = req.user.id;

        // Run auto-archival check if retention policy configured
        await graveyardController.runAutoArchival(patientId);

        // 1. Fetch Patient Demographics & Profile
        const userRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.state, p.preferred_language
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             WHERE u.id = $1;`,
            [patientId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found.",
            });
        }

        const patient = userRes.rows[0];

        // 2. Fetch Medical History (conditions, allergies, surgeries, etc.)
        const medHistoryRes = await pool.query(
            `SELECT id, category, condition, description, diagnosed_at, status, notes, created_at
             FROM medical_history
             WHERE patient_id = $1
               AND id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'medical_history')
             ORDER BY COALESCE(diagnosed_at, created_at::date) DESC;`,
            [patientId]
        );

        // Group medical history by category
        const conditions = [];
        const allergies = [];
        const procedures = [];
        const otherHistory = [];

        medHistoryRes.rows.forEach((row) => {
            const item = {
                id: row.id,
                name: row.condition,
                category: row.category,
                description: row.description,
                date: row.diagnosed_at || row.created_at,
                status: row.status,
                notes: row.notes,
                source: "Medical Record",
            };
            if (row.category === "condition") {
                conditions.push(item);
            } else if (row.category === "allergy") {
                allergies.push(item);
            } else if (row.category === "surgery" || row.category === "hospitalization") {
                procedures.push(item);
            } else {
                otherHistory.push(item);
            }
        });

        // 3. Fetch Doctor Consultations
        const consultRes = await pool.query(
            `SELECT c.id, c.appointment_id, c.started_at, c.ended_at, c.chief_complaint,
                    c.clinical_notes, c.diagnosis, c.treatment_notes, c.created_at,
                    a.scheduled_at, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                    dp.specialization
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
             WHERE a.patient_id = $1
               AND c.id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'consultation')
             ORDER BY c.created_at DESC;`,
            [patientId]
        );

        const consultations = consultRes.rows.map((row) => ({
            id: row.id,
            appointmentId: row.appointment_id,
            date: row.started_at || row.scheduled_at || row.created_at,
            doctorName: `Dr. ${row.doctor_first_name} ${row.doctor_last_name || ""}`.trim(),
            specialization: row.specialization || "General Medicine",
            chiefComplaint: row.chief_complaint,
            diagnosis: row.diagnosis,
            clinicalNotes: row.clinical_notes,
            treatmentNotes: row.treatment_notes,
            source: "Doctor Consultation",
        }));

        // 4. Fetch Clinical AI Intake Sessions
        let sessionRows = [];
        try {
            const sessionsRes = await pool.query(
                `SELECT id, chief_complaint, status, summary, conversation_history, current_state, created_at, updated_at
                 FROM clinical_sessions
                 WHERE patient_id = $1
                   AND id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'clinical_session')
                 ORDER BY created_at DESC;`,
                [patientId]
            );
            sessionRows = sessionsRes.rows;
        } catch (sessErr) {
            console.warn("[HISTORY WARNING] Could not query clinical_sessions history with conversation_history:", sessErr.message);
            try {
                const fallbackRes = await pool.query(
                    `SELECT id, chief_complaint, status, summary, current_state, created_at, updated_at
                     FROM clinical_sessions
                     WHERE patient_id = $1
                       AND id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'clinical_session')
                     ORDER BY created_at DESC;`,
                    [patientId]
                );
                sessionRows = fallbackRes.rows;
            } catch (e2) {
                console.warn("[HISTORY WARNING] Fallback clinical_sessions query failed:", e2.message);
            }
        }

        const assessments = sessionRows.map((row) => {
            const state = row.current_state || {};
            let history = row.conversation_history;
            if (typeof history === "string") {
                try { history = JSON.parse(history); } catch (e) { history = []; }
            }
            if (!Array.isArray(history) && state.conversation_history) {
                history = state.conversation_history;
            }

            const answeredFields = state.answered_fields || {};
            const redFlags = state.red_flags || [];
            let summaryText = row.summary;

            if (!summaryText || !summaryText.trim() || summaryText.startsWith("Intake session")) {
                let generated = `## Executive Summary\n`;
                generated += `Patient presenting with ${row.chief_complaint || "general concerns"}. Intake is currently ${row.status === 'completed' ? 'completed' : 'in progress'}.\n\n`;

                generated += `## Chief Complaint (CC)\n`;
                generated += `${row.chief_complaint || "General Intake"}\n\n`;
                
                if (redFlags.length > 0) {
                    generated += `## 🚨 Red Flags & Triage Priority\n`;
                    redFlags.forEach(flag => {
                        generated += `- ⚠️ ${flag}\n`;
                    });
                    generated += `\n`;
                }

                if (Object.keys(answeredFields).length > 0) {
                    generated += `## History of Presenting Illness (HPI)\n`;
                    Object.entries(answeredFields).forEach(([field, val]) => {
                        const displayField = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        generated += `- **${displayField}**: ${val}\n`;
                    });
                } else {
                    generated += `No clinical parameters recorded during intake.\n`;
                }
                
                generated += `\n\n*Auto-generated provisional summary for doctor review*`;
                summaryText = generated;
            }

            return {
                id: row.id,
                chiefComplaint: row.chief_complaint,
                status: row.status,
                summary: summaryText,
                date: row.created_at,
                redFlags,
                answeredFields,
                chatHistory: Array.isArray(history) ? history : [],
                source: "MediKiosk Clinical AI Assessment",
            };
        });

        // 5. Fetch Documents, OCR text & Extracted Entities
        const docsRes = await pool.query(
            `SELECT d.id, d.file_name, d.file_type, d.file_size, d.document_type, d.created_at,
                    o.status AS ocr_status, o.extracted_text, o.extracted_entities,
                    s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
               AND d.id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'document')
             ORDER BY d.created_at DESC;`,
            [patientId]
        );

        const documents = [];
        const prescriptions = [];
        const investigations = [];
        const currentMedications = [];

        docsRes.rows.forEach((doc) => {
            const docItem = {
                id: doc.id,
                fileName: doc.file_name,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                documentType: doc.document_type,
                date: doc.created_at,
                ocrStatus: doc.ocr_status || "pending",
                aiSummary: doc.ai_summary,
                hasOcrText: !!(doc.extracted_text && doc.extracted_text.trim()),
                extractedEntities: doc.extracted_entities || null,
                source: "Uploaded Medical Record",
            };
            documents.push(docItem);

            // Parse OCR extracted entities if available
            const entities = doc.extracted_entities || {};
            
            if (doc.document_type === "prescription" || entities.medications) {
                const meds = Array.isArray(entities.medications) 
                    ? entities.medications 
                    : (typeof entities.medications === "string" ? [{ name: entities.medications }] : []);
                
                prescriptions.push({
                    id: doc.id,
                    title: doc.file_name,
                    date: doc.created_at,
                    documentId: doc.id,
                    documentType: doc.document_type,
                    medications: meds,
                    summary: doc.ai_summary || (doc.extracted_text ? doc.extracted_text.substring(0, 150) + "..." : "Uploaded Prescription"),
                    source: "Uploaded Medical Record",
                    ocrStatus: doc.ocr_status || "pending",
                });

                meds.forEach(med => {
                    if (med && (med.name || typeof med === "string")) {
                        currentMedications.push({
                            id: `med_${doc.id}_${currentMedications.length}`,
                            name: typeof med === "string" ? med : med.name,
                            dosage: med.dosage || med.strength || null,
                            frequency: med.frequency || med.instructions || null,
                            source: "Prescription OCR",
                            documentId: doc.id,
                            date: doc.created_at,
                        });
                    }
                });
            }

            if (doc.document_type === "lab_report" || doc.document_type === "scan" || entities.lab_results || entities.investigations) {
                const labResults = Array.isArray(entities.lab_results)
                    ? entities.lab_results
                    : (Array.isArray(entities.investigations) ? entities.investigations : []);

                investigations.push({
                    id: doc.id,
                    name: doc.file_name,
                    documentType: doc.document_type,
                    date: doc.created_at,
                    documentId: doc.id,
                    ocrStatus: doc.ocr_status || "pending",
                    results: labResults,
                    summary: doc.ai_summary || (doc.extracted_text ? doc.extracted_text.substring(0, 150) + "..." : "Lab / Investigation Report"),
                    source: "Uploaded Medical Record",
                });
            }
        });

        // Add medications from doctor consultations if any
        consultations.forEach(c => {
            if (c.treatmentNotes && c.treatmentNotes.trim()) {
                currentMedications.push({
                    id: `med_consult_${c.id}`,
                    name: `Treatment / Prescription (${c.doctorName})`,
                    dosage: null,
                    frequency: c.treatmentNotes,
                    source: "Doctor Consultation",
                    date: c.date,
                });
            }
        });

        // 6. Build Chronological Medical Timeline
        const timelineEvents = [];

        conditions.forEach(c => timelineEvents.push({
            id: `timeline_cond_${c.id}`,
            rawId: c.id,
            recordType: "medical_history",
            date: c.date,
            type: "Condition",
            category: "diagnosis",
            verificationStatus: "patient_reported",
            title: c.name,
            subtitle: `Diagnosed (${c.status})`,
            details: c.description || c.notes,
            source: c.source,
            canDelete: true,
        }));

        allergies.forEach(a => timelineEvents.push({
            id: `timeline_allergy_${a.id}`,
            rawId: a.id,
            recordType: "medical_history",
            date: a.date,
            type: "Allergy",
            category: "allergy",
            verificationStatus: "patient_reported",
            title: a.name,
            subtitle: "Allergy Record",
            details: a.description,
            source: a.source,
            canDelete: true,
        }));

        procedures.forEach(p => timelineEvents.push({
            id: `timeline_proc_${p.id}`,
            rawId: p.id,
            recordType: "medical_history",
            date: p.date,
            type: "Procedure",
            category: "procedure",
            verificationStatus: "patient_reported",
            title: p.name,
            subtitle: `Procedure (${p.status})`,
            details: p.description || p.notes,
            source: p.source,
            canDelete: true,
        }));

        consultations.forEach(c => timelineEvents.push({
            id: `timeline_consult_${c.id}`,
            rawId: c.id,
            recordType: "consultation",
            date: c.date,
            type: "Consultation",
            category: "consultation",
            verificationStatus: "verified",
            title: `Consultation with ${c.doctorName}`,
            subtitle: c.specialization,
            details: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : c.chiefComplaint,
            doctorName: c.doctorName,
            specialization: c.specialization,
            clinicalNotes: c.clinicalNotes,
            treatmentNotes: c.treatmentNotes,
            source: c.source,
            canDelete: false,
        }));

        assessments.forEach(a => timelineEvents.push({
            id: `timeline_assess_${a.id}`,
            rawId: a.id,
            recordType: "clinical_session",
            date: a.date,
            type: "Assessment",
            category: "assessment",
            verificationStatus: "ai_extracted",
            title: `Clinical Intake: ${a.chiefComplaint || "General Intake"}`,
            subtitle: `Status: ${(a.status || 'in_progress').toUpperCase()}`,
            details: a.summary,
            redFlags: a.redFlags,
            answeredFields: a.answeredFields,
            chatHistory: a.chatHistory,
            source: a.source,
            canDelete: true,
        }));

        documents.forEach(d => {
            const docType = d.documentType || "other";
            let cat = "document";
            if (docType === "prescription") cat = "prescription";
            else if (docType === "lab_report" || docType === "scan") cat = "lab_test";

            timelineEvents.push({
                id: `timeline_doc_${d.id}`,
                rawId: d.id,
                recordType: "document",
                date: d.date,
                type: docType === "prescription" ? "Prescription" : (docType === "lab_report" ? "Lab Test" : "Document"),
                category: cat,
                verificationStatus: "ai_extracted",
                title: d.fileName,
                subtitle: `${docType.replace('_', ' ').toUpperCase()} • ${d.ocrStatus === 'completed' ? 'OCR Processed' : (d.ocrStatus || 'pending')}`,
                details: d.aiSummary || null,
                documentId: d.id,
                ocrStatus: d.ocrStatus,
                hasOcrText: d.hasOcrText,
                extractedEntities: d.extractedEntities,
                source: d.source,
                canDelete: true,
            });
        });

        // Sort timeline chronologically (newest first)
        timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

        return res.status(200).json({
            success: true,
            history: {
                patient: {
                    id: patient.id,
                    name: `${patient.first_name} ${patient.last_name || ""}`.trim(),
                    email: patient.email,
                    phone: patient.phone,
                    dateOfBirth: patient.date_of_birth,
                    gender: patient.gender,
                    state: patient.state,
                    preferredLanguage: patient.preferred_language,
                },
                conditions,
                allergies,
                currentMedications,
                prescriptions,
                investigations,
                procedures,
                consultations,
                documents,
                assessments,
                timeline: timelineEvents,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. Get Authenticated Patient Medical ID
 * GET /api/patient/medical-id
 * Access: Authenticated patient only (derived from JWT req.user.id)
 */
async function getPatientMedicalId(req, res, next) {
    try {
        const patientId = req.user.id;

        // 0. Parse Time-Range Parameters
        const timeRangeParam = req.query.timeRange || (req.query.startDate || req.query.endDate ? "custom" : "1_year");
        const { startDate, endDate } = req.query;
        let cutoffDate = null;
        let endDateObj = null;

        if (startDate || endDate) {
            if (startDate) {
                const s = new Date(startDate);
                if (!isNaN(s.getTime())) cutoffDate = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                if (!isNaN(e.getTime())) {
                    endDateObj = e;
                    endDateObj.setHours(23, 59, 59, 999);
                }
            }
        } else {
            const now = new Date();
            if (timeRangeParam === "3_months") {
                cutoffDate = new Date(now);
                cutoffDate.setMonth(now.getMonth() - 3);
            } else if (timeRangeParam === "1_year") {
                cutoffDate = new Date(now);
                cutoffDate.setFullYear(now.getFullYear() - 1);
            } else if (timeRangeParam === "2_years") {
                cutoffDate = new Date(now);
                cutoffDate.setFullYear(now.getFullYear() - 2);
            } else if (timeRangeParam === "5_years") {
                cutoffDate = new Date(now);
                cutoffDate.setFullYear(now.getFullYear() - 5);
            } else if (timeRangeParam === "all") {
                cutoffDate = null;
            } else {
                // Default: 1 year
                cutoffDate = new Date(now);
                cutoffDate.setFullYear(now.getFullYear() - 1);
            }
        }

        function inDateRange(dateVal) {
            if (!dateVal) return true;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return true;
            if (cutoffDate && d < cutoffDate) return false;
            if (endDateObj && d > endDateObj) return false;
            return true;
        }

        // 1. Patient Identity & Profile
        const userRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.state, p.preferred_language,
                    p.interaction_mode, p.accessibility_preference, p.abha_id,
                    p.updated_at AS profile_updated_at
             FROM users u
             LEFT JOIN patient_profiles p ON u.id = p.user_id
             WHERE u.id = $1;`,
            [patientId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not found.",
            });
        }

        const p = userRes.rows[0];
        const dob = p.date_of_birth;
        let age = null;
        if (dob) {
            const birthDate = new Date(dob);
            if (!isNaN(birthDate.getTime())) {
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                if (age < 0) age = null;
            }
        }

        let bloodGroup = null;
        try {
            const bgRes = await pool.query(`SELECT blood_group FROM patient_profiles WHERE user_id = $1;`, [patientId]);
            if (bgRes.rows.length > 0 && bgRes.rows[0].blood_group) {
                bloodGroup = bgRes.rows[0].blood_group;
            }
        } catch (e) {
            // Safe fallback if column not present
        }

        // 2. Fetch Medical History (conditions, allergies, surgeries, etc.)
        const historyRes = await pool.query(
            `SELECT id, category, condition, description, diagnosed_at, status, notes, created_at, updated_at
             FROM medical_history
             WHERE patient_id = $1
               AND id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'medical_history')
             ORDER BY COALESCE(diagnosed_at, created_at::date) DESC;`,
            [patientId]
        );
        const historyRows = historyRes.rows;

        // 3. Fetch Documents & OCR Extractions
        const docsRes = await pool.query(
            `SELECT d.id, d.file_name, d.file_type, d.document_type, o.status AS ocr_status, d.created_at, d.updated_at,
                    o.extracted_entities, o.extracted_text, s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
               AND d.id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'document')
             ORDER BY d.created_at DESC;`,
            [patientId]
        );
        const docRows = docsRes.rows;

        // 4. Fetch Consultations
        const consultRes = await pool.query(
            `SELECT c.id, c.chief_complaint, c.clinical_notes, c.diagnosis, c.treatment_notes, c.started_at, c.created_at, c.updated_at,
                    u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                    dp.specialization AS doctor_specialization, dp.department AS doctor_department
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
             WHERE a.patient_id = $1
               AND c.id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'consultation')
             ORDER BY COALESCE(c.started_at, c.created_at) DESC;`,
            [patientId]
        );
        const consultRows = consultRes.rows;

        // 5. Fetch Clinical Sessions / Assessments
        const sessionRes = await pool.query(
            `SELECT id, consultation_type, chief_complaint, status, summary, current_state, created_at, updated_at
             FROM clinical_sessions
             WHERE patient_id = $1
               AND id NOT IN (SELECT source_id FROM patient_graveyard_items WHERE patient_id = $1 AND source_type = 'clinical_session')
             ORDER BY created_at DESC;`,
            [patientId]
        );
        const sessionRows = sessionRes.rows;

        // --- AGGREGATION & NORMALIZATION ---

        // ALLERGIES (Clinical Safety Rule: Retain active allergies even if predating cutoff)
        const allergies = [];
        historyRows.filter(r => r.category === "allergy").forEach(r => {
            const recordDate = r.diagnosed_at || r.created_at;
            const inPeriod = inDateRange(recordDate);
            const isCurrentlyActive = (r.status || "active").toLowerCase() === "active";
            if (inPeriod || isCurrentlyActive) {
                allergies.push({
                    id: r.id,
                    allergy: r.condition,
                    description: r.description || null,
                    status: r.status || "active",
                    date: recordDate,
                    source: r.notes || "Recorded Medical History",
                    verificationStatus: r.notes?.toLowerCase().includes("doctor") ? "verified" : "patient_reported",
                    inPeriod,
                    isCurrentlyActive
                });
            }
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.allergies)) {
                const docDate = entities.document_date || doc.created_at;
                const inPeriod = inDateRange(docDate);
                entities.allergies.forEach(alg => {
                    const algName = typeof alg === "string" ? alg : alg.name;
                    if (algName && !allergies.some(a => a.allergy.toLowerCase() === algName.toLowerCase())) {
                        allergies.push({
                            id: `ocr_alg_${doc.id}_${allergies.length}`,
                            allergy: algName,
                            description: null,
                            status: "active",
                            date: docDate,
                            source: doc.file_name,
                            verificationStatus: "ai_extracted",
                            inPeriod,
                            isCurrentlyActive: true
                        });
                    }
                });
            }
        });

        // CONDITIONS / DIAGNOSES (Clinical Safety Rule: Retain active conditions even if predating cutoff)
        const conditions = [];
        historyRows.filter(r => r.category === "condition").forEach(r => {
            const recordDate = r.diagnosed_at || r.created_at;
            const inPeriod = inDateRange(recordDate);
            const isCurrentlyActive = (r.status || "active").toLowerCase() === "active";
            if (inPeriod || isCurrentlyActive) {
                conditions.push({
                    id: r.id,
                    condition: r.condition,
                    diagnosedDate: recordDate,
                    status: r.status || "active",
                    source: r.notes || "Recorded Medical History",
                    verificationStatus: "verified",
                    inPeriod,
                    isCurrentlyActive
                });
            }
        });
        consultRows.forEach(c => {
            const consultDate = c.started_at || c.created_at;
            const inPeriod = inDateRange(consultDate);
            if (c.diagnosis && inPeriod && !conditions.some(cond => cond.condition.toLowerCase() === c.diagnosis.toLowerCase())) {
                conditions.push({
                    id: `consult_${c.id}`,
                    condition: c.diagnosis,
                    diagnosedDate: consultDate,
                    status: "active",
                    source: `Doctor Consultation (${c.doctor_first_name} ${c.doctor_last_name || ''})`.trim(),
                    verificationStatus: "verified",
                    inPeriod: true,
                    isCurrentlyActive: true
                });
            }
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.diagnoses)) {
                const docDate = entities.document_date || doc.created_at;
                const inPeriod = inDateRange(docDate);
                if (inPeriod) {
                    entities.diagnoses.forEach(diag => {
                        if (diag && diag.trim() && !conditions.some(c => c.condition.toLowerCase() === diag.trim().toLowerCase())) {
                            conditions.push({
                                id: `ocr_diag_${doc.id}_${conditions.length}`,
                                condition: diag.trim(),
                                diagnosedDate: docDate,
                                status: "active",
                                source: doc.file_name,
                                verificationStatus: "ai_extracted",
                                inPeriod: true,
                                isCurrentlyActive: true
                            });
                        }
                    });
                }
            }
        });

        // MEDICATIONS (Filtered by period, conservative wording "Recently recorded")
        const medications = [];
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.medications)) {
                const docDate = entities.document_date || doc.created_at;
                if (inDateRange(docDate)) {
                    entities.medications.forEach(med => {
                        const medName = med.medicine || med.name;
                        if (medName) {
                            medications.push({
                                id: `ocr_med_${doc.id}_${medications.length}`,
                                medicine: medName,
                                dosage: med.dose || med.dosage || null,
                                frequency: med.frequency || null,
                                duration: med.duration || null,
                                date: docDate,
                                source: doc.file_name,
                                verificationStatus: "ai_extracted",
                                inPeriod: true,
                                isCurrentlyActive: false
                            });
                        }
                    });
                }
            }
        });
        consultRows.forEach(c => {
            const consultDate = c.started_at || c.created_at;
            if (c.treatment_notes && inDateRange(consultDate)) {
                medications.push({
                    id: `consult_med_${c.id}`,
                    medicine: c.treatment_notes,
                    dosage: null,
                    frequency: "As prescribed",
                    duration: null,
                    date: consultDate,
                    source: `Dr. ${c.doctor_first_name} ${c.doctor_last_name || ''}`.trim(),
                    verificationStatus: "verified",
                    inPeriod: true,
                    isCurrentlyActive: false
                });
            }
        });

        // PAST PROCEDURES / SURGERIES
        const procedures = [];
        historyRows.filter(r => r.category === "surgery" || r.category === "hospitalization").forEach(r => {
            const procDate = r.diagnosed_at || r.created_at;
            if (inDateRange(procDate)) {
                procedures.push({
                    id: r.id,
                    procedure: r.condition,
                    date: procDate,
                    status: r.status || "completed",
                    source: r.notes || "Recorded Medical History",
                    verificationStatus: "verified"
                });
            }
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.procedures)) {
                const docDate = entities.document_date || doc.created_at;
                if (inDateRange(docDate)) {
                    entities.procedures.forEach(proc => {
                        if (proc && !procedures.some(p => p.procedure.toLowerCase() === proc.toLowerCase())) {
                            procedures.push({
                                id: `ocr_proc_${doc.id}_${procedures.length}`,
                                procedure: proc,
                                date: docDate,
                                status: "completed",
                                source: doc.file_name,
                                verificationStatus: "ai_extracted"
                            });
                        }
                    });
                }
            }
        });

        // RECENT CONSULTATIONS
        const consultations = consultRows
            .filter(c => inDateRange(c.started_at || c.created_at))
            .map(c => ({
                id: c.id,
                date: c.started_at || c.created_at,
                doctorName: `Dr. ${c.doctor_first_name} ${c.doctor_last_name || ''}`.trim(),
                specialization: c.doctor_specialization || "General Medicine",
                department: c.doctor_department || null,
                chiefComplaint: c.chief_complaint || "General Consultation",
                diagnosis: c.diagnosis || null,
                treatmentNotes: c.treatment_notes || null,
                clinicalNotes: c.clinical_notes || null,
                source: "Doctor Consultation"
            }));

        // INVESTIGATIONS / LAB RESULTS
        const investigations = [];
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.lab_results)) {
                const docDate = entities.document_date || doc.created_at;
                if (inDateRange(docDate)) {
                    entities.lab_results.forEach(lab => {
                        if (lab.test) {
                            investigations.push({
                                id: `lab_${doc.id}_${investigations.length}`,
                                test: lab.test,
                                value: lab.value || null,
                                unit: lab.unit || null,
                                referenceRange: lab.reference_range || null,
                                flag: lab.flag || "normal",
                                date: docDate,
                                source: doc.file_name,
                                verificationStatus: "ai_extracted"
                            });
                        }
                    });
                }
            }
        });

        // MEDICAL DOCUMENTS
        const documents = docRows
            .filter(d => inDateRange(d.created_at))
            .map(d => ({
                id: d.id,
                fileName: d.file_name,
                fileType: d.file_type,
                documentType: d.document_type || "other",
                date: d.created_at,
                ocrStatus: d.ocr_status || (d.extracted_text ? "completed" : "pending"),
                hasOcrText: !!d.extracted_text,
                aiSummary: d.ai_summary || null
            }));

        // HEALTH SUMMARY
        let healthSummary = {
            summary: null,
            isAiGenerated: false,
            source: null
        };
        const sessionWithSummary = sessionRows.find(s => s.summary && s.summary.trim().length > 0);
        const consultWithNotes = consultRows.find(c => c.clinical_notes && c.clinical_notes.trim().length > 0);
        if (sessionWithSummary) {
            healthSummary = {
                summary: sessionWithSummary.summary.trim(),
                isAiGenerated: true,
                source: "AI-generated from available MediKiosk clinical records"
            };
        } else if (consultWithNotes) {
            healthSummary = {
                summary: consultWithNotes.clinical_notes.trim(),
                isAiGenerated: false,
                source: `Recorded by Dr. ${consultWithNotes.doctor_first_name} ${consultWithNotes.doctor_last_name || ''}`.trim()
            };
        }

        // AYUSH HEALTH PROFILE (Extracted dynamically only if AYUSH session exists)
        let ayushProfile = null;
        const ayushSession = sessionRows.find(s => 
            s.consultation_type === "ayush" || 
            s.current_state?.consultation_type === "ayush"
        );
        if (ayushSession) {
            let cs = ayushSession.current_state;
            if (typeof cs === "string") { try { cs = JSON.parse(cs); } catch(e){ cs = {}; } }
            const af = cs?.answered_fields || cs?.clinical_entities || cs || {};
            let fields = {};
            if (Array.isArray(af)) {
                af.forEach(e => { if (e && e.field) fields[e.field.toLowerCase()] = e.value; });
            } else if (typeof af === "object" && af !== null) {
                Object.keys(af).forEach(k => { fields[k.toLowerCase()] = af[k]; });
            }
            const prakriti = fields.prakriti || cs?.prakriti || null;
            const vikriti = fields.vikriti || cs?.vikriti || null;
            const agni = fields.agni || cs?.agni || null;
            const koshtha = fields.koshtha || cs?.koshtha || null;
            const satmya = fields.satmya || cs?.satmya || null;
            const aharaVihara = fields.ahara_vihara || fields.aharavihara || fields.diet_lifestyle || cs?.ahara_vihara || null;
            if (prakriti || vikriti || agni || koshtha || satmya || aharaVihara || ayushSession.summary) {
                ayushProfile = {
                    id: ayushSession.id,
                    date: ayushSession.created_at,
                    prakriti,
                    vikriti,
                    agni,
                    koshtha,
                    satmya,
                    aharaVihara,
                    summary: ayushSession.summary || null
                };
            }
        }

        // MEDICAL TIMELINE (Unified chronological synthesis, newest first)
        const timeline = [];
        consultations.forEach(c => timeline.push({
            id: `timeline_consult_${c.id}`,
            type: "Consultation",
            category: "consultation",
            date: c.date,
            title: `Consultation with ${c.doctorName}`,
            subtitle: c.specialization,
            details: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : c.chiefComplaint,
            source: c.source
        }));
        conditions.filter(c => inDateRange(c.diagnosedDate)).forEach(c => timeline.push({
            id: `timeline_cond_${c.id}`,
            type: "Condition",
            category: "diagnosis",
            date: c.diagnosedDate,
            title: c.condition,
            subtitle: `Status: ${c.status}`,
            details: c.source,
            source: c.source
        }));
        allergies.filter(a => inDateRange(a.date)).forEach(a => timeline.push({
            id: `timeline_alg_${a.id}`,
            type: "Allergy",
            category: "allergy",
            date: a.date,
            title: a.allergy,
            subtitle: `Allergy Alert (${a.status})`,
            details: a.description || "Active allergy on record",
            source: a.source
        }));
        procedures.forEach(p => timeline.push({
            id: `timeline_proc_${p.id}`,
            type: "Procedure",
            category: "procedure",
            date: p.date,
            title: p.procedure,
            subtitle: `Status: ${p.status}`,
            details: p.source,
            source: p.source
        }));
        investigations.forEach(inv => timeline.push({
            id: `timeline_inv_${inv.id}`,
            type: "Investigation",
            category: "lab_test",
            date: inv.date,
            title: inv.test,
            subtitle: inv.value ? `${inv.value} ${inv.unit || ''}`.trim() : "Lab Result",
            details: `Source: ${inv.source}`,
            source: inv.source
        }));
        documents.forEach(d => timeline.push({
            id: `timeline_doc_${d.id}`,
            type: d.documentType === "prescription" ? "Prescription" : (d.documentType === "lab_report" ? "Lab Test" : "Document"),
            category: "document",
            date: d.date,
            title: d.fileName,
            subtitle: `${d.documentType.toUpperCase()} • ${d.ocrStatus}`,
            details: d.aiSummary || null,
            source: d.fileName
        }));
        sessionRows.filter(s => inDateRange(s.created_at)).forEach(s => timeline.push({
            id: `timeline_session_${s.id}`,
            type: "Assessment",
            category: "assessment",
            date: s.created_at,
            title: `Clinical Intake: ${s.chief_complaint || "General Intake"}`,
            subtitle: `Status: ${(s.status || "in_progress").toUpperCase()}`,
            details: s.summary || null,
            source: "MediKiosk Clinical Assessment"
        }));
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        // RECENT CLINICAL ASSESSMENT
        const recentAssessment = sessionRows.length > 0 ? {
            id: sessionRows[0].id,
            date: sessionRows[0].created_at,
            chiefComplaint: sessionRows[0].chief_complaint || "General Clinical Intake",
            status: sessionRows[0].status,
            summary: sessionRows[0].summary || (sessionRows[0].status === "completed" ? "Intake completed." : "In progress."),
            source: "MediKiosk Clinical Assessment"
        } : null;

        // RECORD STATS
        const recordStats = {
            clinicalRecords: conditions.length + allergies.length + procedures.length + medications.length,
            consultations: consultations.length,
            documents: documents.length,
            investigations: investigations.length,
            conditions: conditions.length,
            medications: medications.length
        };

        // LAST UPDATED
        const updateTimestamps = [
            p.profile_updated_at,
            ...historyRows.map(r => r.updated_at),
            ...docRows.map(r => r.created_at),
            ...sessionRows.map(r => r.created_at)
        ].filter(Boolean);
        const lastUpdated = updateTimestamps.length > 0 
            ? new Date(Math.max(...updateTimestamps.map(d => new Date(d)))).toISOString() 
            : new Date().toISOString();

        const passportData = {
            patient: {
                id: p.id,
                name: `${p.first_name} ${p.last_name || ''}`.trim(),
                firstName: p.first_name,
                lastName: p.last_name || '',
                dateOfBirth: dob || null,
                age: age,
                gender: p.gender || null,
                bloodGroup: bloodGroup || null,
                phone: p.phone || null,
                email: p.email || null,
                state: p.state || null,
                preferredLanguage: p.preferred_language || null,
                abhaId: p.abha_id || null,
                interactionMode: p.interaction_mode || null,
                accessibilityPreference: p.accessibility_preference || null
            },
            healthSummary,
            allergies,
            conditions,
            medications,
            procedures,
            consultations,
            investigations,
            documents,
            timeline,
            ayushProfile,
            recentAssessment,
            recordStats,
            timeRange: timeRangeParam,
            appliedDateRange: {
                startDate: cutoffDate ? cutoffDate.toISOString() : null,
                endDate: endDateObj ? endDateObj.toISOString() : null
            },
            lastUpdated
        };

        return res.status(200).json({
            success: true,
            medicalPassport: passportData,
            medicalId: passportData // Backwards compatibility alias
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 6. Generate Short-Lived QR Pairing Token for Patient
 * POST /api/patient/medical-id/qr
 * Access: Authenticated patient only
 */
async function generatePatientQrToken(req, res, next) {
    try {
        const crypto = require("crypto");
        const patientId = req.user.id;

        // 1. Generate 32-byte random hex token
        const rawToken = crypto.randomBytes(32).toString("hex");

        // 2. Compute SHA-256 hash of the token
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        // 3. Generate 6-digit display code (e.g. MK-748291)
        const displayCode = `MK-${Math.floor(100000 + Math.random() * 900000)}`;

        // 4. Set expiration to 5 minutes from now
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 5. Store in patient_qr_pairing_tokens
        await pool.query(
            `INSERT INTO patient_qr_pairing_tokens (patient_id, token_hash, token_display_code, expires_at)
             VALUES ($1, $2, $3, $4);`,
            [patientId, tokenHash, displayCode, expiresAt]
        );

        // 6. Secure QR Payload containing ONLY token reference
        const qrPayload = JSON.stringify({
            type: "MEDIKIOSK_PAIRING",
            token: rawToken,
            code: displayCode,
        });

        return res.status(200).json({
            success: true,
            qrPayload,
            pairingCode: displayCode,
            rawToken,
            expiresAt: expiresAt.toISOString(),
            expiresInSeconds: 300,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 7. Get Patient's Connected Care Providers (Doctors)
 * GET /api/patient/connected-doctors
 * Access: Authenticated patient only
 */
async function getConnectedDoctors(req, res, next) {
    try {
        const patientId = req.user.id;

        const result = await pool.query(
            `SELECT pdr.id AS relationship_id, pdr.status, pdr.consent_method, pdr.created_at AS connected_at,
                    u.id AS doctor_id, u.first_name, u.last_name, u.email, u.phone,
                    dp.specialization, dp.department, dp.registration_number
             FROM patient_doctor_relationships pdr
             JOIN users u ON pdr.doctor_id = u.id
             LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
             WHERE pdr.patient_id = $1
             ORDER BY pdr.created_at DESC;`,
            [patientId]
        );

        const connectedDoctors = result.rows.map((r) => ({
            relationshipId: r.relationship_id,
            doctorId: r.doctor_id,
            firstName: r.first_name,
            lastName: r.last_name || "",
            doctorName: `Dr. ${r.first_name} ${r.last_name || ""}`.trim(),
            specialization: r.specialization || "General Medicine",
            department: r.department || "OPD",
            registrationNumber: r.registration_number,
            status: r.status,
            consentMethod: r.consent_method,
            connectedAt: r.connected_at,
        }));

        return res.status(200).json({
            success: true,
            connectedDoctors,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 8. Revoke Connected Doctor Access (Patient Consent Revocation)
 * DELETE /api/patient/connected-doctors/:relationshipId
 * Access: Authenticated patient only
 */
async function revokeDoctorAccess(req, res, next) {
    try {
        const patientId = req.user.id;
        const { relationshipId } = req.params;

        const result = await pool.query(
            `WITH revoked AS (
                UPDATE patient_doctor_relationships SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND patient_id = $2 RETURNING *
             ), revoked_documents AS (
                UPDATE document_access da SET revoked_at = CURRENT_TIMESTAMP
                FROM documents d, revoked r
                WHERE da.document_id = d.id AND d.patient_id = r.patient_id AND da.user_id = r.doctor_id
             ), revoked_insurance AS (
                UPDATE insurance_policy_access ipa SET revoked_at = CURRENT_TIMESTAMP
                FROM insurance_policies policy, revoked r
                WHERE ipa.policy_id = policy.id AND policy.patient_id = r.patient_id
                  AND ipa.revoked_at IS NULL
                  AND (ipa.grantee_user_id = r.doctor_id OR ipa.grantee_user_id IN (
                    SELECT staff.id FROM users staff
                    WHERE staff.role = 'receptionist' AND staff.created_by_doctor_id = r.doctor_id
                  ))
             ) SELECT * FROM revoked;`,
            [relationshipId, patientId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Connected care provider relationship not found or unauthorized.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Doctor access successfully revoked.",
            relationship: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 9. Add Medical History Item
 * POST /api/patient/history
 * Access: Authenticated patient only
 */
async function addMedicalHistoryItem(req, res, next) {
    try {
        const patientId = req.user.id;
        const { category = "condition", condition, description, diagnosed_at, status = "active", notes } = req.body;

        if (!condition || !condition.trim()) {
            return res.status(400).json({
                success: false,
                message: "Condition or diagnosis name is required.",
            });
        }

        const validCategories = ["condition", "allergy", "surgery", "hospitalization", "procedure", "other"];
        const recordCategory = validCategories.includes(category) ? category : "condition";

        const result = await pool.query(
            `INSERT INTO medical_history (patient_id, category, condition, description, diagnosed_at, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, category, condition, description, diagnosed_at, status, notes, created_at;`,
            [patientId, recordCategory, condition.trim(), description || null, diagnosed_at || null, status, notes || null]
        );

        return res.status(201).json({
            success: true,
            message: "Medical history record added successfully.",
            record: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 10. Delete Medical History Item
 * DELETE /api/patient/history/:id
 * Access: Authenticated patient only
 */
async function deleteMedicalHistoryItem(req, res, next) {
    try {
        const patientId = req.user.id;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Medical history record ID is required.",
            });
        }

        // 1. Try deleting from medical_history table
        const medResult = await pool.query(
            `DELETE FROM medical_history WHERE id = $1 AND patient_id = $2 RETURNING id;`,
            [id, patientId]
        );

        if (medResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Medical history record deleted successfully.",
                deletedId: id,
            });
        }

        // 2. Fallback check: if the ID is a clinical_session owned by this patient
        const sessResult = await pool.query(
            `DELETE FROM clinical_sessions WHERE id = $1 AND patient_id = $2 RETURNING id;`,
            [id, patientId]
        );

        if (sessResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Clinical assessment session deleted successfully.",
                deletedId: id,
            });
        }

        return res.status(404).json({
            success: false,
            message: "Medical record not found or unauthorized.",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 11. Clear All Medical History Records for Patient
 * DELETE /api/patient/history
 * Access: Authenticated patient only
 */
async function clearAllMedicalHistory(req, res, next) {
    try {
        const patientId = req.user.id;

        await pool.query(
            `DELETE FROM medical_history WHERE patient_id = $1;`,
            [patientId]
        );

        return res.status(200).json({
            success: true,
            message: "All medical history records cleared successfully.",
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    saveOnboardingPreferences,
    getOnboardingPreferences,
    updatePatientProfile,
    getPatientMedicalHistory,
    addMedicalHistoryItem,
    deleteMedicalHistoryItem,
    clearAllMedicalHistory,
    getPatientMedicalId,
    generatePatientQrToken,
    getConnectedDoctors,
    revokeDoctorAccess,
};
