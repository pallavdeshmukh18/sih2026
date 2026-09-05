const pool = require("../config/db");
const mlService = require("../services/mlService");

/**
 * 1. Start Clinical Intake Session
 * POST /api/sessions/start
 */
async function startSession(req, res, next) {
    try {
        const { appointmentId, chiefComplaint, language = "en", consultationType = "allopathic" } = req.body;
        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;

        if (!appointmentId || !chiefComplaint) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: appointmentId and chiefComplaint are required.",
            });
        }

        // Verify appointment exists
        const apptRes = await pool.query(
            `SELECT id, patient_id, doctor_id, status FROM appointments WHERE id = $1;`,
            [appointmentId]
        );
        if (apptRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found.",
            });
        }

        const appointment = apptRes.rows[0];
        if (req.user.role === "patient" && appointment.patient_id !== patientId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Appointment belongs to another patient.",
            });
        }

        // Check if an active session already exists for this appointment
        const existingSession = await pool.query(
            `SELECT * FROM clinical_sessions WHERE appointment_id = $1 AND status = 'active';`,
            [appointmentId]
        );
        if (existingSession.rows.length > 0) {
            const currentSession = existingSession.rows[0];
            return res.status(200).json({
                success: true,
                message: "Active session already exists for this appointment.",
                sessionId: currentSession.id,
                state: currentSession.current_state,
                nextQuestion: currentSession.current_state?.conversation_history?.slice(-1)[0]?.content || "How can I help you today?",
            });
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
            // Fallback initial state if ML server is cold
            mlSessionResponse = {
                session_id: require("crypto").randomUUID(),
                next_question: `Welcome to MediKiosk. How long have you been experiencing ${chiefComplaint}?`,
                state: {
                    session_id: require("crypto").randomUUID(),
                    patient_id: patientId,
                    language,
                    consultation_type: consultationType,
                    chief_complaint: chiefComplaint,
                    answered_fields: {},
                    missing_fields: ["onset", "duration", "severity", "associated_symptoms"],
                    clinical_entities: [],
                    red_flags: [],
                    conversation_history: [
                        { role: "system", content: `Welcome to MediKiosk. How long have you been experiencing ${chiefComplaint}?` }
                    ],
                    status: "active"
                }
            };
        }

        const sessionId = mlSessionResponse.session_id || require("crypto").randomUUID();
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
            appointmentId,
            language,
            consultationType,
            chiefComplaint,
            JSON.stringify(initialState),
        ]);

        return res.status(201).json({
            success: true,
            sessionId: result.rows[0].id,
            nextQuestion: mlSessionResponse.next_question,
            state: result.rows[0].current_state,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 2. Process Voice Intake Turn
 * POST /api/sessions/:id/voice-turn
 */
async function processVoiceTurn(req, res, next) {
    try {
        const sessionId = req.params.id;

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: "Audio file is required.",
            });
        }

        // Fetch session record
        const sessionRes = await pool.query(
            `SELECT * FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clinical session not found.",
            });
        }

        const session = sessionRes.rows[0];
        if (session.status !== "active") {
            return res.status(400).json({
                success: false,
                message: `Session is already ${session.status}.`,
            });
        }

        // 1. Transcribe audio via Sarvam Saaras STT
        const sttResult = await mlService.transcribeAudio(
            req.file.buffer,
            req.file.originalname,
            session.language
        );

        const patientText = sttResult.transcript || "";
        if (!patientText.trim()) {
            return res.status(400).json({
                success: false,
                message: "Could not transcribe any speech from audio.",
            });
        }

        // 2. Process Clinical AI turn with transcribed text
        let clinicalAiResult;
        try {
            clinicalAiResult = await mlService.respondClinicalSession(sessionId, patientText);
        } catch (aiErr) {
            console.warn("[ML FALLBACK] Clinical AI fallback for voice turn:", aiErr.message);
            clinicalAiResult = {
                next_question: "Could you tell me if you have any other associated symptoms?",
                extracted_entities: [{ field: "response", value: patientText, confidence: "Medium" }],
                red_flags: [],
                is_complete: false,
            };
        }

        // 3. Synthesize speech for next question via Sarvam Bulbul TTS
        let audioBase64 = null;
        if (clinicalAiResult.next_question) {
            try {
                const ttsResult = await mlService.synthesizeSpeech(
                    clinicalAiResult.next_question,
                    session.language || "en-IN"
                );
                audioBase64 = ttsResult.audio_base64;
            } catch (ttsErr) {
                console.warn("[TTS WARNING] Speech synthesis skipped or failed:", ttsErr.message);
            }
        }

        // 4. Update session state in PostgreSQL
        const currentState = session.current_state || {};
        if (!currentState.conversation_history) currentState.conversation_history = [];
        currentState.conversation_history.push({ role: "patient", content: patientText });
        if (clinicalAiResult.next_question) {
            currentState.conversation_history.push({ role: "system", content: clinicalAiResult.next_question });
        }
        if (clinicalAiResult.extracted_entities) {
            currentState.clinical_entities = (currentState.clinical_entities || []).concat(clinicalAiResult.extracted_entities);
        }
        if (clinicalAiResult.red_flags) {
            currentState.red_flags = Array.from(new Set([...(currentState.red_flags || []), ...clinicalAiResult.red_flags]));
        }

        const newStatus = clinicalAiResult.is_complete ? "completed" : "active";

        await pool.query(
            `UPDATE clinical_sessions
             SET current_state = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3;`,
            [JSON.stringify(currentState), newStatus, sessionId]
        );

        return res.status(200).json({
            success: true,
            transcript: patientText,
            nextQuestion: clinicalAiResult.next_question,
            audioBase64,
            extractedEntities: clinicalAiResult.extracted_entities,
            redFlags: currentState.red_flags || [],
            isComplete: clinicalAiResult.is_complete,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 3. Process Text/Touch Intake Turn
 * POST /api/sessions/:id/text-turn
 */
async function processTextTurn(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { patientText } = req.body;

        if (!patientText || !patientText.trim()) {
            return res.status(400).json({
                success: false,
                message: "patientText is required.",
            });
        }

        const sessionRes = await pool.query(
            `SELECT * FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clinical session not found.",
            });
        }

        const session = sessionRes.rows[0];
        if (session.status !== "active") {
            return res.status(400).json({
                success: false,
                message: `Session is already ${session.status}.`,
            });
        }

        // 1. Send to Clinical AI
        let clinicalAiResult;
        try {
            clinicalAiResult = await mlService.respondClinicalSession(sessionId, patientText);
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
        const currentState = session.current_state || {};
        if (!currentState.conversation_history) currentState.conversation_history = [];
        currentState.conversation_history.push({ role: "patient", content: patientText });
        if (clinicalAiResult.next_question) {
            currentState.conversation_history.push({ role: "system", content: clinicalAiResult.next_question });
        }
        if (clinicalAiResult.extracted_entities) {
            currentState.clinical_entities = (currentState.clinical_entities || []).concat(clinicalAiResult.extracted_entities);
        }
        if (clinicalAiResult.red_flags) {
            currentState.red_flags = Array.from(new Set([...(currentState.red_flags || []), ...clinicalAiResult.red_flags]));
        }

        const newStatus = clinicalAiResult.is_complete ? "completed" : "active";

        await pool.query(
            `UPDATE clinical_sessions
             SET current_state = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3;`,
            [JSON.stringify(currentState), newStatus, sessionId]
        );

        return res.status(200).json({
            success: true,
            nextQuestion: clinicalAiResult.next_question,
            extractedEntities: clinicalAiResult.extracted_entities,
            redFlags: currentState.red_flags || [],
            isComplete: clinicalAiResult.is_complete,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 4. Get Active Session Details
 * GET /api/sessions/:id
 */
async function getSessionById(req, res, next) {
    try {
        const sessionId = req.params.id;

        const result = await pool.query(
            `SELECT cs.*, a.doctor_id, a.scheduled_at,
                    u.first_name AS patient_first_name, u.last_name AS patient_last_name
             FROM clinical_sessions cs
             JOIN appointments a ON cs.appointment_id = a.id
             JOIN users u ON cs.patient_id = u.id
             WHERE cs.id = $1;`,
            [sessionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        return res.status(200).json({
            success: true,
            session: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. Complete / Finalize Session and Generate Summary
 * POST /api/sessions/:id/finalize
 */
async function finalizeSession(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { documentData } = req.body;

        const sessionRes = await pool.query(
            `SELECT * FROM clinical_sessions WHERE id = $1;`,
            [sessionId]
        );
        if (sessionRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        const session = sessionRes.rows[0];

        // 1. Generate Summary via Clinical AI
        let summaryText = "";
        try {
            const summaryRes = await mlService.summarizeClinicalSession(sessionId, documentData);
            summaryText = summaryRes.summary || "";
        } catch (sumErr) {
            console.warn("[ML FALLBACK] Summarization fallback:", sumErr.message);
            summaryText = `# Clinical Intake Summary\n\n**Chief Complaint**: ${session.chief_complaint}\n**Language**: ${session.language}\n**Status**: Intake completed.`;
        }

        // 2. Mark session completed and save summary
        const updated = await pool.query(
            `UPDATE clinical_sessions
             SET status = 'completed', summary = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *;`,
            [summaryText, sessionId]
        );

        return res.status(200).json({
            success: true,
            message: "Clinical intake session finalized and summarized.",
            session: updated.rows[0],
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    startSession,
    processVoiceTurn,
    processTextTurn,
    getSessionById,
    finalizeSession,
};
