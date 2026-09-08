const pool = require("../config/db");
const {
    startSessionCore,
    processTextTurnCore,
    finalizeSessionCore,
} = require("../services/clinicalSessionService");

/**
 * Helper to resolve authenticated WhatsApp identity to MediKiosk user_id.
 * Enforces that arbitrary patient_id from the client is NEVER trusted.
 */
async function resolveWhatsAppUser(whatsappId) {
    if (!whatsappId || typeof whatsappId !== "string" || !whatsappId.trim()) {
        const err = new Error("whatsapp_id is required.");
        err.statusCode = 400;
        throw err;
    }

    const normalizedId = whatsappId.trim();
    const result = await pool.query(
        `SELECT user_id FROM whatsapp_accounts WHERE whatsapp_id = $1;`,
        [normalizedId]
    );

    if (result.rows.length === 0) {
        const err = new Error("WhatsApp account is not linked to a MediKiosk user account.");
        err.statusCode = 403;
        throw err;
    }

    return result.rows[0].user_id;
}

/**
 * 1. Start Clinical Intake Session for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/start
 */
async function startSession(req, res, next) {
    try {
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const userId = await resolveWhatsAppUser(targetWhatsappId);

        const chiefComplaint = req.body.chief_complaint || req.body.chiefComplaint;
        const language = req.body.language || "en";
        const consultationType = req.body.consultation_type || req.body.consultationType || "allopathic";
        const appointmentId = req.body.appointment_id || req.body.appointmentId || null;

        const result = await startSessionCore({
            patientId: userId,
            appointmentId,
            language,
            consultationType,
            chiefComplaint,
        });

        const status = result.isExisting ? 200 : 201;
        return res.status(status).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            nextQuestion: result.nextQuestion,
            next_question: result.nextQuestion,
            state: result.state,
            isExisting: result.isExisting,
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
 * 2. Process Text Turn for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/:id/text-turn
 */
async function processTextTurn(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const userId = await resolveWhatsAppUser(targetWhatsappId);

        const patientText = req.body.patient_text || req.body.patientText;

        const result = await processTextTurnCore({
            sessionId,
            patientId: userId,
            patientText,
        });

        return res.status(200).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            nextQuestion: result.nextQuestion,
            next_question: result.nextQuestion,
            extractedEntities: result.extractedEntities,
            extracted_entities: result.extractedEntities,
            redFlags: result.redFlags,
            red_flags: result.redFlags,
            isComplete: result.isComplete,
            is_complete: result.isComplete,
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
 * 3. Finalize Clinical Session for Linked WhatsApp User
 * POST /api/whatsapp/clinical/session/:id/finalize
 */
async function finalizeSession(req, res, next) {
    try {
        const sessionId = req.params.id;
        const { whatsapp_id, whatsappId } = req.body;
        const targetWhatsappId = whatsapp_id || whatsappId;
        const userId = await resolveWhatsAppUser(targetWhatsappId);

        const documentData = req.body.document_data || req.body.documentData || null;

        const result = await finalizeSessionCore({
            sessionId,
            patientId: userId,
            documentData,
        });

        return res.status(200).json({
            success: true,
            sessionId: result.sessionId,
            session_id: result.sessionId,
            summary: result.summary,
            message: "Clinical intake session finalized and summarized.",
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
    processTextTurn,
    finalizeSession,
};
