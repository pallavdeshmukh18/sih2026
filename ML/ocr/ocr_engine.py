import base64
import re
import requests
import os
import time

os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["GLOG_minloglevel"] = "2"  # Suppress C++ logging
import logging
logging.getLogger("ppocr").setLevel(logging.ERROR)

from ocr.preprocess import preprocess_image
from config import (
    GROQ_VISION_MODEL,
    ENABLE_OCR_FALLBACK,
)

def ocr_with_groq_rest(image_bytes: bytes, api_key: str, time_budget_seconds: int = 45) -> str:
    """Primary Vision OCR using direct Groq REST API with model fallback."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    if image_bytes.startswith(b"\xff\xd8\xff"):
        image_mime = "image/jpeg"
    elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        image_mime = "image/png"
    elif image_bytes[:4] in (b"RIFF",):
        image_mime = "image/webp"
    else:
        # Normalize unknown image encodings before sending them to the vision API.
        image_bytes = preprocess_image(image_bytes)
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_mime = "image/png"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    candidates = [
        GROQ_VISION_MODEL,
        "qwen/qwen3.6-27b",
        "qwen/qwen3.8-27b"
    ]
    seen = set()
    models = [m for m in candidates if m and not (m in seen or seen.add(m))]
    
    last_err = None
    deadline = time.monotonic() + time_budget_seconds
    for model_name in models:
        remaining = deadline - time.monotonic()
        if remaining <= 1:
            break
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Transcribe ALL visible text in this medical document image "
                                "exactly as written, including handwritten text. "
                                "Preserve line breaks and numerical values. "
                                "The document may contain English, Hindi, or mixed "
                                "English-Hindi text. "
                                "Output ONLY the raw transcribed text."
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{image_mime};base64,{b64}"}
                        },
                    ],
                }
            ],
            "temperature": 0.1,
            "max_tokens": 2048,
        }
        
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=min(20, max(1, remaining))
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["choices"][0]["message"]["content"] or ""
                clean_text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
                if clean_text:
                    return clean_text
            else:
                last_err = f"Groq Vision API ({model_name}) returned status {resp.status_code}: {resp.text}"
        except Exception as e:
            last_err = f"Groq Vision error ({model_name}): {e}"
            
    raise RuntimeError(last_err or "Groq Vision API failed for all candidate models.")


def extract_pdf_text_or_render(pdf_bytes: bytes) -> tuple[str, bytes | None]:
    """Extract text from PDF using PyMuPDF fitz, or render first page to PNG if scanned image PDF."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        extracted_text = ""
        for page in doc:
            extracted_text += page.get_text() + "\n"
        
        if extracted_text.strip():
            return extracted_text.strip(), None
            
        # If no text extracted (scanned PDF), render first page to image
        if len(doc) > 0:
            pix = doc[0].get_pixmap(dpi=150)
            png_bytes = pix.tobytes("png")
            return "", png_bytes
    except Exception as e:
        print(f"PyMuPDF processing error: {e}")
        
    return "", None


def ocr_with_paddleocr(image_bytes: bytes) -> str:
    """Offline OCR fallback using PaddleOCR."""
    import tempfile
    import json
    from paddleocr import PaddleOCR

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp:
        temp.write(image_bytes)
        image_path = temp.name

    try:
        ocr = PaddleOCR(
            lang="hi",
            use_doc_orientation_classify=True,
            use_doc_unwarping=True,
            use_textline_orientation=True,
            enable_mkldnn=False
        )

        result = ocr.predict(image_path)
        texts = []

        for res in result:
            if hasattr(res, "json"):
                data = res.json
                if isinstance(data, str):
                    data = json.loads(data)
                if isinstance(data, dict):
                    result_data = data.get("res", data)
                    rec_texts = result_data.get("rec_texts", [])
                    texts.extend(rec_texts)

        return "\n".join(texts).strip()

    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def run_ocr(
    image_bytes: bytes,
    api_key: str | None,
    filename: str = "document.png",
    fast_mode: bool = False,
) -> str:
    fn_lower = (filename or "document").lower()
    target_bytes = image_bytes

    # Handle PDF files
    if fn_lower.endswith(".pdf") or image_bytes.startswith(b"%PDF"):
        pdf_text, png_bytes = extract_pdf_text_or_render(image_bytes)
        if pdf_text.strip():
            print(f"Direct text extraction successful for PDF {filename}.")
            return pdf_text
        if png_bytes:
            target_bytes = png_bytes

    # -------------------------------------------------
    # 1. PRIMARY: Groq Vision OCR via REST API (if configured)
    # -------------------------------------------------
    if api_key and GROQ_VISION_MODEL:
        try:
            text = ocr_with_groq_rest(target_bytes, api_key, time_budget_seconds=40 if fast_mode else 45)
            if text.strip():
                print(f"OCR successful using Groq REST for {filename}.")
                return text
        except Exception as e:
            print(f"Groq Vision REST OCR skipped for {filename}: {e}")

    # -------------------------------------------------
    # 2. LOCAL FALLBACK: PaddleOCR
    # -------------------------------------------------
    if ENABLE_OCR_FALLBACK:
        try:
            processed_image = preprocess_image(target_bytes)
            text = ocr_with_paddleocr(processed_image)
            if text.strip():
                print(f"OCR successful using PaddleOCR for {filename}.")
                return text
        except Exception as e:
            print(f"PaddleOCR failed for {filename}: {e}")

    # -------------------------------------------------
    # 3. No Text Extracted
    # -------------------------------------------------
    return ""
