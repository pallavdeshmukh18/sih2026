const pool = require("../config/db");
const mlService = require("./mlService");
const crypto = require("crypto");

class ClinicalSessionError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

/**
 * Shared Clinical Session Business Logic Service
 *
 * Used by BOTH the website sessionController (JWT authenticated) and the
 * whatsappClinicalController (service key authenticated).
 *
 * Guarantees a single authoritative clinical pipeline for:
 * - Duplicate active session checks
 * - ML session initialization
 * - PostgreSQL clinical_sessions persistence
 * - Entity extraction & red-flag aggregation
 * - Final physician summary generation
 */

/**
 * 1. Start Clinical Intake Session Core Logic
 */
async function startSessionCore({
    patientId,
    appointmentId = null,
    language = "en",
    consultationType = "allopathic",
    chiefComplaint,
    cancelIfDifferentComplaint = false,
}) {
    if (!chiefComplaint || !chiefComplaint.trim()) {
        throw new ClinicalSessionError(400, "Missing required field: chiefComplaint is required.");
    }

    const isUuid = (val) =>
        typeof val === "string" &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

    let validAppointmentId = null;
    if (appointmentId) {
        if (!isUuid(appointmentId)) {
            throw new ClinicalSessionError(400, "Invalid appointmentId format. Expected a valid UUID.");
        }

        const apptRes = await pool.query(
            `SELECT id, patient_id, doctor_id, status FROM appointments WHERE id = $1;`,
            [appointmentId]
        );
        if (apptRes.rows.length === 0) {
            throw new ClinicalSessionError(404, "Appointment not found.");
        }

        const appointment = apptRes.rows[0];
        if (patientId && appointment.patient_id !== patientId) {
            throw new ClinicalSessionError(403, "Unauthorized: Appointment belongs to another patient.");
        }
        validAppointmentId = appointmentId;
    }

    // Check if an active session already exists in PostgreSQL
    let existingSession;
    if (validAppointmentId) {
        existingSession = await pool.query(
            `SELECT * FROM clinical_sessions WHERE appointment_id = $1 AND status = 'active';`,
            [validAppointmentId]
        );
    } else {
        existingSession = await pool.query(
            `SELECT * FROM clinical_sessions WHERE patient_id = $1 AND appointment_id IS NULL AND status = 'active';`,
            [patientId]
        );
    }

    if (existingSession.rows.length > 0) {
        const currentSession = existingSession.rows[0];

        // If the existing session had the bot prompt as chief complaint,
        // repair it with the new legitimate chiefComplaint supplied by the patient:
        const isCorruptComplaint = currentSession.chief_complaint &&
            (currentSession.chief_complaint.toLowerCase().includes("let's begin your clinical assessment") ||
             currentSession.chief_complaint.toLowerCase().includes("describe your main health concern"));

        if (isCorruptComplaint && chiefComplaint) {
            await pool.query(
                `UPDATE clinical_sessions
                 SET chief_complaint = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2;`,
                [chiefComplaint, currentSession.id]
            );
            if (currentSession.current_state) {
                currentSession.current_state.chief_complaint = chiefComplaint;
                await pool.query(
                    `UPDATE clinical_sessions
                     SET current_state = $1
                     WHERE id = $2;`,
                    [JSON.stringify(currentSession.current_state), currentSession.id]
                );
            }
        } else if (cancelIfDifferentComplaint && (currentSession.language !== language || (chiefComplaint && currentSession.chief_complaint !== chiefComplaint))) {
            await pool.query(
                `UPDATE clinical_sessions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                [currentSession.id]
            );
            existingSession.rows = [];
        }

        if (existingSession.rows.length > 0) {
            const currentState = currentSession.current_state || {};
            return {
                isExisting: true,
                sessionId: currentSession.id,
                session: currentSession,
                state: currentState,
                nextQuestion:
                    currentState.current_question ||
                    currentState.conversation_history?.slice(-1)[0]?.content ||
                    "How can I help you today?",
                options: currentState.current_options || currentState.options || [],
            };
        }
    }

    // Call FastAPI ML service to initialize clinical ontology state
    let mlSessionResponse;
    try {
        mlSessionResponse = await mlService.startClinicalSession(
            patientId,
            language,
            consultationType,
            chiefComplaint
        );
    } catch (mlErr) {
        console.warn("[ML FALLBACK] Clinical AI service unavailable, using local session initial state:", mlErr.message);
        
        const fallbackQuestions = {
            hi: `मेडीकियोस्क में आपका स्वागत है। आपको ${chiefComplaint} की समस्या कितने समय से हो रही है?`,
            mr: `मेडीकियोस्कंमध्ये आपले स्वागत आहे. तुम्हाला ${chiefComplaint} चा त्रास किती दिवसांपासून होत आहे?`,
            gu: `મેડીકિયોસ્કમાં તમારું સ્વાગત છે. તમને ${chiefComplaint} ની તકલીફ કેટલા સમયથી થઈ રહી છે?`,
            bn: `মেডিকিয়োস্কে আপনাকে স্বাগতম। আপনি কত দিন ধরে ${chiefComplaint} অনুভব করছেন?`,
            ta: `மெடிகியோஸ்கிற்கு நல்வரவு. எவ்வளவு காலமாக ${chiefComplaint} பிரச்சினை இருக்கிறது?`,
            te: `మెడికియోస్క్‌కి స్వాగతం. ఎంతకాలంగా ${chiefComplaint} సమస్యతో బాధపడుతున్నారు?`,
            kn: `ಮೆಡಿಕಿಯೋಸ್ಕ್‌ಗೆ ಸ್ವಾಗತನ. ಎಷ್ಟು ದಿನಗಳಿಂದ ${chiefComplaint} ಸಮಸ್ಯೆ ಇದೆ?`,
            ml: `മെഡികിയോസ്കിലേക്ക് സ്വാഗതം. എത്ര നാളായി ${chiefComplaint} പ്രശ്നം അനുഭവപ്പെടുന്നു?`,
            pa: `ਮੈਡੀਕਿਓਸਕ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਤੁਹਾਨੂੰ ${chiefComplaint} ਦੀ ਸਮੱਸਿਆ ਕਿੰਨੇ ਸਮੇਂ ਤੋਂ ਹੋ ਰਹੀ ਹੈ?`,
            or: `ମେଡିକିଓସ୍କକୁ ସ୍ୱାଗତ। କେତେ ଦିନ ହେବ ${chiefComplaint} ସମସ୍ୟା ଅଛି?`,
            as: `মেডিকিয়স্কলৈ স্বাগতম। কিমান দিনৰ পৰা ${chiefComplaint} समस्या হৈছে?`
        };
        const fallbackOptionsMap = {
            hi: [
                { id: "dur_today", label: "आज ही शुरू हुआ" },
                { id: "dur_few_days", label: "कुछ दिनों से" },
                { id: "dur_few_weeks", label: "कुछ हफ्तों से" },
                { id: "dur_chronic", label: "लंबे समय से / पुराना" }
            ],
            mr: [
                { id: "dur_today", label: "आजच सुरू झाले" },
                { id: "dur_few_days", label: "काही दिवसांपासून" },
                { id: "dur_few_weeks", label: "काही आठवड्यांपासून" },
                { id: "dur_chronic", label: "दीर्घकालीन / जुना त्रास" }
            ],
            gu: [
                { id: "dur_today", label: "આજે જ શરૂ થયું" },
                { id: "dur_few_days", label: "કેટલાક દિવસોથી" },
                { id: "dur_few_weeks", label: "કેટલાક અઠવાડિયાથી" },
                { id: "dur_chronic", label: "લાંબા સમયથી / જૂનું" }
            ]
        };

        const fallbackQText = fallbackQuestions[language] || `Welcome to MediKiosk. How long have you been experiencing ${chiefComplaint}?`;
        const fallbackOptsList = fallbackOptionsMap[language] || [
            { id: "dur_today", label: "Just started today" },
            { id: "dur_few_days", label: "A few days" },
            { id: "dur_few_weeks", label: "A few weeks" },
            { id: "dur_chronic", label: "Long term / Chronic" }
        ];

        mlSessionResponse = {
            session_id: crypto.randomUUID(),
            next_question: fallbackQText,
            options: fallbackOptsList,
            state: {
                session_id: crypto.randomUUID(),
                patient_id: patientId,
                language,
                consultation_type: consultationType,
                chief_complaint: chiefComplaint,
                answered_fields: {},
                missing_fields: ["onset", "duration", "severity", "associated_symptoms"],
                clinical_entities: [],
                red_flags: [],
                conversation_history: [
                    { role: "system", content: fallbackQText }
                ],
                current_question: fallbackQText,
                current_options: fallbackOptsList,
                status: "active"
            }
        };
    }

    const sessionId = mlSessionResponse.session_id || crypto.randomUUID();
    const initialState = mlSessionResponse.state || {};

    // Persist new clinical session to PostgreSQL
    const insertQuery = `
        INSERT INTO clinical_sessions (id, patient_id, appointment_id, language, consultation_type, chief_complaint, status, current_state)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
        RETURNING *;
    `;
    const result = await pool.query(insertQuery, [
        sessionId,
        patientId,
        validAppointmentId,
        language,
        consultationType,
        chiefComplaint,
        JSON.stringify(initialState),
    ]);

    return {
        isExisting: false,
        sessionId: result.rows[0].id,
        session: result.rows[0],
        nextQuestion: mlSessionResponse.next_question,
        options: mlSessionResponse.options || [],
        state: result.rows[0].current_state,
    };
}

/**
 * 2. Process Text Intake Turn Core Logic
 */
async function processTextTurnCore({ sessionId, patientId = null, patientText }) {
    if (!patientText || !patientText.trim()) {
        throw new ClinicalSessionError(400, "patientText is required.");
    }

    const sessionRes = await pool.query(
        `SELECT * FROM clinical_sessions WHERE id = $1;`,
        [sessionId]
    );
    if (sessionRes.rows.length === 0) {
        throw new ClinicalSessionError(404, "Clinical session not found.");
    }

    const session = sessionRes.rows[0];

    // Session Ownership Verification
    if (patientId && session.patient_id !== patientId) {
        throw new ClinicalSessionError(403, "Unauthorized: Session belongs to another patient.");
    }

    if (session.status !== "active") {
        throw new ClinicalSessionError(400, `Session is already ${session.status}.`);
    }

    // 1. Send to Clinical AI
    let clinicalAiResult;
    try {
        clinicalAiResult = await mlService.respondClinicalSession(
            sessionId,
            patientText,
            session.current_state
        );
    } catch (aiErr) {
        console.warn("[ML FALLBACK] Clinical AI fallback for text turn:", aiErr.message);
        clinicalAiResult = {
            next_question: "Are there any other details you would like to mention?",
            extracted_entities: [{ field: "text_response", value: patientText, confidence: "High" }],
            red_flags: [],
            is_complete: false,
        };
    }

    // 2. Update session state
    const currentState = clinicalAiResult.state || session.current_state || {};
    if (!currentState.conversation_history) currentState.conversation_history = [];

    const lastPatient = currentState.conversation_history
        .slice(-2)
        .find((m) => m.role === "patient" && m.content === patientText);
    if (!lastPatient) {
        currentState.conversation_history.push({ role: "patient", content: patientText });
    }

    if (clinicalAiResult.next_question) {
        const lastSystem = currentState.conversation_history.slice(-1)[0];
        if (!lastSystem || lastSystem.role !== "system" || lastSystem.content !== clinicalAiResult.next_question) {
            currentState.conversation_history.push({ role: "system", content: clinicalAiResult.next_question });
        }
    }

    if (clinicalAiResult.extracted_entities) {
        currentState.clinical_entities = clinicalAiResult.extracted_entities;
    }

    if (clinicalAiResult.red_flags) {
        currentState.red_flags = Array.from(
            new Set([...(currentState.red_flags || []), ...clinicalAiResult.red_flags])
        );
    }

    const newStatus = clinicalAiResult.is_complete ? "completed" : "active";

    await pool.query(
        `UPDATE clinical_sessions
         SET current_state = $1, status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3;`,
        [JSON.stringify(currentState), newStatus, sessionId]
    );

    return {
        sessionId,
        nextQuestion: clinicalAiResult.next_question,
        options: clinicalAiResult.options || [],
        extractedEntities: clinicalAiResult.extracted_entities,
        redFlags: currentState.red_flags || [],
        isComplete: clinicalAiResult.is_complete,
        state: currentState,
    };
}

/**
 * 3. Finalize Session Core Logic
 */
async function finalizeSessionCore({ sessionId, patientId = null, documentData = null }) {
    const sessionRes = await pool.query(
        `SELECT * FROM clinical_sessions WHERE id = $1;`,
        [sessionId]
    );
    if (sessionRes.rows.length === 0) {
        throw new ClinicalSessionError(404, "Session not found");
    }

    const session = sessionRes.rows[0];

    // Session Ownership Verification
    if (patientId && session.patient_id !== patientId) {
        throw new ClinicalSessionError(403, "Unauthorized: Session belongs to another patient.");
    }

    // 1. Generate Summary via Clinical AI
    let summaryText = "";
    try {
        const summaryRes = await mlService.summarizeClinicalSession(sessionId, documentData);
        summaryText = summaryRes.summary || "";
    } catch (sumErr) {
        console.warn("[ML FALLBACK] Summarization fallback:", sumErr.message);
        summaryText = `# Clinical Intake Summary\n\n**Chief Complaint**: ${session.chief_complaint}\n**Language**: ${session.language}\n**Status**: Intake completed.`;
    }

    // 2. Mark session completed and save summary in PostgreSQL
    const updated = await pool.query(
        `UPDATE clinical_sessions
         SET status = 'completed', summary = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *;`,
        [summaryText, sessionId]
    );

    return {
        sessionId,
        summary: summaryText,
        session: updated.rows[0],
    };
}

/**
 * 4. Get Session By ID Core Logic
 */
async function getSessionByIdCore({ sessionId, patientId = null, userRole = null }) {
    const query = `
        SELECT cs.*,
               a.scheduled_at, a.reason AS appointment_reason,
               u.first_name AS doctor_first_name, u.last_name AS doctor_last_name
        FROM clinical_sessions cs
        LEFT JOIN appointments a ON cs.appointment_id = a.id
        LEFT JOIN users u ON a.doctor_id = u.id
        WHERE cs.id = $1;
    `;
    const result = await pool.query(query, [sessionId]);
    if (result.rows.length === 0) {
        throw new ClinicalSessionError(404, "Clinical session not found.");
    }

    const session = result.rows[0];
    if (userRole === "patient" && patientId && session.patient_id !== patientId) {
        throw new ClinicalSessionError(403, "Unauthorized: Session belongs to another patient.");
    }

    return session;
}

module.exports = {
    ClinicalSessionError,
    startSessionCore,
    processTextTurnCore,
    finalizeSessionCore,
    getSessionByIdCore,
};
