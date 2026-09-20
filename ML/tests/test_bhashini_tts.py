"""
Unit and integration tests for Bhashini Text-to-Speech (TTS) service.
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
    get_bhashini_inference_api_key,
    get_bhashini_tts_service_id,
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
)
from tts.bhashini import BhashiniTTS, TTSResult
from tts.service import TTSService


# ============================================================================
# Unit Tests (Offline / Mocked)
# ============================================================================

def test_bhashini_tts_instantiation_without_credentials():
    """Verify BhashiniTTS can be instantiated without credentials present."""
    tts = BhashiniTTS()
    assert tts is not None
    assert tts.default_gender == "female"


def test_bhashini_tts_missing_api_key():
    """Verify synthesis fails with MissingApiKeyError when inference API key is absent."""
    with patch("bhashini.client.get_bhashini_inference_api_key", return_value=None):
        client = BhashiniClient(inference_api_key=None)
        tts = BhashiniTTS(client=client, service_id_hi="test-service-id")
        with pytest.raises(MissingApiKeyError):
            tts.synthesize(text="नमस्ते", language="hi")


def test_bhashini_tts_missing_service_id():
    """Verify synthesis fails with MissingServiceIdError when service ID is not configured."""
    with patch("tts.bhashini.get_bhashini_tts_service_id", return_value=None):
        client = BhashiniClient(inference_api_key="valid_token")
        tts = BhashiniTTS(client=client)
        for lang in ("hi", "mr", "en"):
            with pytest.raises(MissingServiceIdError):
                tts.synthesize(text="Hello", language=lang)


def test_bhashini_tts_empty_text():
    """Verify empty or whitespace-only text raises InvalidAudioDataError."""
    tts = BhashiniTTS()
    with pytest.raises(InvalidAudioDataError):
        tts.synthesize(text="", language="hi")

    with pytest.raises(InvalidAudioDataError):
        tts.synthesize(text="   \n\t  ", language="hi")


def test_bhashini_tts_unsupported_language():
    """Verify requesting an unsupported language raises InvalidLanguageError."""
    tts = BhashiniTTS()
    with pytest.raises(InvalidLanguageError):
        tts.synthesize(text="Bonjour", language="fr")


@pytest.mark.parametrize("lang,expected_source_lang", [
    ("hi", "hi"),
    ("hi-IN", "hi"),
    ("mr", "mr"),
    ("mr-IN", "mr"),
    ("en", "en"),
    ("en-IN", "en"),
])
def test_bhashini_tts_mocked_synthesis(lang, expected_source_lang):
    """Verify request structure and audio decoding for Hindi, Marathi, and English."""
    mock_client = MagicMock(spec=BhashiniClient)
    raw_mock_audio = b"MOCK_WAV_AUDIO_BYTES_12345"
    mock_b64_audio = base64.b64encode(raw_mock_audio).decode("utf-8")

    # Mock ULCA TTS pipeline response
    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {
                "taskType": "tts",
                "config": {
                    "serviceId": f"tts-service-{expected_source_lang}",
                    "language": {"sourceLanguage": expected_source_lang},
                    "gender": "female",
                },
                "audio": [
                    {"audioContent": mock_b64_audio}
                ],
            }
        ]
    }

    tts = BhashiniTTS(
        client=mock_client,
        service_id_hi="tts-service-hi",
        service_id_mr="tts-service-mr",
        service_id_en="tts-service-en",
    )

    result = tts.synthesize(
        text="Sample prompt text",
        language=lang,
        gender="female",
        sampling_rate=22050,
    )

    # Verify return type and unpackability
    assert isinstance(result, TTSResult)
    audio_bytes, metadata = result
    assert audio_bytes == raw_mock_audio
    assert metadata["language"] == expected_source_lang
    assert metadata["service_id"] == f"tts-service-{expected_source_lang}"
    assert metadata["gender"] == "female"
    assert metadata["sampling_rate"] == 22050

    # Verify attribute access
    assert result.audio_bytes == raw_mock_audio
    assert result.audio_base64 == mock_b64_audio

    # Verify payload format sent to Bhashini
    mock_client.send_pipeline_request.assert_called_once()
    call_args = mock_client.send_pipeline_request.call_args[0][0]
    task = call_args["pipelineTasks"][0]
    assert task["taskType"] == "tts"
    assert task["config"]["language"]["sourceLanguage"] == expected_source_lang
    assert task["config"]["serviceId"] == f"tts-service-{expected_source_lang}"
    assert task["config"]["gender"] == "female"
    assert task["config"]["samplingRate"] == 22050
    assert call_args["inputData"]["input"][0]["source"] == "Sample prompt text"


def test_bhashini_tts_empty_audio_response():
    """Verify BhashiniResponseError is raised if response lacks audioContent."""
    mock_client = MagicMock(spec=BhashiniClient)
    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {"taskType": "tts", "audio": []}
        ]
    }

    tts = BhashiniTTS(client=mock_client, service_id_hi="dummy-id")
    with pytest.raises(BhashiniResponseError):
        tts.synthesize(text="Test", language="hi")


def test_tts_service_facade_bhashini_selection():
    """Verify TTSService facade correctly wraps BhashiniTTS."""
    mock_client = MagicMock(spec=BhashiniClient)
    raw_mock_audio = b"MOCK_AUDIO"
    mock_b64_audio = base64.b64encode(raw_mock_audio).decode("utf-8")

    mock_client.send_pipeline_request.return_value = {
        "pipelineResponse": [
            {
                "taskType": "tts",
                "audio": [{"audioContent": mock_b64_audio}]
            }
        ]
    }

    service = TTSService(
        provider="bhashini",
        client=mock_client,
        service_id_hi="tts-hi",
    )
    assert service.provider_name == "bhashini"
    assert isinstance(service.provider, BhashiniTTS)

    audio_bytes, meta = service.synthesize(text="नमस्ते", language="hi")
    assert audio_bytes == raw_mock_audio


# ============================================================================
# Live Integration Tests (Skipped when credentials are missing)
# ============================================================================

def _has_live_credentials(lang: str) -> bool:
    if os.getenv("RUN_LIVE_TESTS", "").lower() != "true":
        return False
    api_key = get_bhashini_inference_api_key()
    service_id = get_bhashini_tts_service_id(lang)
    return bool(api_key and service_id)


@pytest.mark.skipif(
    not _has_live_credentials("hi"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_TTS_SERVICE_ID_HI"
)
def test_live_bhashini_tts_hindi():
    """Live TTS test for Hindi."""
    tts = BhashiniTTS()
    audio_bytes, metadata = tts.synthesize(text="नमस्ते, आपकी जांच पूरी हो गई है।", language="hi")
    assert len(audio_bytes) > 0
    assert metadata["language"] == "hi"


@pytest.mark.skipif(
    not _has_live_credentials("mr"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_TTS_SERVICE_ID_MR"
)
def test_live_bhashini_tts_marathi():
    """Live TTS test for Marathi."""
    tts = BhashiniTTS()
    audio_bytes, metadata = tts.synthesize(text="नमस्कार, तुमची तपासणी पूर्ण झाली आहे.", language="mr")
    assert len(audio_bytes) > 0
    assert metadata["language"] == "mr"


@pytest.mark.skipif(
    not _has_live_credentials("en"),
    reason="Live test requires BHASHINI_INFERENCE_API_KEY and BHASHINI_TTS_SERVICE_ID_EN"
)
def test_live_bhashini_tts_english():
    """Live TTS test for English."""
    tts = BhashiniTTS()
    audio_bytes, metadata = tts.synthesize(text="Hello, your medical checkup is complete.", language="en")
    assert len(audio_bytes) > 0
    assert metadata["language"] == "en"
