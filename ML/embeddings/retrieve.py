import re
import sys
import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
from typing import List, Dict, Any
import embeddings.embed_store as embed_store
import embeddings.knowledge_seed as knowledge_seed


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
    """Searches patient documents using token relevance matching or collection query."""
    store_mod = sys.modules.get('embeddings.embed_store', embed_store)
    if hasattr(store_mod, "_collection") and getattr(store_mod, "_collection") is not None:
        where_filter = {'patient_id': patient_id}
        if document_id:
            where_filter = {'$and': [{'patient_id': patient_id}, {'document_id': document_id}]}
        
        query_vector = None
        if hasattr(store_mod, "_model") and getattr(store_mod, "_model") is not None:
            try:
                query_vector = store_mod._model.encode([query]).tolist()
            except Exception:
                pass

        if query_vector is not None:
            res = store_mod._collection.query(
                query_embeddings=query_vector,
                n_results=top_k,
                where=where_filter
            )
        else:
            res = store_mod._collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter
            )
        docs = res.get('documents', [[]])[0] if res else []
        metas = res.get('metadatas', [[]])[0] if res else []
        dists = res.get('distances', [[]])[0] if res else []
        matches = []
        for d, m, dist in zip(docs, metas, dists):
            matches.append({
                "text": d,
                "metadata": m,
                "distance": dist,
                "score": 1.0 / (dist + 0.001) if dist is not None else 1.0
            })
        return matches

    stored = getattr(embed_store, "_stored_docs", [])
    matches = []
    for doc in stored:
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


_chroma_client = None
_ayush_collection = None
_sentence_embedder = None

def _get_rag_resources():
    global _chroma_client, _ayush_collection, _sentence_embedder
    if _sentence_embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _sentence_embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except Exception:
            _sentence_embedder = False

    if _ayush_collection is None:
        try:
            import os
            import chromadb
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            chroma_store_dir = os.path.join(base_dir, "chroma_store")
            if os.path.exists(chroma_store_dir):
                _chroma_client = chromadb.PersistentClient(path=chroma_store_dir)
                _ayush_collection = _chroma_client.get_collection("ayush_clinical_knowledge")
        except Exception:
            _ayush_collection = False

    col = _ayush_collection if _ayush_collection is not False else None
    emb = _sentence_embedder if _sentence_embedder is not False else None
    return col, emb


def retrieve_clinical_knowledge(
    query: str,
    top_k: int = 2
) -> list[dict]:
    """Retrieves disease-specific clinical guidelines and questioning protocols from ChromaDB and Knowledge Base."""
    scored = []

    # 1. Search Persistent ChromaDB Collection ('ayush_clinical_knowledge') if available
    col, embedder = _get_rag_resources()
    if col and embedder:
        try:
            q_vector = embedder.encode([query]).tolist()
            res = col.query(query_embeddings=q_vector, n_results=top_k)

            docs = res.get("documents", [[]])[0] if res else []
            metas = res.get("metadatas", [[]])[0] if res else []
            dists = res.get("distances", [[]])[0] if res else []

            for d, m, dist in zip(docs, metas, dists):
                scored.append({
                    "text": d,
                    "metadata": m,
                    "score": 1.0 / (dist + 0.001) if dist is not None else 1.0,
                    "distance": dist
                })
        except Exception:
            pass

    # 2. Search Static Seed Rules
    kb = getattr(knowledge_seed, "CLINICAL_KNOWLEDGE_BASE", []) or []
    for item in kb:
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