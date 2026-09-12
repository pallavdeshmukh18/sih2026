import json
import logging
from typing import List, Dict, Any

try:
    from groq import Groq
except ImportError:
    Groq = None

from config import GROQ_API_KEY, GROQ_TEXT_MODEL
from embeddings.retrieve import retrieve_clinical_knowledge, semantic_search
from .ontology import ExtractionResult
from .state import ClinicalSession

logger = logging.getLogger("medikiosk.clinical.rag_engine")

groq_client = None
if GROQ_API_KEY and Groq is not None:
    groq_client = Groq(api_key=GROQ_API_KEY)

LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "gu": "Gujarati",
    "bn": "Bengali", "ta": "Tamil", "te": "Telugu", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese"
}

# Plain-English description of every AYUSH / Dashavidha Pariksha field.
# These are injected into the LLM prompt so it NEVER exposes the raw field name to the patient.
AYUSH_FIELD_DESCRIPTIONS: Dict[str, str] = {
    "prakriti": "the patient's natural body tendency — do they feel cold easily / have dry skin, or do they sweat easily / feel hot, or feel heavy and slow",
    "vikriti": "any recent changes in the patient's sleep, energy levels, or digestion compared to their usual self",
    "sara": "the patient's daily physical energy and stamina",
    "samhanana": "the patient's body build — naturally slim, medium-built, or on the heavier side",
    "pramana": "whether the patient's weight and height feel balanced and normal for them",
    "satmya": "what kinds of food, weather, or environments make the patient feel most comfortable and healthy",
    "sattva": "the patient's mental strength — how well they handle stress or emotional challenges",
    "ahara_shakti": "the patient's appetite and how comfortably they digest food",
    "vyayama_shakti": "how much physical activity the patient can comfortably do without getting very tired",
    "agni": "the patient's digestion pattern — whether they feel comfortable after meals or often get bloated, acidic, or heavy",
    "koshtha": "the patient's daily bowel habits — regular and easy, often constipated, or frequently loose",
    "ahara_vihara": "the patient's typical daily routine — diet, sleep schedule, and physical activity",
    "nidana": "what the patient thinks may have triggered or worsened this condition (diet change, stress, weather, etc.)",
    "samprapti": "whether this problem started suddenly all at once, or built up gradually over time",
    "dushya": "any recent changes in the patient's skin, hair, nails, muscles, or body weight",
    "desha": "where the patient lives and what the climate is like there (hot, cold, humid, or dry)",
    "bala": "the patient's overall immunity and physical strength — do they fall sick often",
    "kala": "whether symptoms get worse at a particular time of day or during certain seasons",
    "vaya": "the patient's age group (young — below 30 / middle-aged — 30 to 60 / senior — above 60)",
}


def _build_conversation_context(session: ClinicalSession, max_turns: int = 4) -> str:
    """
    Builds a compact textual summary of the conversation so far,
    including answered fields and the last N Q&A exchanges.
    """
    parts = []

    # Already-collected clinical parameters
    if session.answered_fields:
        answered_str = ", ".join(
            f"{k.replace('_', ' ').title()}: {v}"
            for k, v in session.answered_fields.items()
        )
        parts.append(f"ALREADY COLLECTED FROM PATIENT: {answered_str}")

    # Recent conversation turns (last max_turns messages)
    recent = session.conversation_history[-max_turns:] if session.conversation_history else []
    if recent:
        exchange_lines = []
        for msg in recent:
            role_label = "Doctor (AI)" if msg["role"] == "system" else "Patient"
            exchange_lines.append(f"  {role_label}: {msg['content']}")
        parts.append("RECENT CONVERSATION:\n" + "\n".join(exchange_lines))

    return "\n\n".join(parts)


def generate_rag_question(session: ClinicalSession, missing_field: str) -> str:
    """
    Primary RAG Questioning Generator.
    Retrieves disease-specific clinical guidelines and patient record context from ChromaDB
    to formulate a reworded, disease-tailored question asking for the missing field alongside
    disease-specific diagnostic context.

    Now includes FULL conversation context so each question is a natural follow-up
    to whatever the patient just said — like a real doctor conducting history-taking.
    Never exposes raw Ayurvedic field names or Sanskrit terms to the patient.
    """
    lang_name = LANGUAGE_NAMES.get(session.language.lower(), "English")

    # Plain-English meaning for this field (works for both AYUSH and standard fields)
    ayush_meaning = AYUSH_FIELD_DESCRIPTIONS.get(
        missing_field,
        f"information about {missing_field.replace('_', ' ')}"
    )

    # 1. RETRIEVE DISEASE-SPECIFIC CLINICAL GUIDELINES FROM CHROMADB
    query_term = f"{session.chief_complaint} {missing_field}"
    disease_knowledge = retrieve_clinical_knowledge(query_term, top_k=2)
    knowledge_context = "\n---\n".join([item["text"] for item in disease_knowledge]) if disease_knowledge else ""

    # 2. RETRIEVE PATIENT RECORD CONTEXT FROM CHROMADB (IF PATIENT ID PRESENT)
    patient_history_context = ""
    if session.patient_id:
        records = semantic_search(patient_id=session.patient_id, query=query_term, top_k=2)
        if records:
            patient_history_context = "\n".join([f"- {r['text']}" for r in records])

    # 3. BUILD CONVERSATION CONTEXT (answered fields + recent Q&A)
    conversation_context = _build_conversation_context(session)

    # 4. PRIMARY: Try to extract parameter exact rephrasing directly from retrieved ChromaDB text.
    #    Only use this shortcut if the extracted line does NOT contain the raw field name.
    if disease_knowledge:
        for doc in disease_knowledge:
            if f"{missing_field}:" in doc["text"]:
                for line in doc["text"].split("\n"):
                    if line.strip().startswith(f"{missing_field}:"):
                        candidate = line.split(":", 1)[1].strip()
                        # Sanity-check: don't return if it still contains the raw field name or jargon
                        blocked_terms = [missing_field, "prakriti", "vikriti", "satmya", "samhanana",
                                         "sattva", "vyayama", "ahara", "koshtha", "nidana", "samprapti",
                                         "dushya", "desha", "bala", "kala", "vata", "pitta", "kapha", "dosha"]
                        if not any(t.lower() in candidate.lower() for t in blocked_terms):
                            return candidate

    # 5. Build Augmented Prompt and use Groq LLM
    profile_text = ""
    if session.patient_profile:
        prof = session.patient_profile
        profile_parts = []
        if prof.get("age") is not None:
            profile_parts.append(f"Age: {prof.get('age')}")
        if prof.get("gender"):
            profile_parts.append(f"Gender: {prof.get('gender')}")
        if prof.get("medical_history"):
            hist_str = ", ".join([f"{h.get('condition')} ({h.get('status')})" for h in prof.get("medical_history")])
            profile_parts.append(f"Medical History: {hist_str}")

        if profile_parts:
            profile_text = "\n=== PATIENT DEMOGRAPHICS & HISTORY ===\n" + "\n".join(profile_parts) + "\n"

    prompt = f"""You are MediKiosk's Clinical AI Assistant conducting a structured medical history intake.
You are speaking directly to the patient — like a caring, experienced family doctor taking their history.

CONSULTATION TYPE: "{session.consultation_type.upper()}"
CHIEF COMPLAINT: "{session.chief_complaint}"
PATIENT LANGUAGE: {lang_name} ({session.language})
{profile_text}
=== CONVERSATION SO FAR ===
{conversation_context if conversation_context else "This is the first question of the intake."}

=== CLINICAL GUIDELINES (FROM KNOWLEDGE BASE) ===
{knowledge_context if knowledge_context else "Standard clinical intake protocols apply."}

=== PATIENT PAST MEDICAL RECORDS ===
{patient_history_context if patient_history_context else "No prior records on file for this patient."}

=== WHAT YOU NEED TO FIND OUT NEXT ===
You need to ask the patient about: {ayush_meaning}

=== STRICT RULES — ALL MANDATORY ===
1. NEVER mention the technical field code "{missing_field}" — the patient cannot understand it.
2. NEVER use ANY Ayurvedic or Sanskrit terminology: Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Agni, Vata, Pitta, Kapha, Dosha, Tridosha, Koshtha, Nidana, Samprapti, Dushya, Desha, Bala, Kala, or similar words.
3. Frame your question as a NATURAL FOLLOW-UP to what the patient just said. Briefly acknowledge their last response first.
4. Use simple, everyday conversational language that any patient (not a doctor) can immediately understand.
5. Keep it concise — maximum 2 sentences.
6. Do NOT give medical advice, diagnoses, or invent information about the patient.
7. Output ONLY the question text in {lang_name}. No preamble, no JSON, no labels, no explanation.
"""

    if groq_client:
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are a patient-friendly clinical intake assistant. "
                            f"You MUST write all questions in simple everyday {lang_name} that any layperson can understand. "
                            f"NEVER use medical jargon, Sanskrit terms, or Ayurvedic terminology. "
                            f"NEVER use the raw field name '{missing_field}' in any output."
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=GROQ_TEXT_MODEL,
            )
            q = chat_completion.choices[0].message.content.strip()
            # Strip any accidental quotes the LLM may wrap the question in
            if q and q[0] == '"' and q[-1] == '"':
                q = q[1:-1].strip()
            if q:
                return q
        except Exception as e:
            logger.error(f"RAG Question Generation LLM error: {e}")

    # Fallback: use the plain-English description, never the raw field name
    return f"Understood, thank you. I have one more question — could you tell me about {ayush_meaning}?"


def extract_entities_rag(text: str, session: ClinicalSession) -> ExtractionResult:
    """
    RAG-Augmented Entity Extraction.
    Uses disease-specific guidelines retrieved from ChromaDB to parse free-text responses.
    """
    query_term = f"{session.chief_complaint} {' '.join(session.missing_fields)}"
    disease_knowledge = retrieve_clinical_knowledge(query_term, top_k=2)
    knowledge_context = "\n---\n".join([item["text"] for item in disease_knowledge]) if disease_knowledge else ""

    prompt = f"""
    You are a clinical NLP entity extractor.
    Extract ONLY medical information that is explicitly mentioned or clearly implied in the patient's input.

    Patient text: "{text}"
    Target Missing Fields: {session.missing_fields}
    Chief Complaint: "{session.chief_complaint}"

    === RETRIEVED DISEASE CLINICAL GUIDELINES ===
    {knowledge_context}

    Return a JSON object:
    {{
        "entities": [
            {{"field": "field_name", "value": "extracted value", "confidence": "High/Medium/Low"}}
        ]
    }}
    CRITICAL INSTRUCTION:
    - Include ONLY fields that the patient EXPLICITLY mentioned or clearly implied.
    - DO NOT include empty strings "", "unknown", "null", "none", "n/a", or unmentioned fields.
    - If a field from Target Missing Fields was NOT mentioned by the patient, DO NOT include it in the entities array.
    """

    if groq_client:
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "Output valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model=GROQ_TEXT_MODEL,
                response_format={"type": "json_object"}
            )
            data = json.loads(chat_completion.choices[0].message.content)
            return ExtractionResult(**data)
        except Exception as e:
            logger.error(f"RAG Entity Extraction error: {e}")

    return ExtractionResult(entities=[])
