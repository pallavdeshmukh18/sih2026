import logging
import time
from typing import Optional
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

from .config import (
    get_sarvam_api_key,
    get_sarvam_tts_model,
    DEFAULT_SPEAKER,
    DEFAULT_PACE,
    OUTPUT_AUDIO_CODEC,
    SPEECH_SAMPLE_RATE,
)
from .schemas import TTSSuccessResponse

logger = logging.getLogger("medikiosk.tts")


class TTSException(Exception):
    """Base exception for TTS service errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TTSConfigurationError(TTSException):
    """Raised when Sarvam API key or configuration is missing or invalid."""
    def __init__(self, message: str = "Sarvam API key is not configured or contains placeholder text. Please set SARVAM_API_KEY in your .env file."):
        super().__init__(message, status_code=500)


class TTSAuthenticationError(TTSException):
    """Raised when Sarvam authentication fails."""
    def __init__(self, message: str = "Speech service authentication failed"):
        super().__init__(message, status_code=401)


class TTSRateLimitError(TTSException):
    """Raised when Sarvam rate limits are exceeded."""
    def __init__(self, message: str = "Speech service rate limit exceeded. Please try again later."):
        super().__init__(message, status_code=429)


class TTSBadRequestError(TTSException):
    """Raised when request payload or parameters are rejected by Sarvam."""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class TTSServiceError(TTSException):
    """Raised when upstream Sarvam service encounters an error or is unavailable."""
    def __init__(self, message: str = "Speech service unavailable. Please try again later."):
        super().__init__(message, status_code=502)


class SarvamTTSService:
    """
    Service layer responsible for interfacing directly with the Sarvam AI Bulbul v3 TTS API.
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

    def _get_client(self) -> SarvamAI:
        """Initializes and returns the SarvamAI client, validating the API key."""
        api_key = self._api_key or get_sarvam_api_key()
        if not api_key:
            logger.error("Sarvam API key is missing or contains placeholder in environment/config")
            raise TTSConfigurationError()

        # Re-initialize client if key has changed or client not created yet
        if self._client is None or self._last_api_key != api_key:
            self._client = SarvamAI(api_subscription_key=api_key)
            self._last_api_key = api_key

        return self._client

    def synthesize(
        self,
        text: str,
        language_code: str,
        speaker: Optional[str] = None,
        pace: Optional[float] = None,
    ) -> TTSSuccessResponse:
        """
        Synthesize text into speech audio using Sarvam Bulbul v3.

        Args:
            text: Text to synthesize (up to 2500 chars).
            language_code: BCP-47 language code (e.g. 'en-IN', 'hi-IN', 'mr-IN').
            speaker: Speaker voice (defaults to 'shubh').
            pace: Speech pace (defaults to 1.0, range 0.5 - 2.0).

        Returns:
            TTSSuccessResponse containing base64 audio and metadata.
        """
        client = self._get_client()
        model_name = self._model or get_sarvam_tts_model()
        target_speaker = speaker or DEFAULT_SPEAKER
        target_pace = pace if pace is not None else DEFAULT_PACE

        # Log safe operational metrics (never log API keys or raw patient text)
        logger.info(
            "Sarvam TTS synthesis request started: lang=%s, speaker=%s, pace=%.2f, text_len=%d, model=%s",
            language_code,
            target_speaker,
            target_pace,
            len(text),
            model_name,
        )

        start_time = time.perf_counter()

        try:
            response = client.text_to_speech.convert(
                text=text,
                language_code=language_code,
                speaker=target_speaker,
                pace=target_pace,
                model=model_name,
                output_audio_codec=OUTPUT_AUDIO_CODEC,
                speech_sample_rate=SPEECH_SAMPLE_RATE,
            )

            duration = time.perf_counter() - start_time
            request_id = getattr(response, "request_id", None)
            audios = getattr(response, "audios", [])
            audio_base64 = audios[0] if audios else ""

            if not audio_base64:
                logger.error("Sarvam TTS returned empty audio payload")
                raise TTSServiceError("Speech service returned empty audio data.")

            logger.info(
                "Sarvam TTS synthesis completed in %.2fs: request_id=%s, payload_size=%d chars",
                duration,
                request_id,
                len(audio_base64),
            )

            return TTSSuccessResponse(
                success=True,
                request_id=request_id,
                audio_base64=audio_base64,
                audio_format=OUTPUT_AUDIO_CODEC,
                language_code=language_code,
                speaker=target_speaker,
            )

        except (UnauthorizedError, ForbiddenError) as exc:
            logger.error("Sarvam authentication failure: %s", exc.__class__.__name__)
            raise TTSAuthenticationError() from exc

        except TooManyRequestsError as exc:
            logger.warning("Sarvam rate limit exceeded: %s", exc.__class__.__name__)
            raise TTSRateLimitError() from exc

        except (BadRequestError, UnprocessableEntityError) as exc:
            logger.error("Sarvam rejected TTS request: %s", exc)
            raise TTSBadRequestError(message=f"Invalid TTS request: {exc}") from exc

        except (ServiceUnavailableError, InternalServerError) as exc:
            logger.error("Sarvam upstream service error: %s", exc.__class__.__name__)
            raise TTSServiceError() from exc

        except ApiError as exc:
            logger.error("Sarvam API error: status_code=%s", getattr(exc, "status_code", None))
            if getattr(exc, "status_code", None) == 401:
                raise TTSAuthenticationError() from exc
            if getattr(exc, "status_code", None) == 429:
                raise TTSRateLimitError() from exc
            raise TTSServiceError() from exc

        except TTSException:
            raise

        except Exception as exc:
            logger.exception("Unexpected error during Sarvam TTS conversion")
            raise TTSServiceError(message="An unexpected error occurred while generating speech.") from exc


# Default singleton instance
tts_service = SarvamTTSService()
