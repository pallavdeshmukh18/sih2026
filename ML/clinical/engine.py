import json
import logging
from typing import Tuple, List, Dict
try:
    from groq import Groq
except ImportError:
    Groq = None

from config import GROQ_API_KEY, GROQ_TEXT_MODEL
from .ontology import ExtractionResult, get_ontology
from .state import ClinicalSession
from .safety import evaluate_red_flags

logger = logging.getLogger("medikiosk.clinical.engine")

groq_client = None
if GROQ_API_KEY and Groq is not None:
    groq_client = Groq(api_key=GROQ_API_KEY)

DEFAULT_QUESTIONS: Dict[str, str] = {
    "onset": "When did this symptom start, or how suddenly did it begin?",
    "duration": "How long have you been experiencing this health concern?",
    "location": "Where specifically in your body are you feeling this discomfort?",
    "character": "How would you describe the sensation (e.g. sharp, dull, aching, throbbing)?",
    "radiation": "Does the pain or discomfort spread to any other area of your body?",
    "severity": "How severe would you rate this symptom (e.g. mild, moderate, or severe)?",
    "aggravating_factors": "Is there anything specific that makes your condition worse?",
    "relieving_factors": "Does anything bring you noticeable relief (e.g., rest, heat, medicine)?",
    "associated_symptoms": "Are you experiencing any other symptoms alongside this (e.g. fever, nausea)?",
    "last_meal": "When was your last meal and what did you eat?",
    "bowel_movements": "How have your bowel movements and digestion been recently?",
    "prakriti": "How would you describe your natural physical constitution and heat/cold tolerance?",
    "vikriti": "Have you noticed any recent imbalance in your sleep, energy, or digestion?",
    "sara": "How is your overall physical stamina and vital strength?",
    "samhanana": "How would you describe your physical build (e.g., slender, medium, heavy)?",
    "pramana": "Are your body proportions and weight normal for you?",
    "satmya": "What foods or climatic conditions suit your body best?",
    "sattva": "How is your mental resilience, mood, and stress level?",
    "ahara_shakti": "How is your appetite and digestive fire (Agni)?",
    "vyayama_shakti": "How is your capacity for physical exercise and exertion?",
    "vaya": "What is your age category (youth, middle-aged, or senior)?"
}

def extract_entities_from_text(text: str, missing_fields: List[str]) -> ExtractionResult:
    """Uses Groq to extract structured fields from patient text."""
    if not groq_client:
        logger.warning("No Groq API key, skipping AI entity extraction.")
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
    """Uses Groq or natural fallbacks to generate a clear question for a missing field."""
    fallback_q = DEFAULT_QUESTIONS.get(
        missing_field, 
        f"Can you tell me more about the {missing_field.replace('_', ' ')}?"
    )
    
    if not groq_client:
        return fallback_q
        
    prompt = f"""
    You are an empathetic medical intake assistant. 
    Ask the patient a single, clear question to determine their '{missing_field}'.
    If the field is an Ayurvedic/Dashavidha Pariksha parameter, frame the question simply so a layman can understand.
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
        q = chat_completion.choices[0].message.content.strip()
        return q if q else fallback_q
    except Exception as e:
        logger.error(f"Failed to generate question: {e}")
        return fallback_q

def process_patient_response(session: ClinicalSession, patient_text: str) -> ClinicalSession:
    """Core logic to process a response, update state, and determine next steps."""
    
    # 0. Identify the target field that was being asked prior to this response
    target_field = session.get_highest_priority_missing_field()

    # 1. Log conversation
    session.conversation_history.append({"role": "patient", "content": patient_text})
    
    # 2. Extract entities via LLM
    extraction = extract_entities_from_text(patient_text, session.missing_fields)
    
    # 3. Update state with extracted entities
    extracted_fields = set()
    for entity in extraction.entities:
        if entity.field in session.missing_fields:
            session.missing_fields.remove(entity.field)
            extracted_fields.add(entity.field)
        session.answered_fields[entity.field] = entity.value
        session.clinical_entities.append(entity.model_dump())

    # 4. Mandatory progression rule: If target_field was not satisfied by entity extraction,
    # mark it as answered with patient_text so the assessment moves forward!
    if target_field and target_field in session.missing_fields:
        session.missing_fields.remove(target_field)
        session.answered_fields[target_field] = patient_text
        session.clinical_entities.append({
            "field": target_field,
            "value": patient_text,
            "confidence": "High"
        })
        
    # 5. Check safety / red flags
    new_flags = evaluate_red_flags(session.clinical_entities)
    for flag in new_flags:
        if flag not in session.red_flags:
            session.red_flags.append(flag)
            
    # 6. Check if complete
    if not session.missing_fields:
        session.status = "completed"
        session.conversation_history.append({
            "role": "system", 
            "content": "Thank you. Your clinical intake assessment is complete!"
        })
        return session
        
    # 7. Generate next question for the new highest-priority missing field
    next_field = session.get_highest_priority_missing_field()
    next_q = generate_next_question(next_field, session.language)
    session.conversation_history.append({"role": "system", "content": next_q})
    
    return session
