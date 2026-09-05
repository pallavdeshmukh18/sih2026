import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass



GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-3.6-flash"
)

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/"
    f"models/{GEMINI_MODEL}:generateContent"
)

GEMINI_TIMEOUT_SECONDS = int(
    os.environ.get("GEMINI_TIMEOUT_SECONDS", "30")
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