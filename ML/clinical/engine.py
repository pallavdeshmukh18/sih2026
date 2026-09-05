import json
import logging
from typing import Tuple, List, Dict
from groq import Groq
from pydantic import ValidationError

from config import GROQ_API_KEY, GROQ_TEXT_MODEL
from .ontology import ExtractionResult, get_ontology
from .state import ClinicalSession
from .safety import evaluate_red_flags

logger = logging.getLogger("medikiosk.clinical.engine")

groq_client = None
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
    
def extract_entities_from_text(text: str, missing_fields: List[str]) -> ExtractionResult:
    """Uses Groq to extract structured fields from patient text."""
    if not groq_client:
        logger.warning("No Groq API key, skipping extraction.")
        return ExtractionResult(entities=[])

    prompt = f"""
    You are a clinical AI assistant. Extract relevant medical information from the patient's text.
    Currently, we are looking for values for the following fields: {missing_fields}.
    Note: Some fields may be Ayurvedic Dashavidha Pariksha parameters (like prakriti, ahara_shakti, etc.). Extract them if the patient's text implies them.
    
    Patient text: "{text}"
    
    Return the response as a JSON object matching this schema:
    {{
        "entities": [
            {{"field": "field_name", "value": "extracted value", "confidence": "High/Medium/Low"}}
        ]
    }}
    Only include fields that are explicitly mentioned or clearly implied.
    """
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You must output a valid JSON object."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=GROQ_TEXT_MODEL,
            response_format={"type": "json_object"}
        )
        text_content = chat_completion.choices[0].message.content
        data = json.loads(text_content)
        return ExtractionResult(**data)
    except Exception as e:
        logger.error(f"Failed to extract entities: {e}")
        return ExtractionResult(entities=[])

def generate_next_question(missing_field: str, language: str = "en") -> str:
    """Uses Groq to generate a natural, empathetic question for a missing field."""
    if not groq_client:
        return f"Can you tell me about the {missing_field}?"
        
    prompt = f"""
    You are an empathetic medical intake assistant. 
    Ask the patient a single, clear question to determine their '{missing_field}'.
    If the field is an Ayurvedic/Dashavidha Pariksha parameter (e.g., prakriti, vikriti, sara, samhanana, pramana, satmya, sattva, ahara_shakti, vyayama_shakti, vaya), frame the question simply so a layman can understand.
    Language: {language}.
    Do NOT offer medical advice. Just ask the question politely.
    """
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=GROQ_TEXT_MODEL,
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Failed to generate question: {e}")
        return f"Can you tell me about the {missing_field}?"

def process_patient_response(session: ClinicalSession, patient_text: str) -> ClinicalSession:
    """Core logic to process a response, update state, and determine next steps."""
    
    # 1. Log conversation
    session.conversation_history.append({"role": "patient", "content": patient_text})
    
    # 2. Extract entities
    extraction = extract_entities_from_text(patient_text, session.missing_fields)
    
    # 3. Update state
    for entity in extraction.entities:
        if entity.field in session.missing_fields:
            session.missing_fields.remove(entity.field)
        session.answered_fields[entity.field] = entity.value
        session.clinical_entities.append(entity.model_dump())
        
    # 4. Check safety / red flags
    new_flags = evaluate_red_flags(session.clinical_entities)
    for flag in new_flags:
        if flag not in session.red_flags:
            session.red_flags.append(flag)
            
    # 5. Check if complete
    if not session.missing_fields:
        session.status = "completed"
        session.conversation_history.append({"role": "system", "content": "Thank you. Your information has been recorded."})
        return session
        
    # 6. Generate next question
    next_field = session.get_highest_priority_missing_field()
    next_q = generate_next_question(next_field, session.language)
    session.conversation_history.append({"role": "system", "content": next_q})
    
    return session
