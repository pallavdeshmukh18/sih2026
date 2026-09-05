import base64
import requests
import os

os.environ["FLAGS_enable_pir_api"] = "0"
from ocr.preprocess import preprocess_image
from config import (
    GEMINI_URL,
    GEMINI_TIMEOUT_SECONDS,
    ENABLE_OCR_FALLBACK,
)


def ocr_with_gemini(image_bytes: bytes, api_key: str) -> str:
    """Primary OCR using Gemini on the original image."""

    b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {
                    "text": (
                        "Transcribe ALL visible text in this medical document image "
                        "exactly as written, including handwritten text. "
                        "Preserve line breaks. "
                        "The document may contain English, Hindi, or mixed "
                        "English-Hindi text. "
                        "Output ONLY the raw transcribed text."
                    )
                },
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": b64
                    }
                }
            ]
        }]
    }

    response = requests.post(
        f"{GEMINI_URL}?key={api_key}",
        json=payload,
        timeout=GEMINI_TIMEOUT_SECONDS
    )

    if not response.ok:
        print("Gemini status code:", response.status_code)
        print("Gemini response:", response.text)

    response.raise_for_status()

    return (
        response.json()["candidates"][0]["content"]["parts"][0]["text"]
        .strip()
    )


def ocr_with_paddleocr(image_bytes: bytes) -> str:
    """Offline OCR fallback using PaddleOCR."""

    import tempfile
    import os
    import json
    from paddleocr import PaddleOCR

    with tempfile.NamedTemporaryFile(
        suffix=".png",
        delete=False
    ) as temp:
        temp.write(image_bytes)
        image_path = temp.name

    try:
        print("Initializing PaddleOCR...")

        ocr = PaddleOCR(
            lang="hi",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False
        )

        print("Running PaddleOCR inference...")

        result = ocr.predict(image_path)

        texts = []

        for res in result:

            if hasattr(res, "json"):
                data = res.json

                if isinstance(data, str):
                    data = json.loads(data)

                if isinstance(data, dict):

                    result_data = data.get("res", data)

                    rec_texts = result_data.get(
                        "rec_texts",
                        []
                    )

                    texts.extend(rec_texts)

        return "\n".join(texts).strip()

    finally:

        if os.path.exists(image_path):
            os.remove(image_path)


def run_ocr(
    image_bytes: bytes,
    api_key: str | None
) -> str:

    # -------------------------------------------------
    # 1. PRIMARY: Gemini OCR
    # -------------------------------------------------

    if api_key:

        try:
            text = ocr_with_gemini(
                image_bytes,
                api_key
            )

            if text.strip():
                print("OCR successful using Gemini.")
                return text

        except Exception as e:

            print(
                f"Gemini OCR failed: {e}"
            )

    # -------------------------------------------------
    # 2. FALLBACK: PaddleOCR
    # -------------------------------------------------

    if ENABLE_OCR_FALLBACK:

        try:

            print(
                "Trying PaddleOCR fallback..."
            )

            # Preprocess ONLY for PaddleOCR
            processed_image = preprocess_image(
                image_bytes
            )

            text = ocr_with_paddleocr(
                processed_image
            )

            if text.strip():

                print(
                    "OCR successful using PaddleOCR."
                )

                return text

        except Exception as e:

            print(
                f"PaddleOCR failed: {e}"
            )

    raise RuntimeError(
        "Both Gemini OCR and PaddleOCR failed."
    )