import pytest
from unittest.mock import patch
from clinical.state import ClinicalSession
from clinical.safety import evaluate_red_flags
from clinical.ontology import ExtractionResult, ExtractedEntity, get_ontology
from clinical.engine import process_patient_response

def test_session_initialization():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain"
    )
    assert session.patient_id == "123"
    assert session.status == "active"
    assert not session.missing_fields # Should be empty initially because we didn't inject ontology
    
def test_evaluate_red_flags():
    # Test cardiac red flag
    entities = [
        {"field": "location", "value": "chest"},
        {"field": "character", "value": "pain"},
        {"field": "associated_symptoms", "value": "sweating and shortness of breath"}
    ]
    flags = evaluate_red_flags(entities)
    assert len(flags) > 0
    assert "cardiac" in flags[0].lower()
    
    # Test safe
    entities = [
        {"field": "location", "value": "leg"},
        {"field": "character", "value": "pain"}
    ]
    flags = evaluate_red_flags(entities)
    assert len(flags) == 0
    
def test_highest_priority_missing_field():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["duration", "severity", "location"]
    )
    
    next_field = session.get_highest_priority_missing_field()
    assert next_field == "duration"
    
    session.missing_fields.remove("duration")
    next_field = session.get_highest_priority_missing_field()
    assert next_field == "severity"

def test_ontology_loading_allopathic():
    ontology = get_ontology("chest_pain", "allopathic")
    assert "onset" in ontology.required_fields
    assert "prakriti" not in ontology.required_fields
    assert ontology.complaint_name == "chest_pain"

def test_ontology_loading_ayush():
    ontology = get_ontology("chest_pain", "ayush")
    assert "onset" in ontology.required_fields
    assert "prakriti" in ontology.required_fields
    assert ontology.complaint_name == "chest_pain_ayush"

@patch('clinical.engine.extract_entities_from_text')
@patch('clinical.engine.generate_next_question')
def test_process_patient_response(mock_generate_next, mock_extract):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset", "duration"]
    )
    
    # Mock the LLM extracting "onset"
    mock_extract.return_value = ExtractionResult(
        entities=[ExtractedEntity(field="onset", value="2 days ago", confidence="High")]
    )
    mock_generate_next.return_value = "How long has it been?"
    
    updated_session = process_patient_response(session, "It started 2 days ago")
    
    # Assert missing fields updated
    assert "onset" not in updated_session.missing_fields
    assert "duration" in updated_session.missing_fields
    
    # Assert answered fields updated
    assert "onset" in updated_session.answered_fields
    assert updated_session.answered_fields["onset"] == "2 days ago"
    
    # Assert history updated
    assert len(updated_session.conversation_history) == 2
    assert updated_session.conversation_history[-1]["role"] == "system"
