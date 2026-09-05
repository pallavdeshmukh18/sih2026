import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass



GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_TEXT_MODEL = os.environ.get(
    "GROQ_TEXT_MODEL",
    "openai/gpt-oss-20b"
)

GROQ_VISION_MODEL = os.environ.get(
    "GROQ_VISION_MODEL",
    "openai/gpt-oss-20b"
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