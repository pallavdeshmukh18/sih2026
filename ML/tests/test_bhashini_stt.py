"""
Unit and integration tests for Bhashini Speech-to-Text (STT/ASR) service.
Runs independently without requiring external API credentials for unit tests.
Live tests skip gracefully when credentials or service IDs are missing.
"""

import base64
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure ML package is on sys.path
ml_dir = Path(__file__).resolve().parent.parent
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))

from bhashini.client import BhashiniClient
from bhashini.config import (
    get_bhashini_asr_service_id,
    get_bhashini_inference_api_key,
    normalize_language,
)
from bhashini.exceptions import (
    BhashiniApiError,
    BhashiniAuthenticationError,
    BhashiniRateLimitError,
    BhashiniResponseError,
    BhashiniTimeoutError,
    InvalidAudioDataError,
    InvalidLanguageError,
    MissingApiKeyError,
    MissingServiceIdError,
    UnsupportedAudioFormatError,
)
from stt.bhashini import BhashiniSTT
from stt.service import STTService


# ============================================================================
# Unit Tests (Offline / Mocked)
# ============================================================================

def test_bhashini_stt_instantiation_without_credentials():
    """Verify BhashiniSTT can be instantiated without credentials present."""
    stt = BhashiniSTT()
    assert stt is not None
    assert stt.default_audio_format == "wav"
    assert stt.default_sampling_rate == 16000


def test_bhashini_stt_missing_api_key():
    """Verify transcription fails with MissingApiKeyError when inference API key is absent."""
    with patch("bhashini.client.get_bhashini_inference_api_key", return_value=None):
        client = BhashiniClient(inference_api_key=None)
        stt = BhashiniSTT(client=client, service_id_hi="test-service-id")
        with pytest.raises(MissingApiKeyError):
            stt.transcribe(audio_bytes=b"dummy_bytes", language="hi")


def test_bhashini_stt_missing_service_id():
    """Verify transcription fails with MissingServiceIdError when service ID is not configured."""
    with patch("stt.bhashini.get_bhashini_asr_service_id", return_value=None):
        client = BhashiniClient(inference_api_key="valid_token")
        stt = BhashiniSTT(client=client)
        for lang in ("hi", "mr", "en"):
            with pytest.raises(MissingServiceIdError):
                stt.transcribe(audio_bytes=b"dummy_bytes", language=lang)


def test_bhashini_stt_empty_audio():
    """Verify empty or non-bytes audio data raises InvalidAudioDataError."""
    stt = BhashiniSTT()
    with pytest.raises(InvalidAudioDataError):
        stt.transcribe(audio_bytes=b"", language="hi")

    with pytest.raises(InvalidAudioDataError):
        stt.transcribe(audio_bytes=None, language="hi")  # type: ignore


def test_bhashini_stt_unsupported_language():
    """Verify requesting an unsupported language raises InvalidLanguageError."""
    stt = BhashiniSTT()
    with pytest.raises(InvalidLanguageError):
        stt.transcribe(audio_bytes=b"dummy", language="es")  # Spanish not in hi/mr/en


def test_bhashini_stt_unsupported_format():
    """Verify unsupported audio format raises UnsupportedAudioFormatError."""
    stt = BhashiniSTT(service_id_hi="dummy-id")
    with pytest.raises(UnsupportedAudioFormatError):
        stt.transcribe(audio_bytes=b"dummy", language="hi", audio_format="aac")


@pytest.mark.parametrize("lang,expected_source_lang", [
    ("hi", "hi"),
    ("hi-IN", "hi"),
    ("mr", "mr"),
    ("mr-IN", "mr"),
    ("en", "en"),
    ("en-IN", "en"),
])
def test_bhashini_stt_mocked_transcription(lang, expected_source_lang):
    """Verify request structure and response extraction for Hindi, Marathi, and English."""
    mock_client = MagicMock(spec=BhashiniClient)
    expected_transcript = f"Test transcript for {expected_source_lang}"

    # Mock ULCA ASR pipeline response
    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {
                "taskType": "asr",
                "config": {
                    "serviceId": f"asr-service-{expected_source_lang}",
                    "language": {"sourceLanguage": expected_source_lang},
                    "audioFormat": "wav",
                },
                "output": [
                    {"source": expected_transcript}
                ],
            }
        ]
    }

    stt = BhashiniSTT(
        client=mock_client,
        service_id_hi="asr-service-hi",
        service_id_mr="asr-service-mr",
        service_id_en="asr-service-en",
    )

    dummy_audio = b"RIFFmockwavheaderanddata"
    result = stt.transcribe(audio_bytes=dummy_audio, language=lang, audio_format="wav")

    assert result == expected_transcript
    mock_client.send_pipeline_request.assert_called_once()

    # Verify payload format sent to Bhashini
    call_args = mock_client.send_pipeline_request.call_args[0][0]
    task = call_args["pipelineTasks"][0]
    assert task["taskType"] == "asr"
    assert task["config"]["language"]["sourceLanguage"] == expected_source_lang
    assert task["config"]["serviceId"] == f"asr-service-{expected_source_lang}"
    assert task["config"]["samplingRate"] == 16000

    # Verify audio content is valid base64
    encoded = call_args["inputData"]["audio"][0]["audioContent"]
    decoded = base64.b64decode(encoded)
    assert decoded == dummy_audio


def test_bhashini_stt_empty_output_response():
    """Verify BhashiniResponseError is raised if response contains no output elements."""
    mock_client = MagicMock(spec=BhashiniClient)
    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {"taskType": "asr", "output": []}
        ]
    }

    stt = BhashiniSTT(client=mock_client, service_id_hi="dummy-id")
    with pytest.raises(BhashiniResponseError):
        stt.transcribe(audio_bytes=b"dummy", language="hi")


def test_stt_service_facade_bhashini_selection():
    """Verify STTService facade correctly wraps BhashiniSTT."""
    mock_client = MagicMock(spec=BhashiniClient)
    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {
                "taskType": "asr",
                "output": [{"source": "नमस्ते"}]
            }
        ]
    }

    service = STTService(
        provider="bhashini",
        client=mock_client,
        service_id_hi="asr-hi",
    )
    assert service.provider_name == "bhashini"
    assert isinstance(service.provider, BhashiniSTT)

    transcript = service.transcribe(b"dummy_audio", language="hi")
    assert transcript == "नमस्ते"


# ============================================================================
# Live Integration Tests (Skipped when credentials are missing)
# ============================================================================

def _has_live_credentials(lang: str) -> bool:
    if os.getenv("RUN_LIVE_TESTS", "").lower() != "true":
        return False
    api_key = get_bhashini_inference_api_key()
    service_id = get_bhashini_asr_service_id(lang)
    return bool(api_key and service_id)


@pytest.mark.skipif(
    not _has_live_credentials("hi"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_ASR_SERVICE_ID_HI"
)
def test_live_bhashini_stt_hindi():
    """Live ASR test for Hindi."""
    stt = BhashiniSTT()
    dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    result = stt.transcribe(audio_bytes=dummy_wav, language="hi")
    assert isinstance(result, str)


@pytest.mark.skipif(
    not _has_live_credentials("mr"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_ASR_SERVICE_ID_MR"
)
def test_live_bhashini_stt_marathi():
    """Live ASR test for Marathi."""
    stt = BhashiniSTT()
    dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    result = stt.transcribe(audio_bytes=dummy_wav, language="mr")
    assert isinstance(result, str)


@pytest.mark.skipif(
    not _has_live_credentials("en"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_ASR_SERVICE_ID_EN"
)
def test_live_bhashini_stt_english():
    """Live ASR test for English."""
    stt = BhashiniSTT()
    dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    result = stt.transcribe(audio_bytes=dummy_wav, language="en")
    assert isinstance(result, str)
