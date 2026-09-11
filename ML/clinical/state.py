from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import uuid

# ─── Clinical Flow Graph ───────────────────────────────────────────────
# Defines the natural order a doctor follows during history-taking.
# After answering field X, the next most-relevant field is determined
# by this adjacency map.  Keys are the "just answered" field; values
# are the ordered list of preferred next fields to ask.
#
# The graph encodes the clinical reasoning:
#   onset/duration → character (what does it feel like?)
#   character → severity (how bad?)
#   severity → location (if not already inferred from chief complaint)
#   location → radiation (does it spread?)
#   radiation → aggravating_factors (what makes it worse?)
#   aggravating_factors → relieving_factors (what helps?)
#   relieving_factors → associated_symptoms (anything else going on?)
#   associated_symptoms → GI-specific fields if applicable
#   GI fields → AYUSH fields if consultation_type is ayush
CLINICAL_FLOW_GRAPH: Dict[str, List[str]] = {
    # Core symptom exploration — follows OLDCARTS / SOCRATES mnemonic
    "onset":                ["duration", "character", "severity", "location"],
    "duration":             ["character", "severity", "location", "onset"],
    "character":            ["severity", "radiation", "location", "aggravating_factors"],
    "severity":             ["location", "radiation", "aggravating_factors", "character"],
    "location":             ["radiation", "character", "severity", "aggravating_factors"],
    "radiation":            ["aggravating_factors", "relieving_factors", "associated_symptoms"],
    "aggravating_factors":  ["relieving_factors", "associated_symptoms", "radiation"],
    "relieving_factors":    ["associated_symptoms", "aggravating_factors"],
    "associated_symptoms":  ["last_meal", "bowel_movements"],

    # GI-specific deep-dive (only present in abdominal ontologies)
    "last_meal":            ["bowel_movements", "associated_symptoms"],
    "bowel_movements":      ["last_meal", "associated_symptoms"],

    # AYUSH Dashavidha Pariksha — natural clinical ordering
    "prakriti":             ["vikriti", "sara", "samhanana"],
    "vikriti":              ["sara", "samhanana", "sattva"],
    "sara":                 ["samhanana", "pramana", "ahara_shakti"],
    "samhanana":            ["pramana", "satmya", "ahara_shakti"],
    "pramana":              ["satmya", "sattva", "ahara_shakti"],
    "satmya":               ["sattva", "ahara_shakti", "vyayama_shakti"],
    "sattva":               ["ahara_shakti", "vyayama_shakti", "vaya"],
    "ahara_shakti":         ["vyayama_shakti", "vaya"],
    "vyayama_shakti":       ["vaya"],
    "vaya":                 [],
}

# Default priority order when there is no last_answered_field yet
# (first question of the session).  Follows standard HPI opening.
DEFAULT_FIELD_PRIORITY = [
    "onset", "duration", "character", "severity", "location",
    "radiation", "aggravating_factors", "relieving_factors",
    "associated_symptoms",
    # GI-specific
    "last_meal", "bowel_movements",
    # AYUSH
    "prakriti", "vikriti", "sara", "samhanana", "pramana",
    "satmya", "sattva", "ahara_shakti", "vyayama_shakti", "vaya",
]


class ClinicalSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    language: str = "en"
    consultation_type: str = "allopathic"
    chief_complaint: str
    patient_profile: Dict[str, Any] = Field(default_factory=dict)
    
    answered_fields: Dict[str, str] = Field(default_factory=dict)
    missing_fields: List[str] = Field(default_factory=list)
    clinical_entities: List[Dict[str, str]] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    current_question: Optional[str] = None
    current_options: List[Dict[str, str]] = Field(default_factory=list)
    retry_counts: Dict[str, int] = Field(default_factory=dict)
    status: str = "active"

    # ── NEW: tracks the field that was just answered so the flow
    #    graph can determine the most clinically-relevant next field.
    last_answered_field: Optional[str] = None

    def get_highest_priority_missing_field(self) -> Optional[str]:
        """
        Selects the next field to ask about using the clinical flow graph.
        
        Strategy:
        1. If we know what was last answered, follow the flow graph edges
           to find the first still-missing field in that branch.
        2. Otherwise, fall back to the default clinical priority order.
        3. As a final safety net, return whatever is first in missing_fields.
        """
        if not self.missing_fields:
            return None

        # Strategy 1: Follow the flow graph from the last answered field
        if self.last_answered_field and self.last_answered_field in CLINICAL_FLOW_GRAPH:
            preferred = CLINICAL_FLOW_GRAPH[self.last_answered_field]
            for candidate in preferred:
                if candidate in self.missing_fields:
                    return candidate

        # Strategy 2: Fall back to default clinical priority
        for candidate in DEFAULT_FIELD_PRIORITY:
            if candidate in self.missing_fields:
                return candidate

        # Strategy 3: Safety net — return first remaining
        return self.missing_fields[0]

    def record_retry(self, field: str) -> int:
        self.retry_counts[field] = self.retry_counts.get(field, 0) + 1
        return self.retry_counts[field]

    def get_retry_count(self, field: str) -> int:
        return self.retry_counts.get(field, 0)

    def reset_retry(self, field: str) -> None:
        if field in self.retry_counts:
            self.retry_counts[field] = 0
