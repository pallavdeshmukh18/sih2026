from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import uuid

from .state import ClinicalSession
from .ontology import get_ontology
from .engine import generate_next_question, process_patient_response, generate_rag_question, LOCALIZED_FALLBACK_OPTIONS, FALLBACK_OPTIONS
from .summarizer import generate_summary

router = APIRouter(prefix="/clinical", tags=["Clinical AI"])

# In-memory store for MVP. Should be backed by Postgres (`clinical_sessions` table) in prod.
SESSIONS_DB = {}

class StartSessionRequest(BaseModel):
    patient_id: str
    language: str = "en"
    consultation_type: str = "allopathic"
    chief_complaint: str

class RespondRequest(BaseModel):
    session_id: str
    patient_text: str
    state: Optional[dict] = None

class SummaryRequest(BaseModel):
    session_id: str
    document_data: Optional[dict] = None

@router.post("/session/start")
async def start_session(req: StartSessionRequest):
    ontology = get_ontology(req.chief_complaint, req.consultation_type)
    
    session = ClinicalSession(
        patient_id=req.patient_id,
        language=req.language,
        consultation_type=req.consultation_type,
        chief_complaint=req.chief_complaint,
        missing_fields=ontology.required_fields.copy()
    )
    
    SESSIONS_DB[session.session_id] = session
    
    # Generate the first question via RAG Primary Pipeline
    next_field = session.get_highest_priority_missing_field()
    if next_field:
        if generate_rag_question:
            next_q = generate_rag_question(session, next_field)
            options = LOCALIZED_FALLBACK_OPTIONS.get(session.language, FALLBACK_OPTIONS).get(next_field, [])
        else:
            next_q, options = generate_next_question(next_field, session.language)
    else:
        next_q, options = "How can I help you?", []
    
    session.conversation_history.append({"role": "system", "content": next_q})
    
    return {
        "session_id": session.session_id,
        "next_question": next_q,
        "options": options,
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
        "state": session.model_dump()
    }

@router.post("/session/summary")
async def get_summary(req: SummaryRequest):
    session = SESSIONS_DB.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    summary_text = generate_summary(session, req.document_data)
    
    # Optionally, save this back to the DB session record
    
    return {
        "session_id": req.session_id,
        "summary": summary_text
    }
