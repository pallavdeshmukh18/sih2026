import base64
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure ML directory is on sys.path
ml_dir = Path(__file__).resolve().parent.parent
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))

from main import app
from sarvamai.errors import UnauthorizedError, ServiceUnavailableError, TooManyRequestsError

client = TestClient(app)

# A minimal valid WAV byte sequence encoded in Base64
DUMMY_WAV_BYTES = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
DUMMY_WAV_BASE64 = base64.b64encode(DUMMY_WAV_BYTES).decode("utf-8")


def _mock_tts_response(request_id="req-tts-12345", audios=None):
    mock_resp = MagicMock()
    mock_resp.request_id = request_id
    mock_resp.audios = audios or [DUMMY_WAV_BASE64]
    return mock_resp


def test_synthesize_english_success():
    """Verify successful synthesis for English (en-IN)."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = _mock_tts_response(request_id="req-en-001")
        mock_get_client.return_value = mock_client

        payload = {
            "text": "Welcome to MediKiosk. Please tell me what brings you to the hospital today.",
            "language_code": "en-IN",
            "speaker": "shubh",
            "pace": 1.0,
        }
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["request_id"] == "req-en-001"
        assert data["audio_format"] == "wav"
        assert data["language_code"] == "en-IN"
        assert data["speaker"] == "shubh"
        assert data["audio_base64"] == DUMMY_WAV_BASE64

        mock_client.text_to_speech.convert.assert_called_once()
        _, kwargs = mock_client.text_to_speech.convert.call_args
        assert kwargs["model"] == "bulbul:v3"
        assert kwargs["language_code"] == "en-IN"
        assert kwargs["speaker"] == "shubh"
        assert kwargs["pace"] == 1.0


def test_synthesize_hindi_success():
    """Verify successful synthesis for Hindi (hi-IN)."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = _mock_tts_response(request_id="req-hi-002")
        mock_get_client.return_value = mock_client

        payload = {
            "text": "मेडीकियोस्क में आपका स्वागत है। आज आप कैसा महसूस कर रहे हैं?",
            "language_code": "hi-IN",
        }
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["language_code"] == "hi-IN"
        assert data["speaker"] == "simran"  # Default speaker


def test_synthesize_marathi_success():
    """Verify successful synthesis for Marathi (mr-IN)."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = _mock_tts_response(request_id="req-mr-003")
        mock_get_client.return_value = mock_client

        payload = {
            "text": "मेडीकियोस्कमध्ये आपले स्वागत आहे. आज तुम्हाला कसे वाटत आहे?",
            "language_code": "mr-IN",
        }
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["language_code"] == "mr-IN"


def test_synthesize_codemixed_success():
    """Verify code-mixed text synthesis is sent cleanly to Sarvam without alteration."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = _mock_tts_response(request_id="req-codemix-004")
        mock_get_client.return_value = mock_client

        payload = {
            "text": "कृपया अपना blood pressure बताइए।",
            "language_code": "hi-IN",
        }
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        _, kwargs = mock_client.text_to_speech.convert.call_args
        assert kwargs["text"] == "कृपया अपना blood pressure बताइए।"


def test_synthesize_missing_text():
    """Verify 422 error when text field is missing."""
    response = client.post("/api/tts/synthesize", json={"language_code": "en-IN"})
    assert response.status_code == 422


def test_synthesize_empty_text():
    """Verify 400 or 422 error when text is empty or only whitespace."""
    response = client.post("/api/tts/synthesize", json={"text": "   ", "language_code": "en-IN"})
    assert response.status_code in (400, 422)
    data = response.json()
    assert "empty" in str(data).lower() or "detail" in data


def test_synthesize_text_too_long():
    """Verify validation error when text exceeds 2500 characters."""
    long_text = "A" * 2501
    response = client.post("/api/tts/synthesize", json={"text": long_text, "language_code": "en-IN"})
    assert response.status_code in (400, 422)


def test_synthesize_missing_language_code():
    """Verify 422 error when language_code is omitted."""
    response = client.post("/api/tts/synthesize", json={"text": "Hello world"})
    assert response.status_code == 422


def test_synthesize_unsupported_language_code():
    """Verify 400 error when language_code is unsupported."""
    response = client.post("/api/tts/synthesize", json={"text": "Hello", "language_code": "fr-FR"})
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert "Unsupported language_code" in data["error"]


def test_synthesize_invalid_speaker():
    """Verify 400 error when an unsupported speaker is requested."""
    payload = {
        "text": "Hello",
        "language_code": "en-IN",
        "speaker": "unknown_voice",
    }
    response = client.post("/api/tts/synthesize", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert "Unsupported speaker" in data["error"]


def test_synthesize_invalid_pace():
    """Verify 400/422 error when pace is outside the 0.5 - 2.0 range."""
    # Pace too low
    response = client.post("/api/tts/synthesize", json={"text": "Hello", "language_code": "en-IN", "pace": 0.2})
    assert response.status_code in (400, 422)

    # Pace too high
    response = client.post("/api/tts/synthesize", json={"text": "Hello", "language_code": "en-IN", "pace": 3.0})
    assert response.status_code in (400, 422)


def test_synthesize_auth_failure_mocked():
    """Verify clean 401 response without exposing credentials on Sarvam auth error."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.side_effect = UnauthorizedError({"error": "Invalid API Key"})
        mock_get_client.return_value = mock_client

        payload = {"text": "Hello", "language_code": "en-IN"}
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert "authentication failed" in data["error"].lower()


def test_synthesize_rate_limit_mocked():
    """Verify clean 429 response on Sarvam rate limits."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.side_effect = TooManyRequestsError({"error": "Rate limit exceeded"})
        mock_get_client.return_value = mock_client

        payload = {"text": "Hello", "language_code": "en-IN"}
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 429
        data = response.json()
        assert data["success"] is False
        assert "rate limit" in data["error"].lower()


def test_synthesize_service_failure_mocked():
    """Verify clean 502 response on Sarvam service failure."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.side_effect = ServiceUnavailableError({"error": "Service Unavailable"})
        mock_get_client.return_value = mock_client

        payload = {"text": "Hello", "language_code": "en-IN"}
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 502
        data = response.json()
        assert data["success"] is False
        assert "service unavailable" in data["error"].lower()


def test_base64_audio_valid_wav_header():
    """Verify that the generated audio payload decodes into a valid WAV audio file."""
    with patch("tts.service.tts_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = _mock_tts_response()
        mock_get_client.return_value = mock_client

        payload = {"text": "Check audio header", "language_code": "en-IN"}
        response = client.post("/api/tts/synthesize", json=payload)
        assert response.status_code == 200
        data = response.json()
        audio_bytes = base64.b64decode(data["audio_base64"])
        # Standard WAV files start with RIFF followed by WAVE
        assert audio_bytes.startswith(b"RIFF")
        assert b"WAVE" in audio_bytes[:12]
