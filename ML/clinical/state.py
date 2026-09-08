from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uuid

class ClinicalSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    language: str = "en"
    consultation_type: str = "allopathic"
    chief_complaint: str
    
    answered_fields: Dict[str, str] = Field(default_factory=dict)
    missing_fields: List[str] = Field(default_factory=list)
    clinical_entities: List[Dict[str, str]] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    current_question: Optional[str] = None
    current_options: List[Dict[str, str]] = Field(default_factory=list)
    status: str = "active"

    def get_highest_priority_missing_field(self) -> Optional[str]:
        if not self.missing_fields:
            return None
        # Basic implementation: just return the first one
        # In a real scenario, this could check dependencies (e.g. don't ask radiation if no pain)
        return self.missing_fields[0]
