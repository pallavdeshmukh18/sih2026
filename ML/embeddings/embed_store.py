try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    _client = chromadb.PersistentClient(path="./chroma_store")
    _collection = _client.get_or_create_collection(name="patient_documents")
except Exception as e:
    _model = None
    _client = None
    _collection = None


def chunk_text(
    text: str,
    chunk_size: int = 300,
    overlap: int = 50
) -> list[str]:

    words = text.split()

    if not words:
        return []

    chunks = []

    step = chunk_size - overlap

    for i in range(0, len(words), step):
        chunk = " ".join(
            words[i:i + chunk_size]
        )

        if chunk.strip():
            chunks.append(chunk)

    return chunks


def store_document(
    patient_id: str,
    document_id: str,
    extracted_doc,
    raw_text: str
):
    if _model is None or _collection is None:
        return {
            "document_id": document_id,
            "chunks_stored": 0,
            "status": "skipped",
            "message": "ChromaDB vector store skipped"
        }

    chunks = chunk_text(raw_text)

    if not chunks:
        return {
            "document_id": document_id,
            "chunks_stored": 0,
            "status": "empty"
        }

    embeddings = _model.encode(
        chunks
    ).tolist()

    ids = [
        f"{document_id}_{i}"
        for i in range(len(chunks))
    ]

    metadatas = [
        {
            "patient_id": patient_id,
            "document_id": document_id,
            "document_type": getattr(extracted_doc, "document_type", "prescription"),
            "document_date": (
                getattr(extracted_doc, "document_date", None)
                or "unknown"
            )
        }
        for _ in chunks
    ]

    _collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas
    )

    print(
        f"Stored document {document_id}: "
        f"{len(chunks)} chunk(s)"
    )

    return {
        "document_id": document_id,
        "chunks_stored": len(chunks)
    }