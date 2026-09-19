from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import uuid

from .state import ClinicalSession
from .ontology import get_ontology
from .engine import generate_next_question, process_patient_response, generate_rag_question, LOCALIZED_FALLBACK_OPTIONS, FALLBACK_OPTIONS, extract_entities_from_text, get_fallback_options
try:
    from .rag_engine import extract_entities_rag
except ImportError:
    extract_entities_rag = None
from .summarizer import generate_summary

router = APIRouter(prefix="/clinical", tags=["Clinical AI"])

# In-memory store for MVP. Should be backed by Postgres (`clinical_sessions` table) in prod.
SESSIONS_DB = {}

class StartSessionRequest(BaseModel):
    patient_id: str
    language: str = "en"
    consultation_type: str = "allopathic"
    chief_complaint: str
    patient_profile: Optional[dict] = None

class RespondRequest(BaseModel):
    session_id: str
    patient_text: str
    state: Optional[dict] = None

class SummaryRequest(BaseModel):
    session_id: str
    document_data: Optional[dict] = None
    state: Optional[dict] = None

@router.post("/session/start")
async def start_session(req: StartSessionRequest):
    ontology = get_ontology(req.chief_complaint, req.consultation_type)
    
    session = ClinicalSession(
        patient_id=req.patient_id,
        language=req.language,
        consultation_type=req.consultation_type,
        chief_complaint=req.chief_complaint,
        missing_fields=ontology.required_fields.copy(),
        patient_profile=req.patient_profile or {}
    )

    # 1. Pre-extract location if chief complaint already specifies the body part
    complaint_lower = req.chief_complaint.lower()
    location_keywords = {
        "abdominal": "Abdomen",
        "abdomen": "Abdomen",
        "stomach": "Abdomen",
        "chest": "Chest",
        "head": "Head",
        "headache": "Head",
        "joint": "Joints / Muscles",
        "joints": "Joints / Muscles",
        "muscle": "Joints / Muscles",
        "knee": "Joints / Muscles",
        "knees": "Joints / Muscles",
        "elbow": "Joints / Muscles",
        "leg": "Joints / Muscles",
        "hand": "Joints / Muscles",
        "wrist": "Joints / Muscles",
        "back": "Back",
        "skin": "Skin"
    }
    for kw, loc_val in location_keywords.items():
        if kw in complaint_lower:
            if "location" in session.missing_fields:
                session.missing_fields.remove("location")
            session.answered_fields["location"] = loc_val
            session.clinical_entities.append({"field": "location", "value": loc_val, "confidence": "High"})
            break

    # 1.2 Deterministic Duration & Onset Pre-extraction from initial text input
    import re
    dur_match = re.search(r'(?:for|since|about|around)?\s*(\d+\s*(?:-\s*\d+)?\s*(?:days|day|hours|hour|weeks|week|months|month|years|year|din|hafte|mahine|दिवस|तास|दिन|हफ्ते|महीने)\s*(?:ago)?)', complaint_lower)
    if dur_match:
        dur_val = dur_match.group(0).strip()
        if "duration" in session.missing_fields:
            session.missing_fields.remove("duration")
        if "onset" in session.missing_fields:
            session.missing_fields.remove("onset")
        session.answered_fields["duration"] = dur_val
        session.answered_fields["onset"] = dur_val
        session.clinical_entities.append({"field": "duration", "value": dur_val, "confidence": "High"})

    # 1.5 Auto-derive Vaya (Age) from patient profile if available
    if "vaya" in session.missing_fields and session.patient_profile:
        age = session.patient_profile.get("age")
        if age is not None:
            vaya_val = "Youth"
            if int(age) > 60:
                vaya_val = "Senior"
            elif int(age) > 35:
                vaya_val = "Middle-aged"
            
            session.missing_fields.remove("vaya")
            session.answered_fields["vaya"] = vaya_val
            session.clinical_entities.append({"field": "vaya", "value": vaya_val, "confidence": "High"})

    # 2. Pre-extract any clinical parameters answered upfront (e.g., duration "for 2 3 days", severity, onset)
    # to avoid repeating questions the patient already answered in their initial text input.
    try:
        if extract_entities_rag:
            init_extracted = extract_entities_rag(req.chief_complaint, session)
        else:
            init_extracted = extract_entities_from_text(req.chief_complaint, session.missing_fields)
        
        if init_extracted and init_extracted.entities:
            for ent in init_extracted.entities:
                if ent.field in session.missing_fields and ent.value:
                    session.missing_fields.remove(ent.field)
                    session.answered_fields[ent.field] = ent.value
                    session.clinical_entities.append(ent.model_dump())
    except Exception as e:
        import logging
        logging.getLogger("medikiosk.clinical.router").warning(f"Initial entity pre-extraction notice: {e}")
    
    SESSIONS_DB[session.session_id] = session
    
    # Generate the first question via RAG Primary Pipeline
    next_field = session.get_highest_priority_missing_field()
    if next_field:
        if generate_rag_question:
            next_q, options = generate_rag_question(session, next_field)
        else:
            next_q, options = generate_next_question(next_field, session.language, session=session)
    else:
        next_q, options = "How can I help you?", []
    
    session.conversation_history.append({"role": "system", "content": next_q})
    
    return {
        "session_id": session.session_id,
        "next_question": next_q,
        "options": options,
        "rag_sources": getattr(session, "rag_sources", []),
        "state": session.model_dump()
    }

@router.post("/session/respond")
async def respond(req: RespondRequest):
    session = SESSIONS_DB.get(req.session_id)
    if not session and req.state:
        try:
            session = ClinicalSession(**req.state)
            SESSIONS_DB[req.session_id] = session
        except Exception as e:
            session = None
            
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session.status == "completed":
        return {
            "message": "Session is already completed",
            "is_complete": True,
            "options": [],
            "rag_sources": getattr(session, "rag_sources", []),
            "state": session.model_dump()
        }
        
    session, next_q, options = process_patient_response(session, req.patient_text)
    SESSIONS_DB[req.session_id] = session
    
    return {
        "next_question": next_q if session.status != "completed" else None,
        "options": options if session.status != "completed" else [],
        "extracted_entities": session.clinical_entities,
        "red_flags": session.red_flags,
        "is_complete": session.status == "completed",
        "rag_sources": getattr(session, "rag_sources", []),
        "state": session.model_dump()
    }

@router.post("/session/summary")
async def get_summary(req: SummaryRequest):
    session = SESSIONS_DB.get(req.session_id)
    if not session and req.state:
        try:
            session = ClinicalSession(**req.state)
            SESSIONS_DB[req.session_id] = session
        except Exception:
            pass
            
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    summary_text = generate_summary(session, req.document_data)
    
    return {
        "session_id": req.session_id,
        "summary": summary_text,
        "rag_sources": getattr(session, "rag_sources", [])
    }
