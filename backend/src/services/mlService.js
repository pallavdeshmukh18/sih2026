const axios = require("axios").create();
axios.interceptors.request.use(config => {
    if (process.env.ML_SERVICE_KEY) config.headers['X-ML-Service-Key'] = process.env.ML_SERVICE_KEY;
    return config;
});
const FormData = require("form-data");

const ML_BASE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * 1. Transcribe Patient Audio via Sarvam Saaras STT
 */
async function transcribeAudio(fileBuffer, filename = "audio.wav", languageCode = null) {
    const formData = new FormData();
    formData.append("file", fileBuffer, { filename });
    if (languageCode) {
        formData.append("language_code", languageCode);
    }

    try {
        const response = await axios.post(`${ML_BASE_URL}/api/stt/transcribe`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 30000,
        });
        return response.data;
    } catch (error) {
        console.error("Error calling ML STT service:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || "STT transcription service failed");
    }
}

/**
 * 2. Synthesize Next Question via Sarvam Bulbul TTS
 */
async function synthesizeSpeech(text, languageCode = "en-IN", speaker = "simran", pace = 1.0) {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/api/tts/synthesize`,
            {
                text,
                language_code: languageCode,
                speaker,
                pace,
            },
            {
                timeout: 30000,
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error calling ML TTS service:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || "TTS speech synthesis service failed");
    }
}

/**
 * 3. Start Adaptive Clinical Session
 */
async function startClinicalSession(payloadState) {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/start`,
            payloadState,
            {
                timeout: 30000,
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error starting clinical session:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Failed to start clinical AI intake session");
    }
}

/**
 * 4. Process Patient Response in Adaptive Session
 */
async function respondClinicalSession(sessionId, patientText, state = null) {
    try {
        const payload = {
            session_id: sessionId,
            patient_text: patientText,
        };
        if (state) payload.state = state;

        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/respond`,
            payload,
            {
                timeout: 30000,
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error responding to clinical session:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Failed to process clinical AI response");
    }
}

/**
 * 5. Generate Physician Summary
 */
async function summarizeClinicalSession(sessionId, documentData = null, state = null) {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/summary`,
            {
                session_id: sessionId,
                document_data: documentData,
                state: state
            },
            {
                timeout: 45000,
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error summarizing clinical session:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Failed to generate clinical summary");
    }
}

/**
 * 6. Process Medical Document OCR & Entity Extraction
 */
async function processDocumentOCR(patientId, documentId, fileBuffer, filename = "document.png") {
    const formData = new FormData();
    formData.append("patient_id", patientId);
    formData.append("document_id", documentId);
    formData.append("file", fileBuffer, { filename });

    try {
        const response = await axios.post(`${ML_BASE_URL}/documents/process`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 60000,
        });
        return response.data;
    } catch (error) {
        console.error("Error calling ML OCR service:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Document OCR processing failed");
    }
}

/**
 * 7. Semantic Vector Search
 */
async function searchDocuments(patientId, query, topK = 5) {
    const formData = new FormData();
    formData.append("patient_id", patientId);
    formData.append("query", query);
    formData.append("top_k", String(topK));

    try {
        const response = await axios.post(`${ML_BASE_URL}/documents/search`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 30000,
        });
        return response.data;
    } catch (error) {
        console.error("Error calling ML search service:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Document semantic search failed");
    }
}

/**
 * 8. Ask Document-Specific Grounded Question
 */
async function askDocumentQuestion(patientId, documentId, filename, question, ocrText, extractedEntities, aiSummary, language = "en", history = []) {
    try {
        const payload = {
            patient_id: patientId,
            document_id: documentId,
            filename: filename || "document.pdf",
            question: question,
            ocr_text: ocrText || "",
            extracted_entities: extractedEntities || null,
            ai_summary: aiSummary || null,
            language: language || "en",
            history: history || []
        };

        const response = await axios.post(`${ML_BASE_URL}/documents/ask`, payload, {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: 45000,
        });
        return response.data;
    } catch (error) {
        console.error("Error calling ML document QA service:", error.response?.data || error.message);
        throw new Error(error.response?.data?.detail || "Document Q&A AI processing failed");
    }
}

async function deleteDocumentVectors(patientId, documentId) {
    const form = new FormData();
    form.append("patient_id", patientId);
    form.append("document_id", documentId);
    await axios.post(`${ML_BASE_URL}/documents/delete`, form, { headers: form.getHeaders(), timeout: 10000 });
}

module.exports = {
    deleteDocumentVectors,
    transcribeAudio,
    synthesizeSpeech,
    startClinicalSession,
    respondClinicalSession,
    summarizeClinicalSession,
    processDocumentOCR,
    searchDocuments,
    askDocumentQuestion,
};
