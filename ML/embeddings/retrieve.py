import re
from typing import List, Dict, Any
from embeddings.embed_store import _stored_docs
from embeddings.knowledge_seed import CLINICAL_KNOWLEDGE_BASE


def _score_text(query: str, target_text: str, keywords: List[str] = None) -> float:
    q_words = set(re.findall(r"\w+", query.lower()))
    target_words = set(re.findall(r"\w+", target_text.lower()))
    if not q_words:
        return 0.0

    # Token overlap score
    overlap = len(q_words.intersection(target_words)) / len(q_words)
    score = overlap

    # Boost explicit keyword matches
    if keywords:
        q_lower = query.lower()
        for kw in keywords:
            if kw.lower() in q_lower:
                score += 1.5

    return score


def semantic_search(
    patient_id: str,
    query: str,
    top_k: int = 5,
    document_id: str = None
) -> list[dict]:
    """Searches patient documents using token relevance matching."""
    matches = []
    for doc in _stored_docs:
        meta = doc.get("metadata", {})
        if meta.get("patient_id") != patient_id:
            continue
        if document_id and meta.get("document_id") != document_id:
            continue

        score = _score_text(query, doc["text"])
        matches.append({
            "text": doc["text"],
            "metadata": meta,
            "distance": 1.0 / (score + 1.0),
            "score": score
        })

    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:top_k]


def retrieve_clinical_knowledge(
    query: str,
    top_k: int = 2
) -> list[dict]:
    """Retrieves disease-specific clinical guidelines and questioning protocols."""
    scored = []
    for item in CLINICAL_KNOWLEDGE_BASE:
        doc_text = f"Condition: {item['condition']}\nCategory: {item['category']}\nKeywords: {', '.join(item['keywords'])}\n"
        doc_text += "Disease-Specific Questions:\n" + "\n".join([f"- {q}" for q in item["disease_specific_questions"]]) + "\n"
        doc_text += "Parameter Rephrasing Guidelines:\n"
        for param, phr in item.get("parameter_rephrasing", {}).items():
            doc_text += f"  {param}: {phr}\n"

        score = _score_text(query, doc_text, item.get("keywords", []))
        if score > 0:
            scored.append({
                "text": doc_text,
                "metadata": {
                    "category": item["category"],
                    "condition": item["condition"],
                    "red_flags": ",".join(item.get("red_flag_triggers", []))
                },
                "score": score,
                "distance": 1.0 / (score + 1.0)
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]