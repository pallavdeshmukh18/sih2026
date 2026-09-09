const pool = require("../config/db");

const ALLOWED_LANGUAGES = [
    "en", "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or", "as"
];

const ALLOWED_INTERACTION_MODES = [
    "voice", "touch", "voice_touch"
];

const ALLOWED_ACCESSIBILITY_PREFERENCES = [
    "none", "large_text", "voice_guidance", "hearing_assistance"
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
async function updatePatientProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const { firstName, lastName, dateOfBirth, gender, state, preferredLanguage, interactionMode, accessibilityPreference } = req.body;

        // Validation for allowed dropdown values if supplied
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
                `INSERT INTO patient_profiles (user_id, date_of_birth, gender, state, preferred_language, interaction_mode, accessibility_preference)
                 VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                [userId, dateOfBirth || null, gender || null, state || null, preferredLanguage || null, interactionMode || null, accessibilityPreference || null]
            );
        } else {
            await pool.query(
                `UPDATE patient_profiles
                 SET date_of_birth = COALESCE($1, date_of_birth),
                     gender = COALESCE($2, gender),
                     state = COALESCE($3, state),
                     preferred_language = COALESCE($4, preferred_language),
                     interaction_mode = COALESCE($5, interaction_mode),
                     accessibility_preference = COALESCE($6, accessibility_preference),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $7;`,
                [dateOfBirth || null, gender || null, state || null, preferredLanguage || null, interactionMode || null, accessibilityPreference || null, userId]
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
        const sessionsRes = await pool.query(
            `SELECT id, chief_complaint, status, summary, conversation_history, current_state, created_at, updated_at
             FROM clinical_sessions
             WHERE patient_id = $1
             ORDER BY created_at DESC;`,
            [patientId]
        );

        const assessments = sessionsRes.rows.map((row) => {
            const state = row.current_state || {};
            let history = row.conversation_history;
            if (typeof history === "string") {
                try { history = JSON.parse(history); } catch (e) { history = []; }
            }
            if (!Array.isArray(history) && state.conversation_history) {
                history = state.conversation_history;
            }
            return {
                id: row.id,
                chiefComplaint: row.chief_complaint,
                status: row.status,
                summary: row.summary || (row.status === "completed" ? "Intake session completed." : "Intake session in progress."),
                date: row.created_at,
                redFlags: state.red_flags || [],
                answeredFields: state.answered_fields || {},
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
            date: c.date,
            type: "Condition",
            category: "diagnosis",
            verificationStatus: "patient_reported",
            title: c.name,
            subtitle: `Diagnosed (${c.status})`,
            details: c.description || c.notes,
            source: c.source,
        }));

        allergies.forEach(a => timelineEvents.push({
            id: `timeline_allergy_${a.id}`,
            date: a.date,
            type: "Allergy",
            category: "allergy",
            verificationStatus: "patient_reported",
            title: a.name,
            subtitle: "Allergy Record",
            details: a.description,
            source: a.source,
        }));

        procedures.forEach(p => timelineEvents.push({
            id: `timeline_proc_${p.id}`,
            date: p.date,
            type: "Procedure",
            category: "procedure",
            verificationStatus: "patient_reported",
            title: p.name,
            subtitle: `Procedure (${p.status})`,
            details: p.description || p.notes,
            source: p.source,
        }));

        consultations.forEach(c => timelineEvents.push({
            id: `timeline_consult_${c.id}`,
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
        }));

        assessments.forEach(a => timelineEvents.push({
            id: `timeline_assess_${a.id}`,
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
        }));

        documents.forEach(d => {
            let cat = "document";
            if (d.documentType === "prescription") cat = "prescription";
            else if (d.documentType === "lab_report" || d.documentType === "scan") cat = "lab_test";

            timelineEvents.push({
                id: `timeline_doc_${d.id}`,
                date: d.date,
                type: d.documentType === "prescription" ? "Prescription" : (d.documentType === "lab_report" ? "Lab Test" : "Document"),
                category: cat,
                verificationStatus: "ai_extracted",
                title: d.fileName,
                subtitle: `${d.documentType.replace('_', ' ').toUpperCase()} • ${d.ocrStatus === 'completed' ? 'OCR Processed' : d.ocrStatus}`,
                details: d.aiSummary || null,
                documentId: d.id,
                ocrStatus: d.ocrStatus,
                hasOcrText: d.hasOcrText,
                extractedEntities: d.extractedEntities,
                source: d.source,
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

        // 1. Patient Identity & Profile
        const userRes = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.state, p.preferred_language,
                    p.interaction_mode, p.accessibility_preference, p.updated_at AS profile_updated_at
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

        // 2. Fetch Medical History (conditions, allergies, surgeries, etc.)
        const historyRes = await pool.query(
            `SELECT id, category, condition, description, diagnosed_at, status, notes, created_at, updated_at
             FROM medical_history
             WHERE patient_id = $1
             ORDER BY COALESCE(diagnosed_at, created_at::date) DESC;`,
            [patientId]
        );
        const historyRows = historyRes.rows;

        // 3. Fetch Documents & OCR Extractions
        const docsRes = await pool.query(
            `SELECT d.id, d.file_name, d.file_type, d.document_type, d.created_at, d.updated_at,
                    o.extracted_entities, o.extracted_text, s.summary AS ai_summary
             FROM documents d
             LEFT JOIN document_ocr o ON d.id = o.document_id
             LEFT JOIN ai_summaries s ON d.id = s.document_id
             WHERE d.patient_id = $1
             ORDER BY d.created_at DESC;`,
            [patientId]
        );
        const docRows = docsRes.rows;

        // 4. Fetch Consultations
        const consultRes = await pool.query(
            `SELECT c.id, c.chief_complaint, c.diagnosis, c.treatment_notes, c.started_at, c.created_at, c.updated_at,
                    u.first_name AS doctor_first_name, u.last_name AS doctor_last_name
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             JOIN users u ON a.doctor_id = u.id
             WHERE a.patient_id = $1
             ORDER BY c.created_at DESC;`,
            [patientId]
        );
        const consultRows = consultRes.rows;

        // 5. Fetch Clinical Sessions / Assessments
        const sessionRes = await pool.query(
            `SELECT id, chief_complaint, status, summary, current_state, created_at, updated_at
             FROM clinical_sessions
             WHERE patient_id = $1
             ORDER BY created_at DESC;`,
            [patientId]
        );
        const sessionRows = sessionRes.rows;

        // --- AGGREGATION & NORMALIZATION ---

        // ALLERGIES
        const allergies = [];
        historyRows.filter(r => r.category === "allergy").forEach(r => {
            allergies.push({
                id: r.id,
                allergy: r.condition,
                description: r.description || null,
                source: r.notes || "Recorded Medical History",
                verificationStatus: r.notes?.toLowerCase().includes("doctor") ? "verified" : "patient_reported"
            });
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.allergies)) {
                entities.allergies.forEach(alg => {
                    const algName = typeof alg === "string" ? alg : alg.name;
                    if (algName && !allergies.some(a => a.allergy.toLowerCase() === algName.toLowerCase())) {
                        allergies.push({
                            id: `ocr_alg_${doc.id}_${allergies.length}`,
                            allergy: algName,
                            description: null,
                            source: doc.file_name,
                            verificationStatus: "ai_extracted"
                        });
                    }
                });
            }
        });

        // CONDITIONS / DIAGNOSES
        const conditions = [];
        historyRows.filter(r => r.category === "condition").forEach(r => {
            conditions.push({
                id: r.id,
                condition: r.condition,
                diagnosedDate: r.diagnosed_at || r.updated_at,
                status: r.status || "active",
                source: r.notes || "Recorded Medical History",
                verificationStatus: "verified"
            });
        });
        consultRows.forEach(c => {
            if (c.diagnosis && !conditions.some(cond => cond.condition.toLowerCase() === c.diagnosis.toLowerCase())) {
                conditions.push({
                    id: `consult_${c.id}`,
                    condition: c.diagnosis,
                    diagnosedDate: c.started_at || c.created_at,
                    status: "active",
                    source: `Doctor Consultation (${c.doctor_first_name} ${c.doctor_last_name || ''})`.trim(),
                    verificationStatus: "verified"
                });
            }
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.diagnoses)) {
                entities.diagnoses.forEach(diag => {
                    if (diag && diag.trim() && !conditions.some(c => c.condition.toLowerCase() === diag.trim().toLowerCase())) {
                        conditions.push({
                            id: `ocr_diag_${doc.id}_${conditions.length}`,
                            condition: diag.trim(),
                            diagnosedDate: entities.document_date || doc.created_at,
                            status: "active",
                            source: doc.file_name,
                            verificationStatus: "ai_extracted"
                        });
                    }
                });
            }
        });

        // CURRENT MEDICATIONS
        const medications = [];
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.medications)) {
                entities.medications.forEach(med => {
                    const medName = med.medicine || med.name;
                    if (medName) {
                        medications.push({
                            id: `ocr_med_${doc.id}_${medications.length}`,
                            medicine: medName,
                            dosage: med.dose || med.dosage || null,
                            frequency: med.frequency || null,
                            duration: med.duration || null,
                            source: doc.file_name,
                            verificationStatus: "ai_extracted"
                        });
                    }
                });
            }
        });
        consultRows.forEach(c => {
            if (c.treatment_notes) {
                medications.push({
                    id: `consult_med_${c.id}`,
                    medicine: c.treatment_notes,
                    dosage: null,
                    frequency: "As prescribed",
                    duration: null,
                    source: `Dr. ${c.doctor_first_name} ${c.doctor_last_name || ''}`.trim(),
                    verificationStatus: "verified"
                });
            }
        });

        // PAST PROCEDURES / SURGERIES
        const procedures = [];
        historyRows.filter(r => r.category === "surgery" || r.category === "hospitalization").forEach(r => {
            procedures.push({
                id: r.id,
                procedure: r.condition,
                date: r.diagnosed_at || r.updated_at,
                status: r.status || "completed",
                source: r.notes || "Recorded Medical History",
                verificationStatus: "verified"
            });
        });
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.procedures)) {
                entities.procedures.forEach(proc => {
                    if (proc && !procedures.some(p => p.procedure.toLowerCase() === proc.toLowerCase())) {
                        procedures.push({
                            id: `ocr_proc_${doc.id}_${procedures.length}`,
                            procedure: proc,
                            date: doc.created_at,
                            status: "completed",
                            source: doc.file_name,
                            verificationStatus: "ai_extracted"
                        });
                    }
                });
            }
        });

        // INVESTIGATIONS / LAB RESULTS
        const investigations = [];
        docRows.forEach(doc => {
            let entities = doc.extracted_entities;
            if (typeof entities === "string") { try { entities = JSON.parse(entities); } catch(e){} }
            if (entities && Array.isArray(entities.lab_results)) {
                entities.lab_results.forEach(lab => {
                    if (lab.test) {
                        investigations.push({
                            id: `lab_${doc.id}_${investigations.length}`,
                            test: lab.test,
                            value: lab.value || null,
                            unit: lab.unit || null,
                            referenceRange: lab.reference_range || null,
                            flag: lab.flag || "normal",
                            date: doc.created_at,
                            source: doc.file_name,
                            verificationStatus: "ai_extracted"
                        });
                    }
                });
            }
        });

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
            documents: docRows.length,
            conditions: conditions.length,
            medications: medications.length,
            assessments: sessionRows.length
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

        return res.status(200).json({
            success: true,
            medicalId: {
                patient: {
                    id: p.id,
                    name: `${p.first_name} ${p.last_name || ''}`.trim(),
                    firstName: p.first_name,
                    lastName: p.last_name || '',
                    dateOfBirth: dob || null,
                    age: age,
                    gender: p.gender || null,
                    bloodGroup: "Not recorded",
                    phone: p.phone || null,
                    email: p.email || null,
                    state: p.state || null,
                    preferredLanguage: p.preferred_language || null,
                    interactionMode: p.interaction_mode || null,
                    accessibilityPreference: p.accessibility_preference || null
                },
                allergies,
                conditions,
                medications,
                procedures,
                investigations,
                recentAssessment,
                recordStats,
                lastUpdated
            }
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

module.exports = {
    saveOnboardingPreferences,
    getOnboardingPreferences,
    updatePatientProfile,
    getPatientMedicalHistory,
    getPatientMedicalId,
    generatePatientQrToken,
    getConnectedDoctors,
    revokeDoctorAccess,
};

