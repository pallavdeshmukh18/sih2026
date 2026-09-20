"""
Bhashini Text-to-Speech (TTS) service implementation.

Builds Bhashini ULCA TTS pipeline requests, sends inference requests
via BhashiniClient, decodes returned base64 audio, and returns raw audio bytes
along with response metadata.
Supports Hindi (hi), Marathi (mr), and English (en).
"""

import base64
import logging
import time
from typing import Any, Dict, Optional, Tuple

from bhashini.client import BhashiniClient
from bhashini.config import (
    DEFAULT_TTS_GENDER,
    SUPPORTED_LANGUAGES,
    get_bhashini_tts_service_id,
    normalize_language,
)
from bhashini.exceptions import (
    BhashiniResponseError,
    InvalidAudioDataError,
    InvalidLanguageError,
    MissingServiceIdError,
)
from .base import BaseTTS

logger = logging.getLogger("medikiosk.tts.bhashini")


class TTSResult(tuple):
    """
    Subclass of tuple (audio_bytes, metadata) to support both tuple unpacking:
        audio_bytes, meta = tts.synthesize(...)
    and named attribute access:
        result.audio_bytes, result.metadata, result.audio_base64
    """
    def __new__(cls, audio_bytes: bytes, metadata: Dict[str, Any]):
        return super().__new__(cls, (audio_bytes, metadata))

    @property
    def audio_bytes(self) -> bytes:
        return self[0]

    @property
    def metadata(self) -> Dict[str, Any]:
        return self[1]

    @property
    def audio_base64(self) -> str:
        return self[1].get("audio_base64", "")


class BhashiniTTS(BaseTTS):
    """
    Bhashini TTS (Text-to-Speech) provider.
    Converts text to speech audio for Indian languages via Bhashini Dhruva pipeline.
    """

    def __init__(
        self,
        client: Optional[BhashiniClient] = None,
        service_id_hi: Optional[str] = None,
        service_id_mr: Optional[str] = None,
        service_id_en: Optional[str] = None,
        default_gender: str = DEFAULT_TTS_GENDER,
        default_sampling_rate: Optional[int] = None,
    ):
        self.client = client or BhashiniClient()
        self._service_ids = {
            "hi": service_id_hi,
            "mr": service_id_mr,
            "en": service_id_en,
        }
        self.default_gender = default_gender
        self.default_sampling_rate = default_sampling_rate

    def _get_service_id(self, language: str) -> str:
        """Resolves the Bhashini TTS service ID for the specified language."""
        service_id = self._service_ids.get(language) or get_bhashini_tts_service_id(language)
        if not service_id:
            raise MissingServiceIdError(
                f"Bhashini TTS service ID for language '{language}' is not configured. "
                f"Please set BHASHINI_TTS_SERVICE_ID_{language.upper()} in your environment or .env file."
            )
        return service_id

    def synthesize(
        self,
        text: str,
        language: str,
        gender: Optional[str] = None,
        sampling_rate: Optional[int] = None,
    ) -> TTSResult:
        """
        Synthesizes text into speech audio using the Bhashini TTS pipeline.

        Args:
            text: Text to synthesize into speech.
            language: Target language ('hi', 'mr', 'en').
            gender: Voice gender / characteristic (defaults to configured default, e.g. 'female').
            sampling_rate: Optional sampling frequency in Hz (e.g. 22050).

        Returns:
            TTSResult (unpackable as audio_bytes, metadata).

        Raises:
            InvalidAudioDataError: If text is empty or non-string.
            InvalidLanguageError: If language is not one of 'hi', 'mr', 'en'.
            MissingServiceIdError: If service ID for language is missing.
            BhashiniHttpError: On network or HTTP failure.
            BhashiniResponseError: If response from Bhashini lacks audio payload.
        """
        # 1. Validate text
        if not text or not isinstance(text, str) or not text.strip():
            raise InvalidAudioDataError("Text to synthesize cannot be empty.")

        clean_text = text.strip()

        # 2. Validate and normalize language
        normalized_lang = normalize_language(language)
        if normalized_lang not in SUPPORTED_LANGUAGES:
            raise InvalidLanguageError(
                f"Unsupported language '{language}' for Bhashini TTS. Supported: {sorted(SUPPORTED_LANGUAGES)}"
            )

        target_gender = (gender or self.default_gender).lower()
        target_sampling_rate = sampling_rate or self.default_sampling_rate
        service_id = self._get_service_id(normalized_lang)

        # 3. Safe operational logging (no text content)
        logger.info(
            "Bhashini TTS synthesis requested: lang=%s, gender=%s, rate=%s, text_len=%d",
            normalized_lang,
            target_gender,
            str(target_sampling_rate) if target_sampling_rate else "default",
            len(clean_text),
        )

        start_time = time.perf_counter()

        # 4. Build ULCA TTS pipeline config
        tts_config: Dict[str, Any] = {
            "language": {
                "sourceLanguage": normalized_lang,
            },
            "serviceId": service_id,
        }
        if target_gender:
            tts_config["gender"] = target_gender
        if target_sampling_rate:
            tts_config["samplingRate"] = target_sampling_rate

        # 5. Build ULCA pipeline payload
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": tts_config,
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": clean_text,
                    }
                ]
            },
        }

        # 6. Execute request via BhashiniClient
        response_data = self.client.send_pipeline_request(payload)

        # 7. Parse response
        pipeline_responses = response_data.get("pipelineResponse")
        if not isinstance(pipeline_responses, list) or len(pipeline_responses) == 0:
            logger.error("Bhashini TTS response missing 'pipelineResponse' array")
            raise BhashiniResponseError("Bhashini TTS response did not contain 'pipelineResponse'.")

        tts_task = None
        for task in pipeline_responses:
            if task.get("taskType") == "tts":
                tts_task = task
                break

        if not tts_task:
            tts_task = pipeline_responses[0]

        # In Bhashini TTS, audio is typically in audio[0].audioContent
        audio_list = tts_task.get("audio", [])
        audio_base64 = ""
        if audio_list and isinstance(audio_list, list):
            audio_base64 = audio_list[0].get("audioContent", "")

        # Fallback check for output list
        if not audio_base64:
            output_list = tts_task.get("output", [])
            if output_list and isinstance(output_list, list):
                audio_base64 = output_list[0].get("audioContent", "")

        if not audio_base64:
            logger.error("Bhashini TTS response contains no audioContent")
            raise BhashiniResponseError("Bhashini TTS response did not contain audioContent.")

        # 8. Decode base64 audio
        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as exc:
            logger.error("Failed to decode base64 audio from Bhashini: %s", exc)
            raise BhashiniResponseError("Bhashini TTS returned invalid base64 audio data.") from exc

        duration = time.perf_counter() - start_time
        logger.info(
            "Bhashini TTS synthesis completed in %.2fs: audio_bytes=%d",
            duration,
            len(audio_bytes),
        )

        metadata: Dict[str, Any] = {
            "language": normalized_lang,
            "service_id": service_id,
            "gender": target_gender,
            "sampling_rate": target_sampling_rate,
            "audio_format": "wav",
            "audio_base64": audio_base64,
            "duration_seconds": round(duration, 3),
        }

        return TTSResult(audio_bytes, metadata)
