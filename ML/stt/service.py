import logging
import time
from typing import Optional, Union, IO
try:
    from sarvamai import SarvamAI
    from sarvamai.errors import (
        UnauthorizedError,
        ForbiddenError,
        TooManyRequestsError,
        BadRequestError,
        UnprocessableEntityError,
        ServiceUnavailableError,
        InternalServerError,
    )
    from sarvamai.core import ApiError
except ImportError:
    SarvamAI = None
    UnauthorizedError = ForbiddenError = TooManyRequestsError = BadRequestError = UnprocessableEntityError = ServiceUnavailableError = InternalServerError = ApiError = Exception

from .config import get_sarvam_api_key, get_sarvam_stt_model
from .schemas import STTSuccessResponse

logger = logging.getLogger("medikiosk.stt")


class STTException(Exception):
    """Base exception for STT service errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class STTConfigurationError(STTException):
    """Raised when STT service configuration (e.g., API key) is missing or invalid."""
    def __init__(self, message: str = "Sarvam API key is not configured. Please set SARVAM_API_KEY in the environment or .env file."):
        super().__init__(message, status_code=500)


class STTAuthenticationError(STTException):
    """Raised when Sarvam authentication fails."""
    def __init__(self, message: str = "Speech service authentication failed"):
        super().__init__(message, status_code=401)


class STTRateLimitError(STTException):
    """Raised when Sarvam rate limits are exceeded."""
    def __init__(self, message: str = "Speech service rate limit exceeded. Please try again later."):
        super().__init__(message, status_code=429)


class STTBadRequestError(STTException):
    """Raised when request payload or parameters are rejected by Sarvam."""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class STTServiceError(STTException):
    """Raised when upstream Sarvam service is unavailable or encounters an internal error."""
    def __init__(self, message: str = "Speech service unavailable. Please try again later."):
        super().__init__(message, status_code=502)


class SarvamSTTService:
    """
    Service layer responsible for interfacing directly with the Sarvam AI STT API.
    Isolates external vendor API calls from HTTP routers and application logic.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self._api_key = api_key
        self._model = model
        self._client: Optional[SarvamAI] = None
        self._last_api_key: Optional[str] = None

    def _get_client(self):
        """Initializes and returns the SarvamAI client if available, or None for REST API fallback."""
        api_key = self._api_key or get_sarvam_api_key()
        if not api_key:
            logger.error("Sarvam API key is missing or contains placeholder in environment/config")
            raise STTConfigurationError(
                message="Sarvam API key is not configured or contains placeholder text. Please set SARVAM_API_KEY in your .env file."
            )

        if SarvamAI is not None:
            if self._client is None or self._last_api_key != api_key:
                self._client = SarvamAI(api_subscription_key=api_key)
                self._last_api_key = api_key
            return self._client

        return None

    def transcribe_audio(
        self,
        file_content: Union[bytes, IO[bytes]],
        filename: str,
        content_type: Optional[str] = None,
        language_code: Optional[str] = None,
    ) -> STTSuccessResponse:
        """
        Send audio to Sarvam AI STT and return the transcription result.

        Args:
            file_content: Raw audio bytes or binary stream.
            filename: Audio file name (used for extension detection).
            content_type: Optional MIME type (e.g. 'audio/wav').
            language_code: Optional BCP-47 language code (e.g. 'hi-IN', 'mr-IN').
                           If omitted or 'unknown', Sarvam auto-detects the language.

        Returns:
            STTSuccessResponse with transcript, language_code, and request_id.
        """
        api_key = self._api_key or get_sarvam_api_key()
        if not api_key:
            raise STTConfigurationError()

        client = self._get_client()
        model_name = self._model or get_sarvam_stt_model()

        # Prepare language_code parameter
        target_lang = language_code.strip() if language_code and language_code.strip() else "unknown"

        logger.info(
            "Sarvam STT request started: filename=%s, content_type=%s, requested_language=%s, model=%s",
            filename,
            content_type or "unknown",
            target_lang,
            model_name,
        )

        start_time = time.perf_counter()

        try:
            if client is not None:
                file_tuple = (filename, file_content, content_type) if content_type else (filename, file_content)
                response = client.speech_to_text.transcribe(
                    file=file_tuple,
                    model=model_name,
                    mode="transcribe",
                    language_code=target_lang,
                )
                detected_lang = getattr(response, "language_code", None) or target_lang
                request_id = getattr(response, "request_id", None)
                lang_prob = getattr(response, "language_probability", None)
                transcript = getattr(response, "transcript", "")
            else:
                import requests
                url = "https://api.sarvam.ai/speech-to-text"
                headers = {"api-subscription-key": api_key}
                mime = content_type or "audio/wav"
                files = {"file": (filename, file_content, mime)}
                data = {"model": model_name}
                if target_lang != "unknown":
                    data["language_code"] = target_lang

                res = requests.post(url, headers=headers, files=files, data=data, timeout=30)
                if res.status_code == 401 or res.status_code == 403:
                    raise STTAuthenticationError()
                if res.status_code == 429:
                    raise STTRateLimitError()
                if res.status_code >= 400:
                    raise STTServiceError(f"Sarvam STT API returned status {res.status_code}: {res.text}")

                res_data = res.json()
                transcript = res_data.get("transcript", "")
                detected_lang = res_data.get("language_code") or target_lang
                request_id = res_data.get("request_id")
                lang_prob = res_data.get("language_probability")

            duration = time.perf_counter() - start_time
            detected_lang = getattr(response, "language_code", None) or target_lang
            request_id = getattr(response, "request_id", None)
            lang_prob = getattr(response, "language_probability", None)

            logger.info(
                "Sarvam STT request completed successfully in %.2fs: request_id=%s, language=%s",
                duration,
                request_id,
                detected_lang,
            )

            return STTSuccessResponse(
                success=True,
                transcript=response.transcript or "",
                language_code=detected_lang if detected_lang != "unknown" else None,
                request_id=request_id,
                language_probability=lang_prob,
            )

        except (UnauthorizedError, ForbiddenError) as exc:
            logger.error("Sarvam authentication failure: %s", exc.__class__.__name__)
            raise STTAuthenticationError() from exc

        except TooManyRequestsError as exc:
            logger.warning("Sarvam rate limit exceeded: %s", exc.__class__.__name__)
            raise STTRateLimitError() from exc

        except (BadRequestError, UnprocessableEntityError) as exc:
            logger.error("Sarvam rejected request payload: %s", exc)
            raise STTBadRequestError(message=f"Invalid audio or parameters: {exc}") from exc

        except (ServiceUnavailableError, InternalServerError) as exc:
            logger.error("Sarvam upstream service error: %s", exc.__class__.__name__)
            raise STTServiceError() from exc

        except ApiError as exc:
            logger.error("Sarvam API error: status_code=%s", getattr(exc, "status_code", None))
            if getattr(exc, "status_code", None) == 401:
                raise STTAuthenticationError() from exc
            if getattr(exc, "status_code", None) == 429:
                raise STTRateLimitError() from exc
            raise STTServiceError() from exc

        except STTException:
            raise

        except Exception as exc:
            logger.exception("Unexpected error during Sarvam STT transcription")
            raise STTServiceError(message="An unexpected error occurred while processing speech.") from exc


# Default singleton instance for easy dependency injection
stt_service = SarvamSTTService()
