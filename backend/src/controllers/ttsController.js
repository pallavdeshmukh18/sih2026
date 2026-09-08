const mlService = require("../services/mlService");

/**
 * Frontend Language Code -> Sarvam BCP-47 TTS Language Code Mapping
 */
const SARVAM_LANG_MAP = {
    en: "en-IN",
    hi: "hi-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    pa: "pa-IN",
    or: "od-IN",
    as: "bn-IN", // Assamese fallback to Bengali in Sarvam Bulbul v3
};

/**
 * Express Controller: Synthesize Speech via ML Service (Sarvam Bulbul v3)
 * POST /api/tts/synthesize
 */
async function synthesizeSpeech(req, res, next) {
    try {
        const { text, languageCode, speaker, pace } = req.body;

        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: "Text is required for speech synthesis.",
            });
        }

        const cleanText = text.trim();
        const mappedLang = SARVAM_LANG_MAP[languageCode] || languageCode || "en-IN";

        // Call server-side ML Service (FastAPI running on process.env.ML_SERVICE_URL)
        const ttsResult = await mlService.synthesizeSpeech(
            cleanText,
            mappedLang,
            speaker || "simran",
            pace || 1.0
        );

        return res.status(200).json(ttsResult);
    } catch (error) {
        console.error("Express TTS synthesize proxy error:", error.message);
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || "Speech synthesis service failed.",
        });
    }
}

module.exports = {
    synthesizeSpeech,
};
