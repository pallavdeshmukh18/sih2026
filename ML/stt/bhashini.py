"""
Bhashini Speech-to-Text (ASR) service implementation.

Converts raw audio bytes to base64, builds Bhashini ULCA ASR pipeline requests,
sends inference requests via BhashiniClient, and returns transcribed text.
Supports Hindi (hi), Marathi (mr), and English (en).
"""

import base64
import logging
import time
from typing import Optional

from bhashini.client import BhashiniClient
from bhashini.config import (
    DEFAULT_ASR_AUDIO_FORMAT,
    DEFAULT_ASR_SAMPLING_RATE,
    SUPPORTED_AUDIO_FORMATS,
    SUPPORTED_LANGUAGES,
    get_bhashini_asr_service_id,
    normalize_language,
)
from bhashini.exceptions import (
    BhashiniResponseError,
    InvalidAudioDataError,
    InvalidLanguageError,
    MissingServiceIdError,
    UnsupportedAudioFormatError,
)
from .base import BaseSTT

logger = logging.getLogger("medikiosk.stt.bhashini")


class BhashiniSTT(BaseSTT):
    """
    Bhashini ASR (Speech-to-Text) provider.
    Transcribes audio into text for Indian languages via Bhashini Dhruva pipeline.
    """

    def __init__(
        self,
        client: Optional[BhashiniClient] = None,
        service_id_hi: Optional[str] = None,
        service_id_mr: Optional[str] = None,
        service_id_en: Optional[str] = None,
        default_audio_format: str = DEFAULT_ASR_AUDIO_FORMAT,
        default_sampling_rate: int = DEFAULT_ASR_SAMPLING_RATE,
    ):
        self.client = client or BhashiniClient()
        self._service_ids = {
            "hi": service_id_hi,
            "mr": service_id_mr,
            "en": service_id_en,
        }
        self.default_audio_format = default_audio_format
        self.default_sampling_rate = default_sampling_rate

    def _get_service_id(self, language: str) -> str:
        """Resolves the Bhashini ASR service ID for the specified language."""
        service_id = self._service_ids.get(language) or get_bhashini_asr_service_id(language)
        if not service_id:
            raise MissingServiceIdError(
                f"Bhashini ASR service ID for language '{language}' is not configured. "
                f"Please set BHASHINI_ASR_SERVICE_ID_{language.upper()} in your environment or .env file."
            )
        return service_id

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str,
        audio_format: Optional[str] = None,
        sampling_rate: Optional[int] = None,
    ) -> str:
        """
        Transcribes raw audio bytes using the Bhashini ASR pipeline.

        Args:
            audio_bytes: Raw binary audio data.
            language: Target language ('hi', 'mr', 'en').
            audio_format: Container format ('wav', 'flac', etc.). Defaults to 'wav'.
            sampling_rate: Sampling frequency in Hz (defaults to 16000).

        Returns:
            Clean transcribed text string.

        Raises:
            InvalidAudioDataError: If audio_bytes is empty or invalid.
            InvalidLanguageError: If language is not one of 'hi', 'mr', 'en'.
            UnsupportedAudioFormatError: If audio format is not supported.
            MissingServiceIdError: If service ID for language is missing.
            BhashiniHttpError: On network or HTTP failure.
            BhashiniResponseError: If response from Bhashini lacks transcribed text.
        """
        # 1. Validate audio data
        if not audio_bytes or not isinstance(audio_bytes, (bytes, bytearray)):
            raise InvalidAudioDataError("audio_bytes must be non-empty binary data.")

        # 2. Validate and normalize language
        normalized_lang = normalize_language(language)
        if normalized_lang not in SUPPORTED_LANGUAGES:
            raise InvalidLanguageError(
                f"Unsupported language '{language}' for Bhashini ASR. Supported: {sorted(SUPPORTED_LANGUAGES)}"
            )

        # 3. Validate format and sampling rate
        fmt = (audio_format or self.default_audio_format).lower().lstrip(".")
        if fmt not in SUPPORTED_AUDIO_FORMATS:
            raise UnsupportedAudioFormatError(
                f"Unsupported audio format '{fmt}' for Bhashini ASR. Supported: {sorted(SUPPORTED_AUDIO_FORMATS)}"
            )

        rate = sampling_rate or self.default_sampling_rate
        service_id = self._get_service_id(normalized_lang)

        # 4. Safe operational logging (no audio/text payload)
        logger.info(
            "Bhashini ASR transcription requested: lang=%s, format=%s, rate=%d, bytes=%d",
            normalized_lang,
            fmt,
            rate,
            len(audio_bytes),
        )

        start_time = time.perf_counter()

        # 5. Base64 encode the audio
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        # 6. Build ULCA ASR pipeline payload
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {
                            "sourceLanguage": normalized_lang,
                        },
                        "serviceId": service_id,
                        "audioFormat": fmt,
                        "samplingRate": rate,
                    },
                }
            ],
            "inputData": {
                "audio": [
                    {
                        "audioContent": audio_base64,
                    }
                ]
            },
        }

        # 7. Execute request via BhashiniClient
        response_data = self.client.send_pipeline_request(payload)

        # 8. Parse response
        pipeline_responses = response_data.get("pipelineResponse")
        if not isinstance(pipeline_responses, list) or len(pipeline_responses) == 0:
            logger.error("Bhashini ASR response missing 'pipelineResponse' array")
            raise BhashiniResponseError("Bhashini ASR response did not contain 'pipelineResponse'.")

        # Locate ASR task response
        asr_task = None
        for task in pipeline_responses:
            if task.get("taskType") == "asr":
                asr_task = task
                break

        if not asr_task:
            # If taskType wasn't explicitly labeled, fallback to first task
            asr_task = pipeline_responses[0]

        outputs = asr_task.get("output", [])
        if not outputs or not isinstance(outputs, list):
            logger.error("Bhashini ASR response missing 'output' list in pipeline task")
            raise BhashiniResponseError("Bhashini ASR response contains no output elements.")

        # In Bhashini ASR, recognized text is stored in 'source' (or sometimes 'target')
        transcript = outputs[0].get("source") or outputs[0].get("target") or ""
        clean_transcript = transcript.strip()

        duration = time.perf_counter() - start_time
        logger.info(
            "Bhashini ASR transcription completed in %.2fs: chars=%d",
            duration,
            len(clean_transcript),
        )

        return clean_transcript
