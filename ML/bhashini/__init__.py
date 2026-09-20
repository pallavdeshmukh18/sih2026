"""
Bhashini client and service module for MediKiosk.
Provides standalone Speech-to-Text (ASR) and Text-to-Speech (TTS) integration.
"""

from .client import BhashiniClient
from .config import (
    get_bhashini_udyat_api_key,
    get_bhashini_inference_api_key,
    get_bhashini_inference_url,
    get_bhashini_asr_service_id,
    get_bhashini_tts_service_id,
    SUPPORTED_LANGUAGES,
)
from .exceptions import (
    BhashiniError,
    BhashiniConfigError,
    MissingApiKeyError,
    MissingServiceIdError,
    InvalidLanguageError,
    UnsupportedAudioFormatError,
    InvalidAudioDataError,
    BhashiniHttpError,
    BhashiniAuthenticationError,
    BhashiniRateLimitError,
    BhashiniTimeoutError,
    BhashiniNetworkError,
    BhashiniApiError,
    BhashiniResponseError,
)

__all__ = [
    "BhashiniClient",
    "get_bhashini_udyat_api_key",
    "get_bhashini_inference_api_key",
    "get_bhashini_inference_url",
    "get_bhashini_asr_service_id",
    "get_bhashini_tts_service_id",
    "SUPPORTED_LANGUAGES",
    "BhashiniError",
    "BhashiniConfigError",
    "MissingApiKeyError",
    "MissingServiceIdError",
    "InvalidLanguageError",
    "UnsupportedAudioFormatError",
    "InvalidAudioDataError",
    "BhashiniHttpError",
    "BhashiniAuthenticationError",
    "BhashiniRateLimitError",
    "BhashiniTimeoutError",
    "BhashiniNetworkError",
    "BhashiniApiError",
    "BhashiniResponseError",
]
