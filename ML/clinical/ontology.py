from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChiefComplaintOntology(BaseModel):
    """Base class for a specific chief complaint ontology."""
    complaint_name: str
    required_fields: List[str]
    optional_fields: List[str]
    
class ChestPainOntology(ChiefComplaintOntology):
    complaint_name: str = "chest_pain"
    required_fields: List[str] = [
        "duration",
        "location",
        "character",
        "radiation",
        "severity",
        "aggravating_factors",
        "relieving_factors",
        "associated_symptoms"
    ]
    optional_fields: List[str] = ["past_history", "medications"]

class AbdominalPainOntology(ChiefComplaintOntology):
    complaint_name: str = "abdominal_pain"
    required_fields: List[str] = [
        "duration",
        "location",
        "character",
        "severity",
        "aggravating_factors",
        "relieving_factors",
        "associated_symptoms",
        "last_meal",
        "bowel_movements"
    ]
    optional_fields: List[str] = ["past_history", "medications"]

class AyushDashavidhaOntology(ChiefComplaintOntology):
    complaint_name: str = "ayush_general"
    required_fields: List[str] = [
        "prakriti", # body constitution
        "vikriti",  # disease susceptibility
        "sara",     # quality of tissues
        "samhanana",# body build
        "pramana",  # body proportions
        "satmya",   # adaptability
        "sattva",   # mental strength
        "ahara_shakti", # digestive power
        "vyayama_shakti",# exercise capacity
        "vaya"      # age factor
    ]
    optional_fields: List[str] = ["chief_complaint", "duration"]

# Registry of ontologies
ONTOLOGY_REGISTRY: Dict[str, ChiefComplaintOntology] = {
    "chest_pain": ChestPainOntology(),
    "abdominal_pain": AbdominalPainOntology(),
    "ayush_general": AyushDashavidhaOntology()
}

def get_ontology(complaint_name: str, consultation_type: str = "allopathic") -> ChiefComplaintOntology:
    # Normalize
    normalized = complaint_name.lower().replace(" ", "_")
    base_ontology = ONTOLOGY_REGISTRY.get(normalized, ChiefComplaintOntology(
        complaint_name="generic",
        required_fields=[
            "duration",
            "location",
            "character",
            "severity",
            "aggravating_factors",
            "relieving_factors",
            "associated_symptoms"
        ],
        optional_fields=["past_history", "medications"]
    ))

    if consultation_type == "ayush":
        ayush_fields = ONTOLOGY_REGISTRY.get("ayush_general").required_fields
        # Return a combined ontology so Dashavidha Pariksha is asked at the end
        return ChiefComplaintOntology(
            complaint_name=f"{base_ontology.complaint_name}_ayush",
            required_fields=base_ontology.required_fields + ayush_fields,
            optional_fields=base_ontology.optional_fields
        )

    return base_ontology

# Schemas for extraction
class ExtractedEntity(BaseModel):
    field: str = Field(description="The field name from the ontology (e.g., 'duration', 'character', 'prakriti')")
    value: str = Field(description="The extracted value (e.g., '3 days', 'sharp')")
    confidence: str = Field(description="High, Medium, or Low")

class ExtractionResult(BaseModel):
    entities: List[ExtractedEntity]
