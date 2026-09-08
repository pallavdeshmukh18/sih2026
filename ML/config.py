import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass



GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

_raw_text_model = os.environ.get("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")
if not _raw_text_model or "gpt-oss" in _raw_text_model or _raw_text_model == "openai/gpt-oss-20b":
    GROQ_TEXT_MODEL = "llama-3.3-70b-versatile"
else:
    GROQ_TEXT_MODEL = _raw_text_model

GROQ_VISION_MODEL = os.environ.get(
    "GROQ_VISION_MODEL",
    "llama-3.2-11b-vision-preview"
)

GROQ_TIMEOUT_SECONDS = int(
    os.environ.get("GROQ_TIMEOUT_SECONDS", "30")
)


ENABLE_OCR_FALLBACK = (
    os.environ.get(
        "ENABLE_OCR_FALLBACK",
        "true"
    ).lower() == "true"
)

PADDLEOCR_LANGUAGE = os.environ.get(
    "PADDLEOCR_LANGUAGE",
    "hi"
)