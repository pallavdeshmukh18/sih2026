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

    // Call FastAPI ML service to initialize clinical ontology state    // ── Fetch Patient Demographics & Medical History ──
    let patientProfile = null;
    if (patientId) {
        try {
            // Demographics
            const userRes = await pool.query(
                `SELECT u.first_name, u.last_name, p.date_of_birth, p.gender, p.preferred_language
                 FROM users u
                 LEFT JOIN patient_profiles p ON u.id = p.user_id
                 WHERE u.id = $1;`,
                [patientId]
            );

            // Medical History
            const medRes = await pool.query(
                `SELECT category, condition, status, description 
                 FROM medical_history
                 WHERE patient_id = $1
                 ORDER BY COALESCE(diagnosed_at, created_at::date) DESC;`,
                [patientId]
            );

            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                let age = null;
                if (u.date_of_birth) {
                    const diffMs = Date.now() - new Date(u.date_of_birth).getTime();
                    age = Math.abs(new Date(diffMs).getUTCFullYear() - 1970);
                }

                patientProfile = {
                    name: `${u.first_name} ${u.last_name || ""}`.trim(),
                    age: age,
                    gender: u.gender,
                    preferred_language: u.preferred_language,
                    medical_history: medRes.rows.map(r => ({
                        condition: r.condition,
                        category: r.category,
                        status: r.status,
                        description: r.description
                    }))
                };
            }
        } catch (err) {
            console.error("Error fetching patient profile for ML context:", err);
        }
    }

    // Call ML Engine to start the session or fallback
    let mlSessionResponse;
    try {
        const payloadState = {
            patient_id: patientId,
            language,
            consultation_type: consultationType,
            chief_complaint: chiefComplaint,
            patient_profile: patientProfile,
        };
        mlSessionResponse = await mlService.startClinicalSession(payloadState);
    } catch (error) {
        console.warn("[ML FALLBACK] ML service failed or timed out during session start:", error.message);
        
        const fallbackQuestions = {
            en: `Welcome to MediKiosk. How long have you been experiencing ${chiefComplaint}?`,
            hi: `मेडीकियोस्क में आपका स्वागत है। आपको ${chiefComplaint} की समस्या कब से है?`,
            mr: `मेडीकिओस्क मध्ये आपले स्वागत आहे. तुम्हाला ${chiefComplaint} चा त्रास कधीपासून होत आहे?`,
            gu: `મેડિકિઓસ્કમાં તમારું સ્વાગત છે. તમને ${chiefComplaint} ની સમસ્યા ક્યારથી છે?`,
            bn: `মেডিকিয়স্কে আপনাকে স্বাগত। আপনার ${chiefComplaint} সমস্যাটি কতদিন ধরে হচ্ছে?`,
            ta: `மெடிகியோஸ்க்கிற்கு வரவேற்கிறோம். உங்களுக்கு ${chiefComplaint} பிரச்சினை எவ்வளவு காலமாக உள்ளது?`,
            te: `మెడికియోస్క్‌కు స్వాగతం. మీకు ${chiefComplaint} సమస్య ఎంత కాలంగా ఉంది?`,
            kn: `ಮೆಡಿಕಿಯೋಸ್ಕ್‌ಗೆ ಸುಸ್ವಾಗತ. ನಿಮಗೆ ${chiefComplaint} ಸಮಸ್ಯೆ ಎಷ್ಟು ಸಮಯದಿಂದ ಇದೆ?`,
            ml: `മെഡിക്കിയോസ്കിലേക്ക് സ്വാഗതം. നിങ്ങൾക്ക് ${chiefComplaint} പ്രശ്നം എത്ര നാളായി ഉണ്ട്?`,
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
                patient_profile: patientProfile,
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
 * Helper: Adaptive Clinical Intake Question & Entity Progression (ML Fallback Engine)
 */
function getAdaptiveClinicalTurn({ currentState = {}, chiefComplaint = "your condition", patientText = "", language = "en", consultationType = "allopathic" }) {
    const history = currentState.conversation_history || [];
    const patientTurns = history.filter(m => m.role === "patient");
    const turnCount = patientTurns.length; // Number of patient responses prior to this turn

    const lang = (language || "en").toLowerCase();
    const lowerText = (patientText || "").toLowerCase().trim();

    // Check if patient indicated completion / nothing more
    const completionPhrases = [
        "nothing else", "no other", "none", "no", "nothing", "ready", "done", "that's all", "that is all",
        "ready for summary", "summary", "બસ આટલું", "काही नाही", "कुछ नहीं", "बस इतना ही", "नहीं", "नाही", "ના"
    ];
    const isExplicitDone = completionPhrases.some(p => lowerText === p || lowerText.startsWith(p));

    // Entity extraction heuristics
    const entities = [...(currentState.clinical_entities || [])];
    const redFlags = [...(currentState.red_flags || [])];

    // Check red flags
    const redFlagKeywords = [
        { term: "chest pain", flag: "Chest pain / potential cardiac distress" },
        { term: "breathing difficulty", flag: "Shortness of breath / respiratory distress" },
        { term: "shortness of breath", flag: "Shortness of breath / respiratory distress" },
        { term: "unconscious", flag: "Loss of consciousness / syncope" },
        { term: "severe bleeding", flag: "Severe active bleeding" },
        { term: "high fever", flag: "High grade persistent fever" },
        { term: "seizure", flag: "Neurological event / seizure" },
        { term: "सीने में दर्द", flag: "Chest pain / potential cardiac distress" },
        { term: "सांस", flag: "Shortness of breath / respiratory distress" },
        { term: "छातीत दुखणे", flag: "Chest pain / potential cardiac distress" },
    ];
    redFlagKeywords.forEach(({ term, flag }) => {
        if (lowerText.includes(term) && !redFlags.includes(flag)) {
            redFlags.push(flag);
        }
    });

    if (isExplicitDone || turnCount >= 4) {
        entities.push({ field: "intake_status", value: "Patient completed clinical intake questionnaire", confidence: "High" });
        return {
            next_question: "",
            options: [],
            extracted_entities: entities,
            red_flags: redFlags,
            is_complete: true,
        };
    }

    if (turnCount === 0) {
        // Turn 1: Severity question
        entities.push({ field: "duration_onset", value: patientText, confidence: "High" });
        const questions = {
            hi: "आपकी तकलीफ कितनी गंभीर है (हल्की, मध्यम, या तेज), और क्या इससे आपकी दिनचर्या प्रभावित हो रही है?",
            mr: "तुमचा त्रास किती तीव्र आहे (कमी, मध्यम, किंवा जास्त), आणि यामुळे तुमच्या दैनंदिन कामांवर परिणाम होत आहे का?",
            gu: "તમારી તકલીફ કેટલી ગંભીર છે (હળવી, મધ્યમ, કે તીવ્ર), અને શું તેનાથી તમારી દિનચર્યા પર અસર પડી રહી છે?",
            en: "How severe is your discomfort (mild, moderate, or severe), and how does it affect your daily activities?"
        };
        const optionsMap = {
            hi: [
                { id: "sev_mild", label: "हल्की - सामान्य काम कर पा रहे हैं" },
                { id: "sev_mod", label: "मध्यम - परेशानी हो रही है" },
                { id: "sev_severe", label: "गंभीर - काम करने में बहुत कठिनाई" }
            ],
            mr: [
                { id: "sev_mild", label: "कमी / सौम्य त्रास" },
                { id: "sev_mod", label: "मध्यम त्रास होतोय" },
                { id: "sev_severe", label: "जास्त / दैनंदिन कामात अडचण" }
            ],
            gu: [
                { id: "sev_mild", label: "હળવી તકલીફ" },
                { id: "sev_mod", label: "મધ્યમ તકલીફ" },
                { id: "sev_severe", label: "તીવ્ર / કામ કરવામાં મુશ્કેલી" }
            ],
            en: [
                { id: "sev_mild", label: "Mild - manageable" },
                { id: "sev_mod", label: "Moderate - noticeable discomfort" },
                { id: "sev_severe", label: "Severe - difficulty doing daily tasks" }
            ]
        };
        return {
            next_question: questions[lang] || questions.en,
            options: optionsMap[lang] || optionsMap.en,
            extracted_entities: entities,
            red_flags: redFlags,
            is_complete: false,
        };
    }

    if (turnCount === 1) {
        // Turn 2: Associated Symptoms question
        entities.push({ field: "severity_impact", value: patientText, confidence: "High" });
        const questions = {
            hi: "क्या आपको बुखार, सिरदर्द, बदन दर्द, उल्टी/जी मिचलाना, या सांस लेने में तकलीफ जैसे कोई अन्य लक्षण भी हैं?",
            mr: "तुम्हाला ताप, डोकेदुखी, अंगदुखी, मळमळ किंवा श्वास घेण्यास त्रास यासारखी इतर कोणतीही लक्षणे आहेत का?",
            gu: "શું તમને તાવ, માથાનો દુખાવો, શરીરનો દુખાવો, ઉલટી અથવા શ્વાસ લેવામાં તકલીફ જેવા અન્ય લક્ષણો છે?",
            en: "Are you experiencing any other symptoms, such as fever, headache, body ache, nausea, or breathing difficulty?"
        };
        const optionsMap = {
            hi: [
                { id: "sym_none", label: "कोई अन्य लक्षण नहीं" },
                { id: "sym_fever", label: "बुखार / कमजोरी" },
                { id: "sym_headache", label: "सिरदर्द / जी मिचलाना" },
                { id: "sym_breath", label: "सांस फूलना / सीने में भारीपन" }
            ],
            mr: [
                { id: "sym_none", label: "इतर कोणतीही लक्षणे नाहीत" },
                { id: "sym_fever", label: "ताप / अशक्तपणा" },
                { id: "sym_headache", label: "डोकेदुखी / मळमळ" },
                { id: "sym_breath", label: "श्वास घेण्यास त्रास / छातीत जडपणा" }
            ],
            gu: [
                { id: "sym_none", label: "કોઈ અન્ય લક્ષણો નથી" },
                { id: "sym_fever", label: "તાવ / નબળાઈ" },
                { id: "sym_headache", label: "માથાનો દુખાવો / ઉલટી જેવું" },
                { id: "sym_breath", label: "શ્વાસ લેવામાં તકલીફ / છાતીમાં દબાણ" }
            ],
            en: [
                { id: "sym_none", label: "No other symptoms" },
                { id: "sym_fever", label: "Fever / Body weakness" },
                { id: "sym_headache", label: "Headache / Nausea" },
                { id: "sym_breath", label: "Shortness of breath / Chest discomfort" }
            ]
        };
        return {
            next_question: questions[lang] || questions.en,
            options: optionsMap[lang] || optionsMap.en,
            extracted_entities: entities,
            red_flags: redFlags,
            is_complete: false,
        };
    }

    if (turnCount === 2) {
        // Turn 3: Existing Medical Conditions / Medications
        entities.push({ field: "associated_symptoms", value: patientText, confidence: "High" });
        const questions = {
            hi: "क्या आपको पहले से कोई बीमारी है (जैसे शुगर/डायबिटीज, बीपी, अस्थमा) या आप कोई नियमित दवाइयां ले रहे हैं?",
            mr: "तुम्हाला आधीपासून काही आजार आहे का (उदा. मधुमेह, बीपी, दमा) किंवा तुम्ही कोणतीही नियमित औषधे घेत आहात का?",
            gu: "શું તમને પહેલાથી કોઈ બીમારી છે (જેમ કે ડાયાબિટીસ, બીપી, અસ્થમા) અથવા તમે કોઈ નિયમિત દવાઓ લઈ રહ્યા છો?",
            en: "Do you have any existing medical conditions (such as diabetes, blood pressure, asthma) or are you currently taking any regular medicines?"
        };
        const optionsMap = {
            hi: [
                { id: "med_none", label: "कोई पुरानी बीमारी या दवा नहीं" },
                { id: "med_bp_sugar", label: "शुगर / बीपी की समस्या है" },
                { id: "med_current", label: "नियमित दवाइयां ले रहे हैं" }
            ],
            mr: [
                { id: "med_none", label: "कोणताही जुना आजार किंवा औषधे नाहीत" },
                { id: "med_bp_sugar", label: "मधुमेह / बीपी चा त्रास आहे" },
                { id: "med_current", label: "नियमित औषधे सुरू आहेत" }
            ],
            gu: [
                { id: "med_none", label: "કોઈ જૂની બીમારી કે દવા નથી" },
                { id: "med_bp_sugar", label: "ડાયાબિટીસ / બીપી છે" },
                { id: "med_current", label: "નિયમિત દવાઓ ચાલુ છે" }
            ],
            en: [
                { id: "med_none", label: "No past conditions or medicines" },
                { id: "med_bp_sugar", label: "Have Diabetes / High Blood Pressure" },
                { id: "med_current", label: "Currently taking prescription medicines" }
            ]
        };
        return {
            next_question: questions[lang] || questions.en,
            options: optionsMap[lang] || optionsMap.en,
            extracted_entities: entities,
            red_flags: redFlags,
            is_complete: false,
        };
    }

    // Turn 3 -> Turn 4: Final detail confirmation
    entities.push({ field: "past_history_medications", value: patientText, confidence: "High" });
    const questions = {
        hi: "क्या कोई अन्य विशेष बात या लक्षण है जो आप डॉक्टर को बताना चाहते हैं?",
        mr: "डॉक्टरांना सांगण्यासारखा इतर काही विशेष तपशील किंवा लक्षणे आहेत का?",
        gu: "ડોક્ટરને જણાવવા માટે અન્ય કોઈ ખાસ વિગત કે લક્ષણ છે?",
        en: "Are there any other specific details or symptoms you would like to mention for the doctor?"
    };
    const optionsMap = {
        hi: [
            { id: "fin_none", label: "बस इतना ही, सारांश देखें" },
            { id: "fin_urgent", label: "मुझे जल्द से जल्द डॉक्टर से मिलना है" }
        ],
        mr: [
            { id: "fin_none", label: "काही नाही, सारांश दाखवा" },
            { id: "fin_urgent", label: "मला लवकरात लवकर तपासणी हवी आहे" }
        ],
        gu: [
            { id: "fin_none", label: "બસ આટલું જ, સારાંશ જુઓ" },
            { id: "fin_urgent", label: "મને તાત્કાલિક સલાહ જોઈએ છે" }
        ],
        en: [
            { id: "fin_none", label: "Nothing else, ready for summary" },
            { id: "fin_urgent", label: "I need consultation as soon as possible" }
        ]
    };
    return {
        next_question: questions[lang] || questions.en,
        options: optionsMap[lang] || optionsMap.en,
        extracted_entities: entities,
        red_flags: redFlags,
        is_complete: false,
    };
}

/**
 * Helper: Generate Rich Structured Clinical Intake Markdown Summary
 */
function generateStructuredIntakeSummary(session, currentState) {
    const chiefComplaint = session?.chief_complaint || "General Health Concern";
    const lang = session?.language || "en";
    const type = session?.consultation_type === "ayush" ? "AYUSH (Ayurveda/Yoga/Unani/Siddha/Homeopathy)" : "Allopathic (Modern Clinical)";
    const entities = currentState?.clinical_entities || [];
    const redFlags = currentState?.red_flags || [];
    const history = currentState?.conversation_history || [];

    const lines = [];
    lines.push(`# Clinical Intake & AI Triage Summary`);
    lines.push(`- **Chief Complaint**: ${chiefComplaint}`);
    lines.push(`- **Consultation Pathway**: ${type}`);
    lines.push(`- **Intake Language**: ${lang.toUpperCase()}`);
    lines.push(`- **Triage Urgency**: ${redFlags.length > 0 ? "🔴 HIGH PRIORITY / URGENT ATTENTION" : "🟢 Standard Outpatient"}`);

    if (redFlags.length > 0) {
        lines.push(`\n### ⚠️ Critical Alerts / Red Flags`);
        redFlags.forEach(rf => lines.push(`- 🚨 **${rf}**`));
    }

    if (entities.length > 0) {
        lines.push(`\n### 📋 Extracted Clinical Entities`);
        entities.forEach(e => lines.push(`- **${(e.field || "Observation").replace(/_/g, " ")}**: ${e.value}`));
    }

    if (history.length > 0) {
        lines.push(`\n### 💬 Intake Q&A Progression`);
        let currentQ = "";
        history.forEach(item => {
            if (item.role === "system") {
                currentQ = item.content;
            } else if (item.role === "patient" || item.role === "user") {
                if (currentQ) {
                    lines.push(`- **Q**: *${currentQ}*\n  **A**: ${item.content}`);
                    currentQ = "";
                } else {
                    lines.push(`- **Patient Response**: ${item.content}`);
                }
            }
        });
    }

    lines.push(`\n### 🩺 Clinical Recommendations`);
    if (session?.consultation_type === "ayush") {
        lines.push(`- Review patient's Prakriti / Dosha balance and Dashavidha Pariksha findings.`);
        lines.push(`- Recommend personalized herbal formulations and dietary (Ahara-Vihara) modifications.`);
    } else {
        lines.push(`- Perform focused physical examination based on ${chiefComplaint}.`);
        lines.push(`- Evaluate symptom progression and order diagnostic investigations if indicated.`);
    }

    return lines.join("\n");
}

/**
 * 2. Process Text Intake Turn Core Logic
 */
async function processTextTurnCore({ sessionId, patientId = null, patientText }) {
    if (!patientText || !patientText.trim()) {
        throw new ClinicalSessionError(400, "patientText is required.");
    }
    if (patientText.length > 5000) {
        throw new ClinicalSessionError(400, "patientText exceeds maximum allowed length of 5000 characters.");
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
        clinicalAiResult = getAdaptiveClinicalTurn({
            currentState: session.current_state,
            chiefComplaint: session.chief_complaint,
            patientText,
            language: session.language,
            consultationType: session.consultation_type,
        });
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

    let finalSummary = "";
    if (newStatus === "completed") {
        try {
            const summaryRes = await mlService.summarizeClinicalSession(sessionId, null, currentState);
            finalSummary = summaryRes.summary || "";
        } catch (sumErr) {
            console.error("[ML FALLBACK] Auto-summarization fallback:", sumErr.message);
            finalSummary = generateStructuredIntakeSummary(session, currentState);
        }
    }

    await pool.query(
        `UPDATE clinical_sessions
         SET current_state = $1, status = $2, summary = COALESCE(NULLIF($3, ''), summary), updated_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        [JSON.stringify(currentState), newStatus, finalSummary, sessionId]
    );

    return {
        sessionId,
        nextQuestion: clinicalAiResult.next_question,
        options: clinicalAiResult.options || [],
        extractedEntities: clinicalAiResult.extracted_entities,
        redFlags: currentState.red_flags || [],
        isComplete: clinicalAiResult.is_complete,
        state: currentState,
        summary: finalSummary,
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
        const summaryRes = await mlService.summarizeClinicalSession(sessionId, documentData, session.current_state);
        summaryText = summaryRes.summary || "";
    } catch (sumErr) {
        console.warn("[ML FALLBACK] Summarization fallback:", sumErr.message);
        summaryText = generateStructuredIntakeSummary(session, session.current_state);
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

/**
 * 5. Deterministic Medical Specialization Mapping
 */
function determineRequiredSpecialization(chiefComplaint = "", currentState = {}, summary = "") {
    const textCorpus = [
        chiefComplaint || "",
        summary || "",
        ...(currentState?.clinical_entities || []).map(e => `${e.field || ""} ${e.value || ""}`),
        ...(currentState?.red_flags || []),
        ...(currentState?.conversation_history || []).map(m => m.content || ""),
    ].join(" ").toLowerCase();

    // 1. Cardiology keywords
    const cardiacTerms = ["chest pain", "angina", "cardiac", "heart", "palpitation", "myocardial", "arrhythmia"];
    if (cardiacTerms.some(term => textCorpus.includes(term))) {
        return "Cardiology";
    }

    // 2. Dermatology keywords
    const dermaTerms = ["skin", "rash", "itching", "acne", "eczema", "dermatitis", "lesion", "psoriasis", "hives", "urticaria", "fungal", "boil"];
    if (dermaTerms.some(term => textCorpus.includes(term))) {
        return "Dermatology";
    }

    // 3. AYUSH if consultation_type is ayush
    if (currentState?.consultation_type === "ayush") {
        return "AYUSH";
    }

    // 4. Default primary care / internal medicine
    return "General Medicine";
}

module.exports = {
    ClinicalSessionError,
    startSessionCore,
    processTextTurnCore,
    finalizeSessionCore,
    getSessionByIdCore,
    determineRequiredSpecialization,
    getAdaptiveClinicalTurn,
    generateStructuredIntakeSummary,
};


