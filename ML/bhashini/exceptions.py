"""
Custom exception hierarchy for Bhashini STT and TTS services.

All exceptions provide clear, developer-friendly error messages
while strictly guaranteeing that API keys and sensitive tokens
are never exposed in messages or logs.
"""

from typing import Optional


class BhashiniError(Exception):
    """Base exception for all Bhashini-related errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BhashiniConfigError(BhashiniError):
    """Raised when Bhashini configuration is missing or invalid."""
    def __init__(self, message: str = "Bhashini service configuration is invalid or missing.", status_code: int = 500):
        super().__init__(message, status_code=status_code)


class MissingApiKeyError(BhashiniConfigError):
    """Raised when the Bhashini API key (e.g. BHASHINI_INFERENCE_API_KEY) is missing."""
    def __init__(self, message: str = "Bhashini inference API key is missing. Please set BHASHINI_INFERENCE_API_KEY in the environment or .env file."):
        super().__init__(message, status_code=500)


class MissingServiceIdError(BhashiniConfigError):
    """Raised when the service ID for the requested task/language is missing."""
    def __init__(self, message: str = "Bhashini service ID is not configured for the requested language/task."):
        super().__init__(message, status_code=500)


class InvalidLanguageError(BhashiniError):
    """Raised when an unsupported or invalid language code is requested."""
    def __init__(self, message: str = "Unsupported language requested for Bhashini service."):
        super().__init__(message, status_code=400)


class UnsupportedAudioFormatError(BhashiniError):
    """Raised when an unsupported audio format is provided for STT."""
    def __init__(self, message: str = "Unsupported audio format for Bhashini STT."):
        super().__init__(message, status_code=400)


class InvalidAudioDataError(BhashiniError):
    """Raised when audio payload is empty or invalid."""
    def __init__(self, message: str = "Audio data is empty or invalid."):
        super().__init__(message, status_code=400)


class BhashiniHttpError(BhashiniError):
    """Base exception for HTTP communication errors with Bhashini API."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message, status_code=status_code)


class BhashiniAuthenticationError(BhashiniHttpError):
    """Raised when Bhashini API rejects authentication (401 or 403)."""
    def __init__(self, message: str = "Bhashini API authentication failed. Verify BHASHINI_INFERENCE_API_KEY."):
        super().__init__(message, status_code=401)


class BhashiniRateLimitError(BhashiniHttpError):
    """Raised when Bhashini rate limit is exceeded (429)."""
    def __init__(self, message: str = "Bhashini API rate limit exceeded. Please retry later."):
        super().__init__(message, status_code=429)


class BhashiniTimeoutError(BhashiniHttpError):
    """Raised when request to Bhashini API times out."""
    def __init__(self, message: str = "Bhashini API request timed out."):
        super().__init__(message, status_code=504)


class BhashiniNetworkError(BhashiniHttpError):
    """Raised on connection failure, DNS resolution failure, etc."""
    def __init__(self, message: str = "Failed to connect to Bhashini API endpoint."):
        super().__init__(message, status_code=502)


class BhashiniApiError(BhashiniHttpError):
    """Raised when Bhashini API returns a 4xx/5xx error or error status in payload."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message, status_code=status_code)


class BhashiniResponseError(BhashiniError):
    """Raised when Bhashini API response structure is missing expected fields or malformed."""
    def __init__(self, message: str = "Bhashini response is malformed or missing expected fields.", status_code: int = 502):
        super().__init__(message, status_code=status_code)
