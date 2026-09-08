const pool = require("../config/db");
const mlService = require("../services/mlService");

/**
 * 1. Start Clinical Intake Session
 * POST /api/sessions/start
 */
async function startSession(req, res, next) {
    try {
        const { appointmentId, chiefComplaint, consultationType = "allopathic" } = req.body;
        const language = req.body.language || req.user?.onboarding?.preferredLanguage || req.user?.preferred_language || "en";
        const patientId = req.user.role === "patient" ? req.user.id : req.body.patientId;

        if (!chiefComplaint || !chiefComplaint.trim()) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: chiefComplaint is required.",
            });
        }

        const isUuid = (val) => typeof val === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

        let validAppointmentId = null;
        if (appointmentId) {
            if (!isUuid(appointmentId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid appointmentId format. Expected a valid UUID.",
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
            validAppointmentId = appointmentId;
        }

        // Check if an active session already exists
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
            if (currentSession.language !== language || (chiefComplaint && currentSession.chief_complaint !== chiefComplaint)) {
                await pool.query(
                    `UPDATE clinical_sessions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                    [currentSession.id]
                );
            } else {
                const currentState = currentSession.current_state || {};
                return res.status(200).json({
                    success: true,
                    message: "Active session already exists.",
                    sessionId: currentSession.id,
                    state: currentState,
                    nextQuestion: currentState.current_question || currentState.conversation_history?.slice(-1)[0]?.content || "How can I help you today?",
                    options: currentState.current_options || currentState.options || [],
                });
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
                mr: `मेडीकियोस्कमध्ये आपले स्वागत आहे. तुम्हाला ${chiefComplaint} चा त्रास किती दिवसांपासून होत आहे?`,
                gu: `મેડીકિયોસ્કમાં તમારું સ્વાગત છે. તમને ${chiefComplaint} ની તકલીફ કેટલા સમયથી થઈ રહી છે?`,
                bn: `মেডিকিয়োস্কে আপনাকে স্বাগতম। আপনি কত দিন ধরে ${chiefComplaint} অনুভব করছেন?`,
                ta: `மெடிகியோஸ்கிற்கு நல்வரவு. எவ்வளவு காலமாக ${chiefComplaint} பிரச்சினை இருக்கிறது?`,
                te: `మెడికియోస్క్‌కి స్వాగతం. ఎంతకాలంగా ${chiefComplaint} సమస్యతో బాధపడుతున్నారు?`,
                kn: `ಮೆಡಿಕಿಯೋಸ್ಕ್‌ಗೆ സ്വാഗತನ. ಎಷ್ಟು ದಿನಗಳಿಂದ ${chiefComplaint} ಸಮಸ್ಯೆ ಇದೆ?`,
                ml: `മെഡികിയോസ്കിലേക്ക് സ്വാഗതം. എത്ര നാളായി ${chiefComplaint} പ്രശ്നം അനുഭവപ്പെടുന്നു?`,
                pa: `ਮੈਡੀਕਿਓਸਕ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਤੁਹਾਨੂੰ ${chiefComplaint} ਦੀ ਸਮੱਸਿਆ ਕਿੰਨੇ ਸਮੇਂ ਤੋਂ ਹੋ ਰਹੀ ਹੈ?`,
                or: `ମେଡିକିଓସ୍କକୁ ସ୍ୱାଗତ। କେତେ ଦିନ ହେବ ${chiefComplaint} ସମସ୍ୟା ଅଛି?`,
                as: `মেডিকিয়স্কলৈ স্বাগতম। কিমান দিনৰ পৰা ${chiefComplaint} সমস্যা হৈছে?`
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
                session_id: require("crypto").randomUUID(),
                next_question: fallbackQText,
                options: fallbackOptsList,
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
                        { role: "system", content: fallbackQText }
                    ],
                    current_question: fallbackQText,
                    current_options: fallbackOptsList,
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
            validAppointmentId,
            language,
            consultationType,
            chiefComplaint,
            JSON.stringify(initialState),
        ]);

        return res.status(201).json({
            success: true,
            sessionId: result.rows[0].id,
            nextQuestion: mlSessionResponse.next_question,
            options: mlSessionResponse.options || [],
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
            options: clinicalAiResult.options || [],
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
            clinicalAiResult = await mlService.respondClinicalSession(sessionId, patientText, session.current_state);
        } catch (aiErr) {
            console.warn("[ML FALLBACK] Clinical AI fallback for text turn:", aiErr.message);
            clinicalAiResult = {
                next_question: "Are there any other details you would like to mention?",
                options: [],
                extracted_entities: [{ field: "text_response", value: patientText, confidence: "High" }],
                red_flags: [],
                is_complete: false,
            };
        }

        // 2. Update session state
        const currentState = clinicalAiResult.state || session.current_state || {};
        if (!currentState.conversation_history) currentState.conversation_history = [];
        // Ensure patient turn and system response are in conversation history
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
            nextQuestion: clinicalAiResult.next_question,
            options: clinicalAiResult.options || [],
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
