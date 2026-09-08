import pytest
from embeddings.knowledge_seed import seed_clinical_knowledge_base, CLINICAL_KNOWLEDGE_BASE
from embeddings.retrieve import retrieve_clinical_knowledge
from clinical.state import ClinicalSession
from clinical.ontology import get_ontology
from clinical.engine import process_patient_response
from clinical.rag_engine import generate_rag_question, extract_entities_rag


def test_seed_and_retrieve_clinical_knowledge():
    seed_res = seed_clinical_knowledge_base(force_reseed=True)
    assert seed_res["status"] == "seeded"
    assert seed_res["count"] > 0

    # Query for chest pain
    results = retrieve_clinical_knowledge("chest pain radiating to arm", top_k=2)
    assert len(results) > 0
    assert "chest_pain" in results[0]["text"].lower() or "cardiology" in results[0]["metadata"]["category"].lower()


def test_rag_question_generation():
    ontology = get_ontology("chest_pain", "allopathic")
    session = ClinicalSession(
        session_id="test_rag_001",
        patient_id="P_RAG_999",
        consultation_type="allopathic",
        chief_complaint="chest pain",
        missing_fields=list(ontology.required_fields)
    )

    q = generate_rag_question(session, "radiation")
    assert isinstance(q, str)
    assert len(q) > 5


def test_rag_entity_extraction():
    ontology = get_ontology("abdominal_pain", "allopathic")
    session = ClinicalSession(
        session_id="test_rag_002",
        patient_id="P_RAG_888",
        consultation_type="allopathic",
        chief_complaint="abdominal pain",
        missing_fields=list(ontology.required_fields)
    )

    extracted = extract_entities_rag("The stomach pain started 2 days ago after eating spicy food", session)
    assert hasattr(extracted, "entities")


def test_full_rag_pipeline_execution():
    ontology = get_ontology("chest_pain", "ayush")
    session = ClinicalSession(
        session_id="test_rag_003",
        patient_id="P_RAG_777",
        consultation_type="ayush",
        chief_complaint="chest pain",
        missing_fields=list(ontology.required_fields)
    )

    updated_session, next_q, options = process_patient_response(session, "I have severe chest pain since morning")
    assert updated_session.status in ["active", "completed"]
    assert isinstance(next_q, str)
    assert len(updated_session.conversation_history) >= 2
