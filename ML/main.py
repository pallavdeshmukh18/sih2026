import logging
import os
import sys
from pathlib import Path

# Ensure ML directory is on sys.path so modules can be imported
# regardless of execution root
_ml_dir = Path(__file__).resolve().parent

if str(_ml_dir) not in sys.path:
    sys.path.insert(0, str(_ml_dir))


from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware


from stt.router import router as stt_router
from tts.router import router as tts_router
from stt.schemas import HealthResponse

# Clinical AI
from clinical.router import router as clinical_router

# Document Intelligence & OCR services
try:
    from ocr.ocr_engine import run_ocr
    from ocr.entity_extraction import extract_entities

except ImportError:
    run_ocr = None
    extract_entities = None


try:
    from embeddings.embed_store import store_document
    from embeddings.retrieve import semantic_search

except ImportError:
    store_document = None
    semantic_search = None



logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ],
)

logger = logging.getLogger("medikiosk.ml")


app = FastAPI(
    title="MediKiosk ML, Voice & Document Intelligence Service",
    description=(
        "Speech-to-Text, Text-to-Speech, "
        "Document Intelligence, OCR, "
        "and Semantic Retrieval services for MediKiosk."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

@app.get("/")
def root_health():
    return {
        "status": "ok",
        "service": "MediKiosk ML, Voice & Document Intelligence"
    }

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
    description=(
        "Returns service operational status "
        "without calling external dependencies."
    ),
)
async def health_check():

    return HealthResponse(
        status="ok"
    )


app.include_router(stt_router)
app.include_router(tts_router)

# Include Clinical AI router
app.include_router(clinical_router)



@app.post(
    "/documents/process",
    tags=["Document Intelligence"]
)
async def process_document(
    patient_id: str = Form(...),
    document_id: str = Form(...),
    file: UploadFile = File(...)
):


    if run_ocr is None or extract_entities is None:
        raise HTTPException(
            status_code=503,
            detail="OCR dependencies are not available."
        )

    if store_document is None:
        raise HTTPException(
            status_code=503,
            detail="Embedding dependencies are not available."
        )


    raw_bytes = await file.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    try:

        text = run_ocr(
            raw_bytes,
            GROQ_API_KEY
        )

    except Exception as e:

        logger.exception("OCR failed")

        raise HTTPException(
            status_code=500,
            detail=f"OCR failed: {str(e)}"
        )

    if not text.strip():

        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the document."
        )

    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GROQ_API_KEY is not configured. "
                "Entity extraction requires Groq."
            )
        )


    try:

        extracted = extract_entities(
            text,
            GROQ_API_KEY
        )

    except Exception as e:

        logger.exception("Entity extraction failed")

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

        logger.exception("Embedding/storage failed")

        raise HTTPException(
            status_code=500,
            detail=f"Embedding/storage failed: {str(e)}"
        )


    return {

        "patient_id": patient_id,

        "document_id": document_id,

        "filename": file.filename,

        "content_type": file.content_type,

        "ocr_text": text,

        "extracted": extracted.model_dump(),

        "embedding_storage": storage_result
    }


@app.post(
    "/documents/search",
    tags=["Document Intelligence"]
)
async def search_documents(

    patient_id: str = Form(...),

    query: str = Form(...),

    top_k: int = Form(5)

):

    if semantic_search is None:

        raise HTTPException(
            status_code=503,
            detail="Semantic search dependencies are not available."
        )


    if not query.strip():

        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty."
        )


    if top_k <= 0:

        raise HTTPException(
            status_code=400,
            detail="top_k must be greater than 0."
        )

    try:

        results = semantic_search(

            patient_id=patient_id,

            query=query,

            top_k=top_k

        )

    except Exception as e:

        logger.exception("Semantic search failed")

        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {str(e)}"
        )


    return {

        "patient_id": patient_id,

        "query": query,

        "results": results
    }


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )