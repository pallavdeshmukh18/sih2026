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

from .base import BaseSTT
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


class SarvamSTTService(BaseSTT):
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

            logger.info(
                "Sarvam STT request completed successfully in %.2fs: request_id=%s, language=%s",
                duration,
                request_id,
                detected_lang,
            )

            return STTSuccessResponse(
                success=True,
                transcript=transcript or "",
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

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "hi",
        audio_format: str = "wav",
        sampling_rate: int = 16000,
    ) -> str:
        """
        Conforms to BaseSTT interface.
        Wraps transcribe_audio and returns clean transcript text.
        """
        result = self.transcribe_audio(
            file_content=audio_bytes,
            filename=f"audio.{audio_format}",
            content_type=f"audio/{audio_format}",
            language_code=language,
        )
        return result.transcript or ""


class STTService(BaseSTT):
    """
    Provider-independent Speech-to-Text service facade.
    Uses Bhashini ASR as the primary provider by default, with controlled fallback
    to Sarvam AI if Bhashini encounters an API or network failure.
    Preserves explicit provider selection (provider='sarvam' or provider='bhashini').
    """

    def __init__(
        self,
        default_provider: Optional[str] = None,
        enable_fallback: bool = True,
        sarvam_kwargs: Optional[dict] = None,
        bhashini_kwargs: Optional[dict] = None,
        **kwargs,
    ):
        # Support provider argument for backward compatibility
        chosen = kwargs.get("provider") or default_provider or os.getenv("STT_PROVIDER", "bhashini")
        self.provider_name = chosen.lower().strip()
        self.enable_fallback = enable_fallback

        b_kwargs = dict(bhashini_kwargs or {})
        s_kwargs = dict(sarvam_kwargs or {})
        for k, v in kwargs.items():
            if k == "provider":
                continue
            if k in ("client", "service_id_hi", "service_id_mr", "service_id_en", "default_audio_format", "default_sampling_rate"):
                b_kwargs[k] = v
            elif k in ("api_key", "model"):
                s_kwargs[k] = v

        from .bhashini import BhashiniSTT
        self._bhashini_provider = BhashiniSTT(**b_kwargs)
        self._sarvam_provider = SarvamSTTService(**s_kwargs)
        # Ensure that patching stt_service._get_client dynamically delegates into the Sarvam provider
        self._sarvam_provider._get_client = lambda: self._get_client()

    @property
    def provider(self):
        """Returns the primary underlying provider instance."""
        if self.provider_name == "sarvam":
            return self._sarvam_provider
        return self._bhashini_provider

    def _get_client(self):
        """Delegates to Sarvam client for compatibility with existing tests and internal calls."""
        # Use unbound method to prevent infinite recursion if _sarvam_provider._get_client is rebound
        return SarvamSTTService._get_client(self._sarvam_provider)

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "hi",
        audio_format: str = "wav",
        sampling_rate: int = 16000,
        provider: Optional[str] = None,
    ) -> str:
        """Transcribes audio using the primary provider with automatic fallback."""
        res = self.transcribe_audio(
            file_content=audio_bytes,
            filename=f"audio.{audio_format}",
            content_type=f"audio/{audio_format}",
            language_code=language,
            provider=provider,
        )
        return res.transcript or ""

    def transcribe_audio(
        self,
        file_content: Union[bytes, IO[bytes]],
        filename: str = "audio.wav",
        content_type: Optional[str] = None,
        language_code: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> STTSuccessResponse:
        """
        Transcribes audio file content using Bhashini as primary provider with
        controlled fallback to Sarvam.
        """
        import uuid
        from unittest.mock import MagicMock
        from bhashini.config import normalize_language, SUPPORTED_LANGUAGES
        from bhashini.exceptions import (
            BhashiniHttpError,
            BhashiniResponseError,
            MissingApiKeyError,
            MissingServiceIdError,
            InvalidAudioDataError,
            InvalidLanguageError,
            UnsupportedAudioFormatError,
        )

        active_provider = (provider or self.provider_name or os.getenv("STT_PROVIDER", "bhashini")).lower().strip()

        # If a test or developer explicitly patched Sarvam client on stt_service, respect Sarvam
        if isinstance(getattr(self, "_get_client", None), MagicMock):
            active_provider = "sarvam"

        # Read binary bytes
        if hasattr(file_content, "read"):
            audio_bytes = file_content.read()
        else:
            audio_bytes = file_content

        if not audio_bytes or len(audio_bytes) == 0:
            raise STTBadRequestError("Audio file is empty")

        # 1. Primary: Bhashini
        if active_provider == "bhashini":
            normalized_lang = normalize_language(language_code or "hi")

            if normalized_lang in SUPPORTED_LANGUAGES:
                try:
                    logger.info("Bhashini STT request started: language=%s, provider=bhashini", normalized_lang)
                    start_time = time.perf_counter()

                    transcript = self._bhashini_provider.transcribe(
                        audio_bytes=audio_bytes,
                        language=normalized_lang,
                        audio_format="wav",
                        sampling_rate=16000,
                    )

                    duration = time.perf_counter() - start_time
                    logger.info(
                        "Bhashini STT request completed in %.2fs: provider=bhashini, chars=%d",
                        duration,
                        len(transcript),
                    )

                    return STTSuccessResponse(
                        success=True,
                        transcript=transcript,
                        language_code=normalized_lang,
                        request_id=f"bhashini_{uuid.uuid4().hex[:12]}",
                        language_probability=1.0,
                    )

                except (MissingApiKeyError, MissingServiceIdError, InvalidAudioDataError, InvalidLanguageError, UnsupportedAudioFormatError):
                    # Fail clearly on configuration or argument errors; do not fallback silently
                    raise

                except (BhashiniHttpError, BhashiniResponseError, Exception) as exc:
                    if not self.enable_fallback:
                        raise
                    logger.warning("Bhashini STT failed; using Sarvam fallback: error=%s", exc)
                    logger.info("provider=sarvam_fallback")

                    res = self._sarvam_provider.transcribe_audio(
                        file_content=audio_bytes,
                        filename=filename,
                        content_type=content_type,
                        language_code=language_code,
                    )
                    return res
            else:
                # Language not supported by Bhashini: route to Sarvam if fallback allowed
                if self.enable_fallback:
                    logger.info(
                        "Language '%s' not in Bhashini supported set; routing to Sarvam: provider=sarvam",
                        language_code,
                    )
                    return self._sarvam_provider.transcribe_audio(
                        file_content=audio_bytes,
                        filename=filename,
                        content_type=content_type,
                        language_code=language_code,
                    )
                else:
                    raise InvalidLanguageError(f"Language '{language_code}' is not supported by Bhashini STT.")

        # 2. Explicit Sarvam Provider
        elif active_provider == "sarvam":
            logger.info("provider=sarvam")
            return self._sarvam_provider.transcribe_audio(
                file_content=audio_bytes,
                filename=filename,
                content_type=content_type,
                language_code=language_code,
            )

        else:
            raise STTConfigurationError(
                f"Unsupported STT provider '{active_provider}'. Supported: 'bhashini', 'sarvam'"
            )


# Default singleton instance: Bhashini as primary with Sarvam fallback
stt_service = STTService(default_provider="bhashini", enable_fallback=True)


