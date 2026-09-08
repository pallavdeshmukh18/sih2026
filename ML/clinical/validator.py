import re
import json
import logging
from typing import Tuple, Optional, Dict, Any, List
from pydantic import BaseModel, Field

logger = logging.getLogger("medikiosk.clinical.validator")

# Decisions
DECISION_VALID_ANSWER = "VALID_ANSWER"
DECISION_CLARIFY = "CLARIFY"
DECISION_UNSURE = "UNSURE"
DECISION_INVALID = "INVALID"
DECISION_OUT_OF_RANGE = "OUT_OF_RANGE"
DECISION_IRRELEVANT = "IRRELEVANT"

class ValidationResult(BaseModel):
    decision: str  # VALID_ANSWER | CLARIFY | UNSURE | INVALID | OUT_OF_RANGE | IRRELEVANT
    normalized_value: Optional[str] = None
    extracted_entities: List[Dict[str, Any]] = Field(default_factory=list)
    feedback_message: Optional[str] = None
    confidence: float = 1.0
    is_deterministic: bool = False
    reason: Optional[str] = None

# Multilingual tokens
AFFIRMATIVE_TOKENS = {
    "yes", "yep", "yeah", "y", "true", "correct",
    "हाँ", "हां", "जी हाँ", "जी हां", "हा", "हॉं",
    "हो", "होय", "बरोबर",
    "હા", "હાજી",
    "হ্যাঁ", "হ্যা",
    "ஆம்", "ஆமாம்",
    "అవును", "హా",
    "ಹೌದು", "ಸರಿ",
    "അതെ", "ശരി",
    "ਹਾਂ", "ਆਹੋ",
    "ହଁ", "ହଁ ଆଜ୍ଞା",
    "হয়", "হাঁ"
}

NEGATIVE_TOKENS = {
    "no", "nope", "nah", "n", "false", "none", "nowhere", "nil", "nothing",
    "नहीं", "ना", "नही", "कोई नहीं", "कुछ नहीं",
    "नाही", "ना", "काही नाही", "कोठेही नाही",
    "ના", "નથી", "કંઈ નથી",
    "না", "কোনো না", "কিছু না",
    "இல்லை", "இல்ல", "எதுவும் இல்லை",
    "కాదు", "లేదు", "ఏమీ లేదు",
    "ಇಲ್ಲ", "ಯಾವುದೂ ಇಲ್ಲ",
    "ഇല്ല", "ഒന്നുമില്ല",
    "ਨਹੀਂ", "ਕੋਈ ਨਹੀਂ",
    "ନା", "ନାହିଁ", "କିଛି ନାହିଁ",
    "নহয়", "নাই"
}

UNSURE_TOKENS = {
    "i don't know", "dont know", "dont no", "i dont know", "not sure", "not really sure",
    "no idea", "can't tell", "cant tell", "hard to say", "uncertain", "unclear",
    "पता नहीं", "मालूम नहीं", "याद नहीं", "कह नहीं सकते", "निश्चित नहीं",
    "माहित नाही", "सांगता येत नाही", "आठवत नाही", "खात्री नाही",
    "ખબર નથી", "ખ્યાલ નથી", "કહી ના શકાય",
    "জানা নেই", "মনে নেই", "বলতে পারব না",
    "தெரியாது", "நினைவில்லை", "சொல்ல முடியாது",
    "తెలియదు", "గుర్తులేదు", "చెప్పలేను",
    "ಗೊತ್ತಿಲ್ಲ", "ನೆನಪಿಲ್ಲ", "ಹೇಳಲು ಸಾಧ್ಯವಿಲ್ಲ",
    "അറിയില്ല", "ഓർമ്മയില്ല", "വ്യക്തമല്ല",
    "ਪਤਾ ਨਹੀਂ", "ਯਾਦ ਨਹੀਂ",
    "ଜଣା ନାହିଁ", "ମନେ ନାହିଁ",
    "জনা নাই", "মনত নাই"
}

CLARIFICATION_KEYWORDS = {
    "what do you mean", "what does that mean", "what is", "what does",
    "explain", "clarify", "elaborate", "can you explain", "don't understand",
    "dont understand", "meaning of", "define",
    "मतलब क्या", "क्या मतलब", "समझा नहीं", "समझ नहीं आया", "स्पष्ट करें",
    "काय अर्थ", "अर्थ काय", "समजले नाही", "स्पष्ट करा",
    "મતલબ શું", "સમજાયું નહીં",
    "মানে কি", "বুঝতে পারলাম না",
    "என்ன அர்த்தம்", "புரியவில்லை",
    "అర్థం ఏమిటి", "అర్థం కాలేదు",
    "ಅರ್ಥವೇನು", "ತಿಳಿಯಲಿಲ್ಲ",
    "എന്താണ് അർത്ഥം", "മനസ്സിലായില്ല"
}

WHITELIST_SHORT_CLINICAL_TOKENS = {
    "bp", "pr", "hr", "rr", "sob", "ecg", "rbc", "wbc",
    "no", "yes", "none", "nil", "mild", "mod", "sev",
    "head", "chest", "arm", "jaw", "back", "leg", "neck", "foot",
    "pain", "ache", "cough", "cold", "fever", "rash", "burn",
    "5", "10", "40", "1", "2", "3", "4", "6", "7", "8", "9"
}

# Localized reprompt messages
LOCALIZED_MESSAGES = {
    "en": {
        "invalid": "I couldn't quite understand that response. Please describe your health concern or select one of the options below.",
        "out_of_range_severity": "Please rate the severity on a scale from 0 to 10 (or select mild, moderate, or severe).",
        "out_of_range_age": "Please enter a valid age between 0 and 125.",
        "irrelevant": "To help your doctor assess your condition, please stay focused on your health symptoms.",
        "max_retries": "Thank you. We will mark this detail as unspecified and continue with your assessment."
    },
    "hi": {
        "invalid": "माफ़ कीजिए, मैं आपका उत्तर समझ नहीं पाया। कृपया अपने लक्षण का संक्षेप में वर्णन करें या नीचे दिए गए विकल्पों में से चुनें।",
        "out_of_range_severity": "कृपया लक्षण की गंभीरता 0 से 10 के पैमाने पर बताएं (या हल्का, मध्यम, गंभीर चुनें)।",
        "out_of_range_age": "कृपया 0 से 125 के बीच एक मान्य आयु दर्ज करें।",
        "irrelevant": "कृपया अपने स्वास्थ्य और लक्षणों से संबंधित जानकारी ही दें ताकि डॉक्टर आपकी सही सहायता कर सकें।",
        "max_retries": "धन्यवाद। हम इस जानकारी को अनिर्दिष्ट मानकर आपका मूल्यांकन आगे बढ़ाते हैं।"
    },
    "mr": {
        "invalid": "माफ करा, मला तुमचे उत्तर समजले नाही. कृपया तुमच्या लक्षणांचे थोडक्यात वर्णन करा किंवा खालील पर्यायांपैकी निवडा.",
        "out_of_range_severity": "कृपया लक्षणाची तीव्रता 0 ते 10 च्या प्रमाणात सांगा (किंवा कमी, मध्यम, जास्त निवडा).",
        "out_of_range_age": "कृपया 0 ते 125 दरम्यान योग्य वय प्रविष्ट करा.",
        "irrelevant": "डॉक्टरांच्या मदतीसाठी कृपया तुमच्या आरोग्याशी संबंधित लक्षणांवरच लक्ष केंद्रित करा.",
        "max_retries": "धन्यवाद. ही माहिती अनिर्दिष्ट नोंदवून आम्ही पुढील तपासणी सुरू ठेवत आहोत."
    },
    "gu": {
        "invalid": "માફ કરશો, હું તમારો જવાબ સમજી શક્યો નથી. કૃપા કરીને તમારા લક્ષણોનું વર્ણન કરો અથવા નીચે આપેલા વિકલ્પોમાંથી પસંદ કરો.",
        "out_of_range_severity": "કૃપા કરીને 0 થી 10 ના સ્કેલ પર તીવ્રતા જણાવો (અથવા હળવું, મધ્યમ, ગંભીર પસંદ કરો).",
        "out_of_range_age": "કૃપા કરીને 0 થી 125 ની વચ્ચે માન્ય ઉંમર દાખલ કરો.",
        "irrelevant": "ડોક્ટરને યોગ્ય મૂલ્યાંકનમાં મદદ કરવા કૃપા કરીને આરોગ્ય લક્ષણો સંબંધિત માહિતી આપો.",
        "max_retries": "આભાર. આ વિગત અનિર્દિષ્ટ નોંધીને અમે આગળનું મૂલ્યાંકન ચાલુ રાખીએ છીએ."
    }
}

def get_feedback_message(key: str, language: str = "en") -> str:
    lang = (language or "en").lower()
    msg_map = LOCALIZED_MESSAGES.get(lang, LOCALIZED_MESSAGES["en"])
    return msg_map.get(key) or LOCALIZED_MESSAGES["en"].get(key, "Please provide a valid answer to help the doctor.")

class ClinicalValidator:
    """Hybrid validator: Stage 1 Deterministic Gate & Stage 2 Groq Semantic Gate."""

    @staticmethod
    def normalize_input(text: str) -> str:
        if text is None:
            return ""
        return text.strip()

    @staticmethod
    def is_obvious_noise(text: str) -> bool:
        """Detects keyboard mash, pure punctuation/emojis, and character spam."""
        clean = text.strip()
        if not clean:
            return True

        lower = clean.lower()
        if lower in WHITELIST_SHORT_CLINICAL_TOKENS:
            return False

        if clean.isdigit():
            return False

        # Pure punctuation or symbols without alphanumeric characters
        if not re.search(r'[\w\u0900-\u0D7F]', clean):
            return True

        # Character repetition spam: e.g. "iii", "aaaa", "xxxxxx", "......" (3 or more repeated)
        if re.search(r'(.)\1{2,}', lower):
            return True

        # Keyboard mash patterns: home row or qwerty sequence
        if re.search(r'(asdf|dfgh|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)', lower):
            return True

        return False

    @staticmethod
    def validate_deterministic(
        patient_text: str,
        target_field: Optional[str],
        current_options: List[Dict[str, str]],
        language: str = "en"
    ) -> Optional[ValidationResult]:
        """
        Stage 1 Deterministic Gate.
        Returns ValidationResult if a conclusive deterministic decision is made (0 Groq calls).
        Returns None if semantic/contextual reasoning is required.
        """
        raw = ClinicalValidator.normalize_input(patient_text)
        lower = raw.lower()

        # 1. Empty / Whitespace-only
        if not raw:
            return ValidationResult(
                decision=DECISION_INVALID,
                feedback_message=get_feedback_message("invalid", language),
                confidence=1.0,
                is_deterministic=True,
                reason="Empty or whitespace-only input."
            )

        # 2. Obvious noise / spam / punctuation
        if ClinicalValidator.is_obvious_noise(raw):
            return ValidationResult(
                decision=DECISION_INVALID,
                feedback_message=get_feedback_message("invalid", language),
                confidence=1.0,
                is_deterministic=True,
                reason="Obvious noise, punctuation, or repeated spam detected."
            )

        # 3. Contextual Quick-Option Matching
        # Only check if current_options is provided and non-empty!
        if current_options and isinstance(current_options, list) and len(current_options) > 0:
            # A. Numeric index selection (e.g. "1", "2", "3", "4")
            if lower.isdigit():
                idx = int(lower)
                if 1 <= idx <= len(current_options):
                    selected_opt = current_options[idx - 1]
                    label = selected_opt.get("label") or selected_opt.get("id") or str(idx)
                    return ValidationResult(
                        decision=DECISION_VALID_ANSWER,
                        normalized_value=label,
                        extracted_entities=[{"field": target_field, "value": label, "confidence": "High"}] if target_field else [],
                        confidence=1.0,
                        is_deterministic=True,
                        reason=f"Matched option index {idx} ('{label}')."
                    )

            # B. Option ID or Option Label match
            for opt in current_options:
                opt_id = (opt.get("id") or "").lower()
                opt_label = (opt.get("label") or "").lower()
                if lower == opt_id or lower == opt_label:
                    label = opt.get("label") or opt.get("id")
                    return ValidationResult(
                        decision=DECISION_VALID_ANSWER,
                        normalized_value=label,
                        extracted_entities=[{"field": target_field, "value": label, "confidence": "High"}] if target_field else [],
                        confidence=1.0,
                        is_deterministic=True,
                        reason=f"Exact match to option '{label}'."
                    )
        else:
            # If current_options is EMPTY, do NOT automatically accept single digits as options!
            pass

        # 4. Multilingual Unsure / Refusal Tokens
        if lower in UNSURE_TOKENS or any(lower.startswith(u) for u in ["i don't know", "dont know", "not sure", "pata nahi", "mahit nahi"]):
            return ValidationResult(
                decision=DECISION_UNSURE,
                normalized_value="Uncertain / Patient unsure",
                extracted_entities=[{"field": target_field, "value": "Uncertain / Patient unsure", "confidence": "High"}] if target_field else [],
                confidence=1.0,
                is_deterministic=True,
                reason="Explicit patient uncertainty expressed."
            )

        # 5. Field-Aware Deterministic Constraints
        if target_field:
            # A. Severity: Check numbers and words
            if target_field == "severity":
                try:
                    val = int(lower)
                    if 0 <= val <= 10:
                        return ValidationResult(
                            decision=DECISION_VALID_ANSWER,
                            normalized_value=str(val),
                            extracted_entities=[{"field": "severity", "value": str(val), "confidence": "High"}],
                            confidence=1.0,
                            is_deterministic=True,
                            reason=f"Numeric severity within 0-10 scale ({val})."
                        )
                    else:
                        return ValidationResult(
                            decision=DECISION_OUT_OF_RANGE,
                            feedback_message=get_feedback_message("out_of_range_severity", language),
                            confidence=1.0,
                            is_deterministic=True,
                            reason=f"Numeric severity out of range: {val} (expected 0-10)."
                        )
                except ValueError:
                    pass
                # Obvious invalid single-word color/nonsense for severity
                if lower in {"purple", "blue", "green", "yellow", "banana", "potato", "apple", "car", "dog"}:
                    return ValidationResult(
                        decision=DECISION_INVALID,
                        feedback_message=get_feedback_message("out_of_range_severity", language),
                        confidence=1.0,
                        is_deterministic=True,
                        reason=f"Nonsensical severity descriptor: {raw}."
                    )

            # B. Radiation / Yes-No fields
            if target_field in {"radiation"} or (current_options and len(current_options) == 2 and any("yes" in (o.get("label","").lower()) for o in current_options)):
                if lower in AFFIRMATIVE_TOKENS:
                    return ValidationResult(
                        decision=DECISION_VALID_ANSWER,
                        normalized_value="Yes",
                        extracted_entities=[{"field": target_field, "value": "Yes", "confidence": "High"}],
                        confidence=1.0,
                        is_deterministic=True,
                        reason="Affirmative token matched."
                    )
                if lower in NEGATIVE_TOKENS:
                    return ValidationResult(
                        decision=DECISION_VALID_ANSWER,
                        normalized_value="No",
                        extracted_entities=[{"field": target_field, "value": "No", "confidence": "High"}],
                        confidence=1.0,
                        is_deterministic=True,
                        reason="Negative token matched."
                    )

            # C. Duration format check (e.g. "2 days", "3 weeks", "1 month")
            if target_field == "duration":
                duration_pattern = r'^\d+\s*(day|days|hour|hours|week|weeks|month|months|year|years|दिन|घंटे|हफ्ते|महीने|दिवस|तास)'
                if re.match(duration_pattern, lower):
                    return ValidationResult(
                        decision=DECISION_VALID_ANSWER,
                        normalized_value=raw,
                        extracted_entities=[{"field": "duration", "value": raw, "confidence": "High"}],
                        confidence=1.0,
                        is_deterministic=True,
                        reason="Standard numeric duration pattern matched."
                    )

            # D. Age / Vaya (Ayush)
            if target_field in {"vaya", "age"}:
                if lower.isdigit():
                    age = int(lower)
                    if 0 <= age <= 125:
                        return ValidationResult(
                            decision=DECISION_VALID_ANSWER,
                            normalized_value=str(age),
                            extracted_entities=[{"field": target_field, "value": str(age), "confidence": "High"}],
                            confidence=1.0,
                            is_deterministic=True,
                            reason=f"Plausible age value: {age}."
                        )
                    else:
                        return ValidationResult(
                            decision=DECISION_OUT_OF_RANGE,
                            feedback_message=get_feedback_message("out_of_range_age", language),
                            confidence=1.0,
                            is_deterministic=True,
                            reason=f"Age {age} out of range 0-125."
                        )

        # Inconclusive deterministically -> delegate to Stage 2 Groq Semantic Gate
        return None

    @staticmethod
    def validate_semantic_with_groq(
        patient_text: str,
        target_field: Optional[str],
        current_question: Optional[str],
        missing_fields: List[str],
        language: str = "en",
        groq_client: Any = None,
        model: str = "openai/gpt-oss-20b"
    ) -> ValidationResult:
        """
        Stage 2 Semantic Gate.
        Performs ONE single Groq call that combines:
        - Intent classification: VALID_ANSWER, CLARIFY, UNSURE, IRRELEVANT, INVALID
        - Entity extraction for target and missing fields
        - Clarification explanation in patient's language if CLARIFY
        """
        raw = ClinicalValidator.normalize_input(patient_text)
        lower = raw.lower()

        # Offline / Fallback when Groq client is unavailable
        if not groq_client:
            logger.warning("Groq client not configured. Executing heuristic fallback.")
            if any(k in lower for k in CLARIFICATION_KEYWORDS):
                return ValidationResult(
                    decision=DECISION_CLARIFY,
                    feedback_message=f"Could you please answer: {current_question or 'your health concern'}?",
                    confidence=0.7,
                    is_deterministic=False,
                    reason="Heuristic clarification keyword match (Groq offline)."
                )
            if any(k in lower for k in UNSURE_TOKENS):
                return ValidationResult(
                    decision=DECISION_UNSURE,
                    normalized_value="Uncertain / Patient unsure",
                    extracted_entities=[{"field": target_field, "value": "Uncertain / Patient unsure", "confidence": "Medium"}] if target_field else [],
                    confidence=0.8,
                    is_deterministic=False,
                    reason="Heuristic unsure token match (Groq offline)."
                )
            return ValidationResult(
                decision=DECISION_VALID_ANSWER,
                normalized_value=raw,
                extracted_entities=[{"field": target_field, "value": raw, "confidence": "Medium"}] if target_field else [],
                confidence=0.7,
                is_deterministic=False,
                reason="Rule fallback accepted answer (Groq offline)."
            )

        prompt = f"""
You are a medical intake assistant in MediKiosk.
Evaluate the patient's response to the current intake question.

Active Field to determine: '{target_field}'
Current Question Asked: "{current_question or ''}"
All remaining missing fields: {missing_fields}
Patient Language: {language}

Patient Response: "{raw}"

Classify the response into strictly ONE of these decisions:
1. "VALID_ANSWER": Patient provides a relevant, meaningful answer describing symptoms, timing, location, or health status.
2. "CLARIFY": Patient asks for clarification, explanation, or does not understand the question/medical terms (e.g. "what does radiate mean?").
3. "UNSURE": Patient explicitly states they do not know, cannot tell, or are unsure (e.g. "I'm not sure", "no idea").
4. "IRRELEVANT": Patient is talking about unrelated topics (e.g. sports, weather, politics, chit-chat).
5. "INVALID": Pure gibberish, offensive words, or nonsensical input.

Respond strictly with a JSON object matching this schema:
{{
  "decision": "VALID_ANSWER" | "CLARIFY" | "UNSURE" | "IRRELEVANT" | "INVALID",
  "normalized_answer": "Clean medical value if VALID_ANSWER, else empty string",
  "entities": [
    {{"field": "field_name", "value": "extracted clinical value", "confidence": "High/Medium/Low"}}
  ],
  "clarification_or_feedback": "If CLARIFY, a warm, simple layman explanation answering the patient's question and politely repeating what we need in language '{language}'. If IRRELEVANT or INVALID, a polite guidance sentence in '{language}'.",
  "reason": "Brief explanation of classification"
}}
"""

        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You must output a valid JSON object matching the requested schema strictly."},
                    {"role": "user", "content": prompt}
                ],
                model=model,
                response_format={"type": "json_object"}
            )
            content = chat_completion.choices[0].message.content
            data = json.loads(content)

            decision = data.get("decision", DECISION_VALID_ANSWER).upper().strip()
            if decision not in {DECISION_VALID_ANSWER, DECISION_CLARIFY, DECISION_UNSURE, DECISION_IRRELEVANT, DECISION_INVALID}:
                decision = DECISION_VALID_ANSWER

            entities = data.get("entities", [])
            norm_val = data.get("normalized_answer") or raw
            feedback = data.get("clarification_or_feedback")

            # Fallback extraction: if VALID_ANSWER but entities list was empty, assign to target_field
            if decision == DECISION_VALID_ANSWER and not entities and target_field:
                entities = [{"field": target_field, "value": norm_val, "confidence": "Medium"}]

            return ValidationResult(
                decision=decision,
                normalized_value=norm_val,
                extracted_entities=entities,
                feedback_message=feedback,
                confidence=0.95,
                is_deterministic=False,
                reason=data.get("reason", "Groq semantic evaluation")
            )
        except Exception as e:
            logger.error(f"Groq semantic validation error: {e}. Falling back safely.")
            # Safety check: if text is obvious noise or short non-whitelisted text, reject it!
            if ClinicalValidator.is_obvious_noise(raw) or (len(raw) < 3 and raw.lower() not in WHITELIST_SHORT_CLINICAL_TOKENS and not raw.isdigit()):
                return ValidationResult(
                    decision=DECISION_INVALID,
                    feedback_message=get_feedback_message("invalid", language),
                    confidence=0.8,
                    is_deterministic=False,
                    reason=f"Rejected obvious noise during Groq fallback: {e}"
                )

            if any(k in lower for k in CLARIFICATION_KEYWORDS):
                return ValidationResult(
                    decision=DECISION_CLARIFY,
                    feedback_message=f"Could you please clarify your symptom regarding: {current_question or target_field}?",
                    confidence=0.7,
                    is_deterministic=False,
                    reason=f"Clarification heuristic during Groq fallback: {e}"
                )

            if any(k in lower for k in UNSURE_TOKENS):
                return ValidationResult(
                    decision=DECISION_UNSURE,
                    normalized_value="Uncertain / Patient unsure",
                    extracted_entities=[{"field": target_field, "value": "Uncertain / Patient unsure", "confidence": "Low"}] if target_field else [],
                    confidence=0.8,
                    is_deterministic=False,
                    reason=f"Unsure heuristic during Groq fallback: {e}"
                )

            return ValidationResult(
                decision=DECISION_VALID_ANSWER,
                normalized_value=raw,
                extracted_entities=[{"field": target_field, "value": raw, "confidence": "Low"}] if target_field else [],
                confidence=0.5,
                is_deterministic=False,
                reason=f"Groq fallback due to error: {e}"
            )
