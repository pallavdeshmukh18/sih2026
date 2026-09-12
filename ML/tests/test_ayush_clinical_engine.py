import pytest
from clinical.state import ClinicalSession, CLINICAL_FLOW_GRAPH, DEFAULT_FIELD_PRIORITY
from clinical.ontology import get_ontology
from clinical.engine import process_patient_response, generate_next_question

def test_ayush_ontology_merged():
    """Test that AYUSH fields are properly merged when consultation_type is 'ayush'"""
    ontology = get_ontology("Fever", "ayush")
    assert "prakriti" in ontology.required_fields
    assert "vikriti" in ontology.required_fields
    assert "vaya" in ontology.required_fields
    
    # Check that standard fields are also present
    assert "onset" in ontology.required_fields
    assert "duration" in ontology.required_fields

def test_allopathic_ontology():
    """Test that AYUSH fields are NOT merged when consultation_type is 'allopathic'"""
    ontology = get_ontology("Fever", "allopathic")
    assert "prakriti" not in ontology.required_fields
    assert "vikriti" not in ontology.required_fields
    assert "vaya" not in ontology.required_fields
    assert "onset" in ontology.required_fields

def test_ayush_session_initialization():
    """Test that an AYUSH session initializes with correct missing fields"""
    ontology = get_ontology("Fever", "ayush")
    session = ClinicalSession(
        patient_id="test_patient",
        language="en",
        consultation_type="ayush",
        chief_complaint="Fever",
        missing_fields=ontology.required_fields.copy()
    )
    
    assert "prakriti" in session.missing_fields
    assert "duration" in session.missing_fields
    assert "onset" in session.missing_fields
