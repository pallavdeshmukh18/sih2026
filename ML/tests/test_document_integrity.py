"""Document outages must not fabricate findings or cross patient boundaries."""
import importlib
import sys
import types
from unittest.mock import Mock
import pytest

from ocr.entity_extraction import extract_entities_fallback


@pytest.mark.parametrize('text', ['', 'skin', 'paracetamol', 'respiratory report', 'hemoglobin'])
def test_unavailable_extraction_preserves_only_the_original(text):
    result = extract_entities_fallback(text)
    assert result.raw_text == text
    assert result.document_date is None
    assert result.diagnoses == []
    assert result.medications == []
    assert result.lab_results == []
    assert result.procedures == []
    assert result.summary is None


def test_document_retrieval_always_filters_by_patient(monkeypatch):
    store = types.ModuleType('embeddings.embed_store')
    store._model = Mock()
    store._model.encode.return_value.tolist.return_value = [[0.0]]
    store._collection = Mock()
    store._collection.query.return_value = {'documents': [[]], 'metadatas': [[]], 'distances': [[]]}
    monkeypatch.setitem(sys.modules, 'embeddings.embed_store', store)
    seed = types.ModuleType('embeddings.knowledge_seed')
    seed._knowledge_collection = None
    monkeypatch.setitem(sys.modules, 'embeddings.knowledge_seed', seed)
    monkeypatch.delitem(sys.modules, 'embeddings.retrieve', raising=False)
    retrieval = importlib.import_module('embeddings.retrieve')
    retrieval.semantic_search('patient-a', 'question', document_id='document-b')
    assert store._collection.query.call_args.kwargs['where'] == {
        '$and': [{'patient_id': 'patient-a'}, {'document_id': 'document-b'}]
    }
