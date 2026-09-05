from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import os

from ocr.preprocess import preprocess_image
from ocr.ocr_engine import run_ocr
from ocr.entity_extraction import extract_entities


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

    clean_bytes = preprocess_image(raw_bytes)



    try:
        text = run_ocr(
            clean_bytes,
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
            detail="No text could be extracted from the document."
        )


    if not API_KEY:
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
            API_KEY
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