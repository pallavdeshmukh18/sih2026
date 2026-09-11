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
    """
    lang_name = LANGUAGE_NAMES.get(session.language.lower(), "English")

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

    # 4. PRIMARY: Try to extract parameter exact rephrasing directly from retrieved ChromaDB text
    if disease_knowledge:
        for doc in disease_knowledge:
            if f"{missing_field}:" in doc["text"]:
                for line in doc["text"].split("\n"):
                    if line.strip().startswith(f"{missing_field}:"):
                        return line.split(":", 1)[1].strip()

    # 5. Build Augmented Prompt and use Groq LLM if ChromaDB didn't have an exact match
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

    prompt = f"""You are MediKiosk's RAG Clinical AI Assistant conducting a structured medical history intake.
You are speaking directly to the patient — like a caring, experienced doctor taking their history.

CHIEF COMPLAINT: "{session.chief_complaint}"
NEXT PARAMETER TO ASK ABOUT: "{missing_field}"
PATIENT LANGUAGE: {lang_name} ({session.language})
{profile_text}
=== CONVERSATION SO FAR ===
{conversation_context if conversation_context else "This is the first question of the intake."}

=== DISEASE-SPECIFIC CLINICAL GUIDELINES (RETRIEVED FROM RAG VECTOR STORE) ===
{knowledge_context if knowledge_context else "Standard clinical intake protocols apply."}

=== PATIENT PAST MEDICAL RECORDS (RETRIEVED FROM RAG VECTOR STORE) ===
{patient_history_context if patient_history_context else "No prior records on file for this patient."}

INSTRUCTIONS:
1. Frame your question as a NATURAL FOLLOW-UP to the patient's most recent answer. Acknowledge or briefly reference what they just told you before transitioning to the next question.
   - Example: If the patient just said "sharp pain for 3 days", you might say: "Sharp pain for 3 days — that's helpful to know. Now, can you tell me how severe it feels, from mild to severe?"
2. Adapt the question wording to suit the specific disease/symptom ({session.chief_complaint}).
3. If the retrieved clinical guidelines list disease-specific questions for '{missing_field}', incorporate them naturally.
4. If past patient records are available, subtly acknowledge them if relevant (e.g., "Given your history of...").
5. Keep the question polite, layman-friendly, and concise. Do NOT give medical advice or diagnosis.
6. Output ONLY the question text in {lang_name}. No preamble, no JSON wrapping, no explanation.
"""

    if groq_client:
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
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

    return f"Could you please tell me more about the {missing_field.replace('_', ' ')} related to your {session.chief_complaint}?"


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
