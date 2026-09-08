from embeddings.embed_store import _model, _collection


def semantic_search(
    patient_id: str,
    query: str,
    top_k: int = 5,
    document_id: str = None
) -> list[dict]:
    if _model is None or _collection is None:
        return []

    query_embedding = _model.encode(
        [query]
    ).tolist()

    where_filter = {"patient_id": patient_id}
    if document_id:
        where_filter = {"document_id": document_id}

    try:
        results = _collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            where=where_filter
        )
    except Exception as e:
        print(f"ChromaDB retrieval error: {e}")
        return []

    retrieved_results = []

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, metadata, distance in zip(
        documents,
        metadatas,
        distances
    ):
        retrieved_results.append({
            "text": doc,
            "metadata": metadata,
            "distance": distance
        })

    return retrieved_results