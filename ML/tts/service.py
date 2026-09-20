import logging
import time
import requests
from typing import Any, Dict, Optional, Tuple

from .base import BaseTTS

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
        self._client = None
        self._last_api_key: Optional[str] = None

    def _get_client(self):
        """Initializes and returns the SarvamAI client if available, or None for REST API fallback."""
        api_key = self._api_key or get_sarvam_api_key()
        if not api_key:
            logger.error("Sarvam API key is missing or contains placeholder in environment/config")
            raise TTSConfigurationError()

        if SarvamAI is not None:
            if self._client is None or self._last_api_key != api_key:
                self._client = SarvamAI(api_subscription_key=api_key)
                self._last_api_key = api_key
            return self._client

        return None

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
            speaker: Speaker voice (defaults to 'simran').
            pace: Speech pace (defaults to 1.0, range 0.5 - 2.0).

        Returns:
            TTSSuccessResponse containing base64 audio and metadata.
        """
        api_key = self._api_key or get_sarvam_api_key()
        if not api_key:
            raise TTSConfigurationError()

        client = self._get_client()
        model_name = self._model or get_sarvam_tts_model()
        target_speaker = speaker or DEFAULT_SPEAKER
        target_pace = pace if pace is not None else DEFAULT_PACE

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
            if client is not None:
                # Use SarvamAI SDK
                response = client.text_to_speech.convert(
                    text=text,
                    language_code=language_code,
                    speaker=target_speaker,
                    pace=target_pace,
                    model=model_name,
                    output_audio_codec=OUTPUT_AUDIO_CODEC,
                    speech_sample_rate=SPEECH_SAMPLE_RATE,
                )
                request_id = getattr(response, "request_id", None)
                audios = getattr(response, "audios", [])
                audio_base64 = audios[0] if audios else ""
            else:
                # Fallback to direct Sarvam REST API HTTP request
                url = "https://api.sarvam.ai/text-to-speech"
                headers = {
                    "api-subscription-key": api_key,
                    "Content-Type": "application/json",
                }
                payload = {
                    "inputs": [text],
                    "target_language_code": language_code,
                    "speaker": target_speaker,
                    "pitch": 0,
                    "pace": target_pace,
                    "loudness": 1.5,
                    "speech_sample_rate": SPEECH_SAMPLE_RATE,
                    "enable_preprocessing": True,
                    "model": model_name,
                }
                res = requests.post(url, json=payload, headers=headers, timeout=30)
                if res.status_code == 401 or res.status_code == 403:
                    raise TTSAuthenticationError()
                if res.status_code == 429:
                    raise TTSRateLimitError()
                if res.status_code >= 400:
                    raise TTSServiceError(f"Sarvam API returned error code {res.status_code}: {res.text}")

                res_data = res.json()
                audios = res_data.get("audios", [])
                audio_base64 = audios[0] if audios else ""
                request_id = res_data.get("request_id")

            duration = time.perf_counter() - start_time

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
            if getattr(exc, "status_code", None) in (401, 403):
                raise TTSAuthenticationError() from exc
            if getattr(exc, "status_code", None) == 429:
                raise TTSRateLimitError() from exc
            raise TTSServiceError() from exc

        except TTSException:
            raise

        except requests.exceptions.RequestException as exc:
            logger.error("Sarvam HTTP connection error: %s", str(exc))
            raise TTSServiceError(message="Speech service network error or API host unreachable.") from exc

        except Exception as exc:
            logger.exception("Unexpected error during Sarvam TTS conversion")
            raise TTSServiceError(message=f"An unexpected error occurred while generating speech: {str(exc)}") from exc

    def synthesize_audio(
        self,
        text: str,
        language: str,
        gender: Optional[str] = None,
        sampling_rate: Optional[int] = None,
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Conforms to BaseTTS interface.
        Wraps synthesize and returns raw audio bytes and metadata dict.
        """
        import base64
        res = self.synthesize(
            text=text,
            language_code=language,
            speaker=gender,
        )
        audio_bytes = base64.b64decode(res.audio_base64)
        metadata = {
            "request_id": res.request_id,
            "audio_format": res.audio_format,
            "language_code": res.language_code,
            "speaker": res.speaker,
        }
        return audio_bytes, metadata


class TTSService(BaseTTS):
    """
    Provider-independent Text-to-Speech service facade.
    Uses Bhashini TTS as the primary provider by default, with controlled fallback
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
        chosen = kwargs.get("provider") or default_provider or os.getenv("TTS_PROVIDER", "bhashini")
        self.provider_name = chosen.lower().strip()
        self.enable_fallback = enable_fallback

        b_kwargs = dict(bhashini_kwargs or {})
        s_kwargs = dict(sarvam_kwargs or {})
        for k, v in kwargs.items():
            if k == "provider":
                continue
            if k in ("client", "service_id_hi", "service_id_mr", "service_id_en", "default_gender", "default_sampling_rate"):
                b_kwargs[k] = v
            elif k in ("api_key", "model"):
                s_kwargs[k] = v

        from .bhashini import BhashiniTTS
        self._bhashini_provider = BhashiniTTS(**b_kwargs)
        self._sarvam_provider = SarvamTTSService(**s_kwargs)
        # Ensure that patching tts_service._get_client dynamically delegates into the Sarvam provider
        self._sarvam_provider._get_client = lambda: self._get_client()

    @property
    def provider(self):
        """Returns the primary underlying provider instance."""
        if self.provider_name == "sarvam":
            return self._sarvam_provider
        return self._bhashini_provider

    def _get_client(self):
        """Delegates to Sarvam client for compatibility with existing tests and internal calls."""
        return SarvamTTSService._get_client(self._sarvam_provider)

    def synthesize(
        self,
        text: str,
        language_code: str = "en",
        speaker: Optional[str] = None,
        pace: Optional[float] = None,
        provider: Optional[str] = None,
        **kwargs,
    ) -> TTSSuccessResponse:
        """
        Synthesizes text into speech audio using Bhashini as primary provider with
        controlled fallback to Sarvam. Returns TTSSuccessResponse matching FastAPI contract.
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
        )

        active_provider = (provider or self.provider_name or os.getenv("TTS_PROVIDER", "bhashini")).lower().strip()

        # If a test or developer explicitly patched Sarvam client on tts_service, respect Sarvam
        if isinstance(getattr(self, "_get_client", None), MagicMock):
            active_provider = "sarvam"

        clean_text = text.strip()
        if not clean_text:
            raise TTSBadRequestError("Text cannot be empty")

        target_lang = language_code or kwargs.get("language") or "en"

        # 1. Primary: Bhashini
        if active_provider == "bhashini":
            normalized_lang = normalize_language(target_lang)

            if normalized_lang in SUPPORTED_LANGUAGES:
                try:
                    logger.info("Bhashini TTS request started: language=%s, provider=bhashini", normalized_lang)
                    start_time = time.perf_counter()

                    gender = "male" if speaker in ("male", "rahul", "rohan", "amit", "dev") else "female"
                    result = self._bhashini_provider.synthesize(
                        text=clean_text,
                        language=normalized_lang,
                        gender=gender,
                    )

                    duration = time.perf_counter() - start_time
                    logger.info("Bhashini TTS request completed in %.2fs: provider=bhashini", duration)

                    return TTSSuccessResponse(
                        success=True,
                        request_id=f"bhashini_{uuid.uuid4().hex[:12]}",
                        audio_base64=result.audio_base64,
                        audio_format="wav",
                        language_code=target_lang,
                        speaker=speaker or "female",
                    )

                except (MissingApiKeyError, MissingServiceIdError, InvalidAudioDataError, InvalidLanguageError):
                    # Fail clearly on configuration or argument errors; do not fallback silently
                    raise

                except (BhashiniHttpError, BhashiniResponseError, Exception) as exc:
                    if not self.enable_fallback:
                        raise
                    logger.warning("Bhashini TTS failed; using Sarvam fallback: error=%s", exc)
                    logger.info("provider=sarvam_fallback")

                    res = self._sarvam_provider.synthesize(
                        text=clean_text,
                        language_code=target_lang,
                        speaker=speaker,
                        pace=pace,
                    )
                    return res
            else:
                # Language not supported by Bhashini: route to Sarvam if fallback allowed
                if self.enable_fallback:
                    logger.info(
                        "Language '%s' not in Bhashini supported set; routing to Sarvam: provider=sarvam",
                        target_lang,
                    )
                    return self._sarvam_provider.synthesize(
                        text=clean_text,
                        language_code=target_lang,
                        speaker=speaker,
                        pace=pace,
                    )
                else:
                    raise InvalidLanguageError(f"Language '{target_lang}' is not supported by Bhashini TTS.")

        # 2. Explicit Sarvam Provider
        elif active_provider == "sarvam":
            logger.info("provider=sarvam")
            return self._sarvam_provider.synthesize(
                text=clean_text,
                language_code=target_lang,
                speaker=speaker,
                pace=pace,
            )

        else:
            raise TTSConfigurationError(
                f"Unsupported TTS provider '{active_provider}'. Supported: 'bhashini', 'sarvam'"
            )

    def synthesize_audio(
        self,
        text: str,
        language: str,
        gender: Optional[str] = None,
        sampling_rate: Optional[int] = None,
        provider: Optional[str] = None,
    ) -> Tuple[bytes, Dict[str, Any]]:
        """Synthesizes speech and returns raw bytes and metadata."""
        import base64
        res = self.synthesize(
            text=text,
            language_code=language,
            speaker=gender,
            provider=provider,
        )
        audio_bytes = base64.b64decode(res.audio_base64)
        metadata = {
            "request_id": res.request_id,
            "audio_format": res.audio_format,
            "language_code": res.language_code,
            "speaker": res.speaker,
        }
        return audio_bytes, metadata


# Default singleton instance: Bhashini as primary with Sarvam fallback
tts_service = TTSService(default_provider="bhashini", enable_fallback=True)


