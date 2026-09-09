import logging
from typing import List, Dict, Any

logger = logging.getLogger("medikiosk.embeddings.store")

# In-memory document chunks store
_stored_docs: List[Dict[str, Any]] = []


def chunk_text(
    text: str,
    chunk_size: int = 300,
    overlap: int = 50
) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    step = max(1, chunk_size - overlap)

    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)

    return chunks


def store_document(
    patient_id: str,
    document_id: str,
    extracted_doc,
    raw_text: str
) -> dict:
    chunks = chunk_text(raw_text)

    if not chunks:
        return {
            "document_id": document_id,
            "chunks_stored": 0,
            "status": "empty"
        }

    for i, chunk in enumerate(chunks):
        _stored_docs.append({
            "id": f"{document_id}_{i}",
            "text": chunk,
            "metadata": {
                "patient_id": patient_id,
                "document_id": document_id,
                "document_type": getattr(extracted_doc, "document_type", "prescription"),
                "document_date": getattr(extracted_doc, "document_date", None) or "unknown"
            }
        })

    logger.info(f"Stored document {document_id}: {len(chunks)} chunk(s)")

    return {
        "document_id": document_id,
        "chunks_stored": len(chunks),
        "status": "stored"
    }