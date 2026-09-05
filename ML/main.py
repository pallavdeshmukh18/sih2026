import logging
import os
import sys
from pathlib import Path

# Ensure ML directory is on sys.path so modules can be imported regardless of execution root
_ml_dir = Path(__file__).resolve().parent
if str(_ml_dir) not in sys.path:
    sys.path.insert(0, str(_ml_dir))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Voice services (STT & TTS)
from stt.router import router as stt_router
from tts.router import router as tts_router
from stt.schemas import HealthResponse

# Document Intelligence & OCR services
try:
    from ocr.preprocess import preprocess_image
    from ocr.ocr_engine import run_ocr
    from ocr.entity_extraction import extract_entities
except ImportError:
    # Graceful fallback if OCR dependencies (e.g. paddleocr) are not yet installed in current env
    preprocess_image = None
    run_ocr = None
    extract_entities = None

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("medikiosk.ml")

# Create FastAPI application
app = FastAPI(
    title="MediKiosk ML, Voice & Document Intelligence Service",
    description="Speech-to-Text, Text-to-Speech, and Document Intelligence intake services for MediKiosk.",
    version="1.0.0",
)

# Allow CORS for development and cross-origin kiosk/frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


# Root health endpoint
@app.get("/")
def root_health():
    return {
        "status": "ok",
        "service": "MediKiosk ML, Voice & Document Intelligence"
    }


# Standard system health check endpoint
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
    description="Returns service operational status without calling external dependencies.",
)
async def health_check():
    return HealthResponse(status="ok")


# Include Voice routers (STT & TTS)
app.include_router(stt_router)
app.include_router(tts_router)


# Document Intelligence endpoint
@app.post("/documents/process", tags=["Document Intelligence"])
async def process_document(
    patient_id: str = Form(...),
    document_id: str = Form(...),
    file: UploadFile = File(...)
):
    if preprocess_image is None or run_ocr is None or extract_entities is None:
        raise HTTPException(
            status_code=503,
            detail="OCR dependencies not installed in current environment."
        )

    raw_bytes = await file.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    clean_bytes = preprocess_image(raw_bytes)

    try:
        text = run_ocr(
            clean_bytes,
            GEMINI_API_KEY
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR failed: {str(e)}"
        )

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the document."
        )

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not configured. "
                "Entity extraction requires Gemini."
            )
        )

    try:
        extracted = extract_entities(
            text,
            GEMINI_API_KEY
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Entity extraction failed: {str(e)}"
        )

    return {
        "patient_id": patient_id,
        "document_id": document_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "ocr_text": text,
        "extracted": extracted.model_dump()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
