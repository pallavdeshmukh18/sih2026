from embeddings.embed_store import _model, _collection


def semantic_search(
    patient_id: str,
    query: str,
    top_k: int = 5
) -> list[dict]:


    query_embedding = _model.encode(
        [query]
    ).tolist()


    results = _collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where={
            "patient_id": patient_id
        }
    )

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