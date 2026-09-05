from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import os
from embeddings.embed_store import store_document
from ocr.preprocess import preprocess_image
from ocr.ocr_engine import run_ocr
from ocr.entity_extraction import extract_entities
from embeddings.retrieve import semantic_search

app = FastAPI(
    title="MediKiosk - Document Intelligence & Red Flag Service"
)


API_KEY = os.environ.get("GEMINI_API_KEY")


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "MediKiosk Document Intelligence"
    }


@app.post("/documents/process")
async def process_document(
    patient_id: str = Form(...),
    document_id: str = Form(...),
    file: UploadFile = File(...)
):
    raw_bytes = await file.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    try:
        text = run_ocr(
            raw_bytes,
            API_KEY
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR failed: {str(e)}"
        )

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted."
        )


    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured."
        )

    try:
        extracted = extract_entities(
            text,
            API_KEY
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Entity extraction failed: {str(e)}"
        )


    try:
        storage_result = store_document(
            patient_id=patient_id,
            document_id=document_id,
            extracted_doc=extracted,
            raw_text=text
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding/storage failed: {str(e)}"
        )

    return {
        "patient_id": patient_id,
        "document_id": document_id,
        "filename": file.filename,

        "ocr_text": text,

        "extracted": extracted.model_dump(),

        "embedding_storage": storage_result
    }

@app.post("/documents/search")
async def search_documents(
    patient_id: str = Form(...),
    query: str = Form(...),
    top_k: int = Form(5)
):

    if not query.strip():
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty."
        )

    try:
        results = semantic_search(
            patient_id=patient_id,
            query=query,
            top_k=top_k
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {str(e)}"
        )

    return {
        "patient_id": patient_id,
        "query": query,
        "results": results
    }