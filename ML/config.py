import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    # Resolve from this service directory so `uvicorn ML.main:app` and
    # `cd ML && uvicorn main:app` load the same configuration.
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass



GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_TEXT_MODEL = os.environ.get("GROQ_TEXT_MODEL", "openai/gpt-oss-20b")

GROQ_VISION_MODEL = os.environ.get(
    "GROQ_VISION_MODEL",
    "qwen/qwen3.6-27b"
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
