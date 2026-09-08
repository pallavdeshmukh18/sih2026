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


def generate_rag_question(session: ClinicalSession, missing_field: str) -> str:
    """
    Primary RAG Questioning Generator.
    Retrieves disease-specific clinical guidelines and patient record context from ChromaDB
    to formulate a reworded, disease-tailored question asking for the missing field alongside
    disease-specific diagnostic context.
    """
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

    # 3. BUILD AUGMENTED RAG PROMPT
    prompt = f"""
    You are MediKiosk's RAG Clinical AI Assistant.
    Your task is to ask the patient a single, natural, empathetic question to collect their '{missing_field}'.

    CHIEF COMPLAINT: "{session.chief_complaint}"
    MISSING PARAMETER TO ASK: "{missing_field}"
    PATIENT LANGUAGE: {session.language}

    === DISEASE-SPECIFIC CLINICAL GUIDELINES (RETRIEVED FROM RAG VECTOR STORE) ===
    {knowledge_context if knowledge_context else "Standard clinical intake protocols apply."}

    === PATIENT PAST MEDICAL RECORDS (RETRIEVED FROM RAG VECTOR STORE) ===
    {patient_history_context if patient_history_context else "No prior records on file for this patient."}

    INSTRUCTIONS:
    1. Adapt the question wording to suit the specific disease/symptom ({session.chief_complaint}).
    2. If the retrieved guidelines list disease-specific questions or custom phrasing for '{missing_field}', incorporate them naturally.
    3. If past patient records are available, subtly acknowledge them if relevant.
    4. Keep the question polite, layman-friendly, and concise. Do NOT give medical advice or diagnosis.
    """

    if groq_client:
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=GROQ_TEXT_MODEL,
            )
            q = chat_completion.choices[0].message.content.strip()
            if q:
                return q
        except Exception as e:
            logger.error(f"RAG Question Generation LLM error: {e}")

    # Fallback if LLM fails
    if disease_knowledge:
        # Extract parameter rephrasing from retrieved text if present
        for doc in disease_knowledge:
            if f"{missing_field}:" in doc["text"]:
                for line in doc["text"].split("\n"):
                    if line.strip().startswith(f"{missing_field}:"):
                        return line.split(":", 1)[1].strip()

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
