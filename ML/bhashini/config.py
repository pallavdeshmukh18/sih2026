"""
Configuration and environment variable loader for Bhashini services.

Provides secure retrieval and validation of Bhashini API keys,
configurable pipeline endpoints, and language-specific service IDs.
"""

import os
from pathlib import Path
from typing import Optional, Set
from dotenv import dotenv_values, load_dotenv

# Search paths for .env files
_current_dir = Path(__file__).resolve().parent
_ml_dir = _current_dir.parent
_workspace_root = _ml_dir.parent

_ENV_CANDIDATE_PATHS = [
    _ml_dir / ".env",
    _workspace_root / "chatbot" / ".env",
    _workspace_root / ".env",
    Path("chatbot/.env"),
    Path(".env"),
]

_PLACEHOLDER_SUBSTRINGS = [
    "your_udyat_key",
    "your_inference_key",
    "your_bhashini",
    "your_api_key",
    "your_key",
    "placeholder",
    "your_asr_service_id",
    "your_tts_service_id",
    "xxx",
]

DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
DEFAULT_ASR_SAMPLING_RATE = 16000
DEFAULT_ASR_AUDIO_FORMAT = "wav"
DEFAULT_TTS_GENDER = "female"

SUPPORTED_LANGUAGES: Set[str] = {"hi", "mr", "en"}
SUPPORTED_AUDIO_FORMATS: Set[str] = {"wav", "flac", "mp3", "ogg", "m4a", "webm"}


def _is_placeholder(value: str) -> bool:
    """Returns True if the value appears to be an unconfigured template string."""
    v_lower = value.lower().strip()
    return any(p in v_lower for p in _PLACEHOLDER_SUBSTRINGS)


def load_environment_variables() -> None:
    """Loads variables from candidate .env files into os.environ if not already set."""
    for env_path in _ENV_CANDIDATE_PATHS:
        if env_path.is_file():
            load_dotenv(dotenv_path=env_path, override=False)


# Auto-load on module import
load_environment_variables()


def _get_var(names: list[str]) -> Optional[str]:
    """Helper to retrieve a clean, non-placeholder variable from environment or candidate .env files."""
    for name in names:
        val = os.getenv(name)
        if val:
            cleaned = val.strip().strip("'\"")
            if cleaned and not _is_placeholder(cleaned):
                return cleaned

    for env_path in _ENV_CANDIDATE_PATHS:
        if env_path.is_file():
            try:
                env_dict = dotenv_values(env_path)
                for name in names:
                    val = env_dict.get(name)
                    if val:
                        cleaned = val.strip().strip("'\"")
                        if cleaned and not _is_placeholder(cleaned):
                            os.environ[name] = cleaned
                            return cleaned
            except Exception:
                pass
    return None


def get_bhashini_udyat_api_key() -> Optional[str]:
    """Retrieve BHASHINI_UDYAT_API_KEY."""
    return _get_var(["BHASHINI_UDYAT_API_KEY", "bhashini_udyat_api_key"])


def get_bhashini_inference_api_key() -> Optional[str]:
    """Retrieve BHASHINI_INFERENCE_API_KEY used for the Authorization header."""
    return _get_var(["BHASHINI_INFERENCE_API_KEY", "bhashini_inference_api_key"])


def get_bhashini_inference_url() -> str:
    """Retrieve configured BHASHINI_INFERENCE_URL or default to standard Dhruva pipeline endpoint."""
    val = _get_var(["BHASHINI_INFERENCE_URL", "bhashini_inference_url"])
    return val or DEFAULT_INFERENCE_URL


def normalize_language(lang_code: Optional[str]) -> str:
    """
    Normalizes input language codes to 2-letter ISO-639 codes ('hi', 'mr', 'en').
    Examples: 'hi-IN' -> 'hi', 'MR-IN' -> 'mr', 'english' -> 'en'.
    """
    if not lang_code:
        return ""
    code = lang_code.strip().lower()
    if code in ("hi", "mr", "en"):
        return code
    if code.startswith("hi"):
        return "hi"
    if code.startswith("mr"):
        return "mr"
    if code.startswith("en"):
        return "en"
    if "hindi" in code:
        return "hi"
    if "marathi" in code:
        return "mr"
    if "english" in code:
        return "en"
    return code


def get_bhashini_asr_service_id(language: str) -> Optional[str]:
    """
    Retrieve configured ASR service ID for a given language.
    Looks for BHASHINI_ASR_SERVICE_ID_{LANG} then falls back to general BHASHINI_ASR_SERVICE_ID.
    """
    normalized = normalize_language(language).upper()
    keys = [f"BHASHINI_ASR_SERVICE_ID_{normalized}"]
    if normalized == "HI":
        keys.extend(["BHASHINI_ASR_SERVICE_ID_HINDI"])
    elif normalized == "MR":
        keys.extend(["BHASHINI_ASR_SERVICE_ID_MARATHI"])
    elif normalized == "EN":
        keys.extend(["BHASHINI_ASR_SERVICE_ID_ENGLISH"])
    keys.append("BHASHINI_ASR_SERVICE_ID")

    return _get_var(keys)


def get_bhashini_tts_service_id(language: str) -> Optional[str]:
    """
    Retrieve configured TTS service ID for a given language.
    Looks for BHASHINI_TTS_SERVICE_ID_{LANG} then falls back to general BHASHINI_TTS_SERVICE_ID.
    """
    normalized = normalize_language(language).upper()
    keys = [f"BHASHINI_TTS_SERVICE_ID_{normalized}"]
    if normalized == "HI":
        keys.extend(["BHASHINI_TTS_SERVICE_ID_HINDI"])
    elif normalized == "MR":
        keys.extend(["BHASHINI_TTS_SERVICE_ID_MARATHI"])
    elif normalized == "EN":
        keys.extend(["BHASHINI_TTS_SERVICE_ID_ENGLISH"])
    keys.append("BHASHINI_TTS_SERVICE_ID")

    return _get_var(keys)

