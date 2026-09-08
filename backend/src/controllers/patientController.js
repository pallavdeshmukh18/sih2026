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
            `SELECT id, chief_complaint, status, summary, current_state, created_at, updated_at
             FROM clinical_sessions
             WHERE patient_id = $1
             ORDER BY created_at DESC;`,
            [patientId]
        );

        const assessments = sessionsRes.rows.map((row) => {
            const state = row.current_state || {};
            return {
                id: row.id,
                chiefComplaint: row.chief_complaint,
                status: row.status,
                summary: row.summary || (row.status === "completed" ? "Intake session completed." : "Intake session in progress."),
                date: row.created_at,
                redFlags: state.red_flags || [],
                source: "MediKiosk Clinical Assessment",
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
            title: c.name,
            subtitle: `Diagnosed (${c.status})`,
            details: c.description || c.notes,
            source: c.source,
        }));

        allergies.forEach(a => timelineEvents.push({
            id: `timeline_allergy_${a.id}`,
            date: a.date,
            type: "Allergy",
            title: a.name,
            subtitle: "Allergy Record",
            details: a.description,
            source: a.source,
        }));

        procedures.forEach(p => timelineEvents.push({
            id: `timeline_proc_${p.id}`,
            date: p.date,
            type: "Procedure",
            title: p.name,
            subtitle: `Procedure (${p.status})`,
            details: p.description || p.notes,
            source: p.source,
        }));

        consultations.forEach(c => timelineEvents.push({
            id: `timeline_consult_${c.id}`,
            date: c.date,
            type: "Consultation",
            title: `Consultation with ${c.doctorName}`,
            subtitle: c.specialization,
            details: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : c.chiefComplaint,
            source: c.source,
        }));

        assessments.forEach(a => timelineEvents.push({
            id: `timeline_assess_${a.id}`,
            date: a.date,
            type: "Assessment",
            title: `Clinical Intake: ${a.chiefComplaint || "General Intake"}`,
            subtitle: `Status: ${a.status}`,
            details: a.summary,
            source: a.source,
        }));

        documents.forEach(d => timelineEvents.push({
            id: `timeline_doc_${d.id}`,
            date: d.date,
            type: "Document",
            title: d.fileName,
            subtitle: `${d.documentType.replace('_', ' ').toUpperCase()} • ${d.ocrStatus === 'completed' ? 'OCR Processed' : d.ocrStatus}`,
            details: d.aiSummary || null,
            documentId: d.id,
            source: d.source,
        }));

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

module.exports = {
    saveOnboardingPreferences,
    getOnboardingPreferences,
    updatePatientProfile,
    getPatientMedicalHistory,
};
