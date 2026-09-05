import base64
import requests
import os

os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["GLOG_minloglevel"] = "2"  # Suppress C++ logging
import logging
logging.getLogger("ppocr").setLevel(logging.ERROR)

from ocr.preprocess import preprocess_image
from config import (
    GROQ_VISION_MODEL,
    ENABLE_OCR_FALLBACK,
)
from groq import Groq


def ocr_with_groq(image_bytes: bytes, api_key: str) -> str:
    """Primary OCR using Groq Vision on the original image."""

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    client = Groq(api_key=api_key)

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text", 
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
                        "type": "image_url", 
                        "image_url": {"url": f"data:image/png;base64,{b64}"}
                    },
                ],
            }
        ],
        model=GROQ_VISION_MODEL,
    )

    return chat_completion.choices[0].message.content.strip()


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
    # 1. PRIMARY: Groq OCR
    # -------------------------------------------------

    if api_key and GROQ_VISION_MODEL != "openai/gpt-oss-20b":

        try:
            text = ocr_with_groq(
                image_bytes,
                api_key
            )

            if text.strip():
                print("OCR successful using Groq.")
                return text

        except Exception as e:

            print(
                f"Groq OCR failed: {e}"
            )
    elif GROQ_VISION_MODEL == "openai/gpt-oss-20b":
        pass  # Groq Vision bypassed (mock model does not support images)

    # -------------------------------------------------
    # 2. FALLBACK: PaddleOCR
    # -------------------------------------------------

    if ENABLE_OCR_FALLBACK:

        try:
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
        "Both Groq OCR and PaddleOCR failed."
    )