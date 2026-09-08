const pool = require("../config/db");
const mlService = require("../services/mlService");
const {
    startSessionCore,
    processTextTurnCore,
    finalizeSessionCore,
} = require("../services/clinicalSessionService");

/**
 * 1. Start Clinical Intake Session
 * POST /api/sessions/start
 */
async function startSession(req, res, next) {
    try {
        const { appointmentId, chiefComplaint, language = "en", consultationType = "allopathic" } = req.body;
        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;

        const result = await startSessionCore({
            patientId,
            appointmentId,
            language,
            consultationType,
            chiefComplaint,
        });

        if (result.isExisting) {
            return res.status(200).json({
                success: true,
                message: "Active session already exists.",
                sessionId: result.sessionId,
                state: result.state,
                nextQuestion: result.nextQuestion,
            });
        }

        return res.status(201).json({
            success: true,
            sessionId: result.sessionId,
            nextQuestion: result.nextQuestion,
            state: result.state,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
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
            clinicalAiResult = await mlService.respondClinicalSession(sessionId, patientText, session.current_state);
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
        const currentState = clinicalAiResult.state || session.current_state || {};
        if (!currentState.conversation_history) currentState.conversation_history = [];
        const lastPatient = currentState.conversation_history.slice(-2).find(m => m.role === "patient" && m.content === patientText);
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
        const patientId = req.user.role === "patient" ? req.user.id : null;

        const result = await processTextTurnCore({
            sessionId,
            patientId,
            patientText,
        });

        return res.status(200).json({
            success: true,
            nextQuestion: result.nextQuestion,
            extractedEntities: result.extractedEntities,
            redFlags: result.redFlags,
            isComplete: result.isComplete,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
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
        const patientId = req.user.role === "patient" ? req.user.id : null;

        const result = await finalizeSessionCore({
            sessionId,
            patientId,
            documentData,
        });

        return res.status(200).json({
            success: true,
            message: "Clinical intake session finalized and summarized.",
            session: result.session,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
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
