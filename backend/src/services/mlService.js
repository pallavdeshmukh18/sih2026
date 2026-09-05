const axios = require("axios");
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
async function synthesizeSpeech(text, languageCode = "en-IN", speaker = "shubh", pace = 1.0) {
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
async function startClinicalSession(patientId, language = "en", consultationType = "allopathic", chiefComplaint = "") {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/start`,
            {
                patient_id: patientId,
                language,
                consultation_type: consultationType,
                chief_complaint: chiefComplaint,
            },
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
async function respondClinicalSession(sessionId, patientText) {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/respond`,
            {
                session_id: sessionId,
                patient_text: patientText,
            },
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
async function summarizeClinicalSession(sessionId, documentData = null) {
    try {
        const response = await axios.post(
            `${ML_BASE_URL}/clinical/session/summary`,
            {
                session_id: sessionId,
                document_data: documentData,
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

module.exports = {
    transcribeAudio,
    synthesizeSpeech,
    startClinicalSession,
    respondClinicalSession,
    summarizeClinicalSession,
    processDocumentOCR,
    searchDocuments,
};
