import os
from pathlib import Path
from typing import Optional, Set
from dotenv import dotenv_values, load_dotenv

# Search for possible .env locations:
# 1. ML/.env
# 2. chatbot/.env
# 3. Workspace root .env
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

# Supported variable names in order of preference
_KEY_NAMES = [
    "SARVAM_API_KEY",
    "sarvam_api_key",
    "sarvam",
    "SARVAM",
    "Sarvam",
]

# Known placeholder substrings that indicate an unconfigured key
_PLACEHOLDER_SUBSTRINGS = [
    "your_sarvam_api_key",
    "your_api_key",
    "your_key",
    "placeholder",
]


def _is_placeholder(value: str) -> bool:
    """Returns True if the value appears to be an unedited template/placeholder."""
    v_lower = value.lower().strip()
    return any(p in v_lower for p in _PLACEHOLDER_SUBSTRINGS)


def load_environment_variables() -> None:
    """Load variables from existing .env candidate files into os.environ."""
    for env_path in _ENV_CANDIDATE_PATHS:
        if env_path.is_file():
            load_dotenv(dotenv_path=env_path, override=True)


# Initial load at import time
load_environment_variables()


def get_sarvam_api_key() -> Optional[str]:
    """
    Retrieve Sarvam API key with support for SARVAM_API_KEY, sarvam, and case variations.
    Dynamically re-checks candidate .env files if no valid key is found in os.environ.
    Rejects dummy placeholder strings like 'your_sarvam_api_key_here'.
    """
    # 1. Check current os.environ
    for name in _KEY_NAMES:
        val = os.getenv(name)
        if val:
            cleaned = val.strip().strip("'\"")
            if cleaned and not _is_placeholder(cleaned):
                return cleaned

    # 2. If not found in os.environ or was placeholder, re-read candidate .env files directly
    for env_path in _ENV_CANDIDATE_PATHS:
        if env_path.is_file():
            env_dict = dotenv_values(env_path)
            for name in _KEY_NAMES:
                val = env_dict.get(name)
                if val:
                    cleaned = val.strip().strip("'\"")
                    if cleaned and not _is_placeholder(cleaned):
                        os.environ["SARVAM_API_KEY"] = cleaned
                        return cleaned

    return None


def get_sarvam_stt_model() -> str:
    """
    Retrieve the configured Sarvam STT model.
    Defaults to 'saaras:v4'.
    """
    # Re-read from os.environ or .env
    model = os.getenv("SARVAM_STT_MODEL")
    if not model:
        for env_path in _ENV_CANDIDATE_PATHS:
            if env_path.is_file():
                val = dotenv_values(env_path).get("SARVAM_STT_MODEL")
                if val:
                    model = val
                    break
    return (model or "saaras:v4").strip().strip("'\"")


# Supported audio extensions for Sarvam STT REST API
SUPPORTED_AUDIO_EXTENSIONS: Set[str] = {
    ".wav",
    ".mp3",
    ".m4a",
    ".webm",
    ".ogg",
    ".flac",
}

# Maximum file size for synchronous audio upload (25 MB)
MAX_AUDIO_FILE_SIZE_BYTES: int = 25 * 1024 * 1024

# Recommended maximum duration in seconds for synchronous REST STT
MAX_AUDIO_DURATION_SECONDS: int = 30
