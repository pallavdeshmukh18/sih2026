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
    mock_generate_next.return_value = ("How long has it been?", [])
    
    updated_session, next_q, options = process_patient_response(session, "It started 2 days ago")
    
    # Assert answered fields updated
    assert "onset" in updated_session.answered_fields
    assert updated_session.answered_fields["onset"] == "2 days ago"
    
    # Assert history updated
    assert len(updated_session.conversation_history) == 2
    assert updated_session.conversation_history[-1]["role"] == "system"

# ==========================================
# HYBRID RESPONSE VALIDATION TEST SUITE
# ==========================================
from clinical.validator import (
    ClinicalValidator,
    DECISION_VALID_ANSWER,
    DECISION_CLARIFY,
    DECISION_UNSURE,
    DECISION_INVALID,
    DECISION_OUT_OF_RANGE,
    DECISION_IRRELEVANT,
    ValidationResult
)

def test_deterministic_empty_rejected():
    res1 = ClinicalValidator.validate_deterministic("", "onset", [])
    assert res1 is not None and res1.decision == DECISION_INVALID
    res2 = ClinicalValidator.validate_deterministic("    ", "onset", [])
    assert res2 is not None and res2.decision == DECISION_INVALID

def test_deterministic_punctuation_noise_rejected():
    for noise in ["???", "....", "😂😂😂", "---!!"]:
        res = ClinicalValidator.validate_deterministic(noise, "onset", [])
        assert res is not None and res.decision == DECISION_INVALID

def test_deterministic_obvious_gibberish_rejected():
    res = ClinicalValidator.validate_deterministic("asdfghjk", "onset", [])
    assert res is not None and res.decision == DECISION_INVALID

def test_deterministic_repeated_character_spam_rejected():
    res = ClinicalValidator.validate_deterministic("aaaaaaa", "onset", [])
    assert res is not None and res.decision == DECISION_INVALID

def test_deterministic_no_accepted():
    res = ClinicalValidator.validate_deterministic("no", "radiation", [])
    assert res is not None
    assert res.decision == DECISION_VALID_ANSWER
    assert res.normalized_value == "No"

def test_deterministic_yes_accepted():
    res = ClinicalValidator.validate_deterministic("yes", "radiation", [])
    assert res is not None
    assert res.decision == DECISION_VALID_ANSWER
    assert res.normalized_value == "Yes"

def test_deterministic_short_clinical_token_accepted():
    assert not ClinicalValidator.is_obvious_noise("BP")
    assert not ClinicalValidator.is_obvious_noise("fever")
    assert not ClinicalValidator.is_obvious_noise("cough")

def test_deterministic_quick_option_index_accepted():
    options = [
        {"id": "sev_mild", "label": "Mild"},
        {"id": "sev_mod", "label": "Moderate"},
        {"id": "sev_severe", "label": "Severe"}
    ]
    res = ClinicalValidator.validate_deterministic("1", "severity", options)
    assert res is not None
    assert res.decision == DECISION_VALID_ANSWER
    assert res.normalized_value == "Mild"
    assert res.is_deterministic is True

def test_deterministic_quick_option_not_accepted_without_options():
    res = ClinicalValidator.validate_deterministic("1", "onset", [])
    assert res is None or res.decision != DECISION_VALID_ANSWER or "Matched option" not in (res.reason or "")

def test_deterministic_out_of_range_severity_rejected():
    res1 = ClinicalValidator.validate_deterministic("1000", "severity", [])
    assert res1 is not None and res1.decision == DECISION_OUT_OF_RANGE
    res2 = ClinicalValidator.validate_deterministic("-5", "severity", [])
    assert res2 is not None and res2.decision == DECISION_OUT_OF_RANGE

def test_deterministic_valid_severity_boundary_accepted():
    res = ClinicalValidator.validate_deterministic("8", "severity", [])
    assert res is not None
    assert res.decision == DECISION_VALID_ANSWER
    assert res.normalized_value == "8"

def test_deterministic_valid_duration_accepted():
    res = ClinicalValidator.validate_deterministic("2 days", "duration", [])
    assert res is not None
    assert res.decision == DECISION_VALID_ANSWER
    assert res.normalized_value == "2 days"

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_semantic_valid_natural_language_answer(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["onset", "duration"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_VALID_ANSWER,
        normalized_value="Started while jogging",
        extracted_entities=[{"field": "onset", "value": "Started while jogging", "confidence": "High"}],
        is_deterministic=False
    )
    updated, next_q, _ = process_patient_response(session, "It began suddenly while I was jogging in the park")
    assert "onset" not in updated.missing_fields
    assert updated.answered_fields["onset"] == "Started while jogging"

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_semantic_clarification_request_detected(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["radiation", "severity"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_CLARIFY,
        feedback_message="By radiation, we mean whether the pain travels to your arm or jaw.",
        is_deterministic=False
    )
    updated, next_q, _ = process_patient_response(session, "What does radiation mean?")
    assert "radiation" in updated.missing_fields
    assert "By radiation" in next_q

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_semantic_clarification_does_not_consume_field(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["radiation", "severity"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_CLARIFY,
        feedback_message="Radiation means if pain moves anywhere.",
        is_deterministic=False
    )
    updated, _, _ = process_patient_response(session, "What does radiation mean?")
    assert updated.get_highest_priority_missing_field() == "radiation"
    assert "radiation" not in updated.answered_fields

def test_semantic_unsure_detected():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["onset", "duration"]
    )
    updated, _, _ = process_patient_response(session, "I don't know")
    assert "onset" not in updated.missing_fields
    assert updated.answered_fields["onset"] == "Uncertain / Patient unsure"

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_semantic_irrelevant_answer_detected(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["onset", "duration"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_IRRELEVANT,
        feedback_message="Please stay focused on your health symptoms.",
        is_deterministic=False
    )
    updated, reprompt, _ = process_patient_response(session, "Who won the cricket match?")
    assert "onset" in updated.missing_fields
    assert "Please stay focused" in reprompt

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_semantic_ambiguous_handled_safely(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["onset", "duration"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_INVALID,
        feedback_message="Could you please clarify your answer?",
        is_deterministic=False
    )
    updated, reprompt, _ = process_patient_response(session, "maybe sort of like that")
    assert "onset" in updated.missing_fields

def test_multilingual_clarification_detected():
    res = ClinicalValidator.validate_semantic_with_groq("मतलब क्या है?", "radiation", "क्या दर्द फैलता है?", ["radiation"], "hi", groq_client=None)
    assert res.decision == DECISION_CLARIFY

def test_multilingual_unsure_detected():
    res_hi = ClinicalValidator.validate_deterministic("पता नहीं", "onset", [])
    assert res_hi is not None and res_hi.decision == DECISION_UNSURE
    res_mr = ClinicalValidator.validate_deterministic("माहित नाही", "onset", [])
    assert res_mr is not None and res_mr.decision == DECISION_UNSURE

def test_invalid_response_does_not_remove_target_field():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset", "duration"]
    )
    updated, _, _ = process_patient_response(session, "asdfghjk")
    assert "onset" in updated.missing_fields
    assert "onset" not in updated.answered_fields

def test_retry_count_increments_correctly():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset", "duration"]
    )
    assert session.get_retry_count("onset") == 0
    process_patient_response(session, "asdfghjk")
    assert session.get_retry_count("onset") == 1

def test_max_retries_eventually_marks_unreported():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset", "duration"]
    )
    # Attempt 1 (invalid)
    process_patient_response(session, "asdfghjk")
    assert "onset" in session.missing_fields
    # Attempt 2 (invalid - max retries reached, marks unreported and advances)
    process_patient_response(session, "asdfghjk")
    assert "onset" not in session.missing_fields
    assert session.answered_fields["onset"] == "Unreported / Patient unable to provide"
    assert session.get_highest_priority_missing_field() == "duration"

def test_no_infinite_retry_loop():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset", "duration"]
    )
    for _ in range(10):
        process_patient_response(session, "asdfghjk")
    assert session.status == "completed"
    assert len(session.missing_fields) == 0

def test_conversation_history_remains_correct():
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="generic",
        missing_fields=["onset"]
    )
    process_patient_response(session, "asdfghjk")
    assert len(session.conversation_history) == 2
    assert session.conversation_history[0]["role"] == "patient"
    assert session.conversation_history[1]["role"] == "system"

@patch('clinical.engine.ClinicalValidator.validate_semantic_with_groq')
def test_red_flag_preserved_even_on_clarification(mock_semantic):
    session = ClinicalSession(
        patient_id="123",
        chief_complaint="chest_pain",
        missing_fields=["duration", "severity"]
    )
    mock_semantic.return_value = ValidationResult(
        decision=DECISION_CLARIFY,
        feedback_message="Duration means how long.",
        is_deterministic=False
    )
    updated, _, _ = process_patient_response(session, "I have severe chest pain shortness of breath and sweating what does duration mean?")
    assert len(updated.red_flags) > 0
    assert "cardiac" in updated.red_flags[0].lower()

