import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure ML package is on sys.path
ml_dir = Path(__file__).resolve().parent.parent
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))

from main import app
from stt.service import SarvamSTTService
from sarvamai.errors import UnauthorizedError, ServiceUnavailableError, TooManyRequestsError


client = TestClient(app)


def test_health_check():
    """Verify that the health check endpoint returns 200 and status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_transcribe_missing_file():
    """Verify that requesting transcription without a file fails with 422 or 400."""
    response = client.post("/api/stt/transcribe", data={"language_code": "hi-IN"})
    assert response.status_code in (400, 422)
    data = response.json()
    assert "error" in data or "detail" in data


def test_transcribe_empty_file():
    """Verify that uploading a 0-byte file returns a 400 validation error."""
    files = {"file": ("empty.wav", io.BytesIO(b""), "audio/wav")}
    response = client.post("/api/stt/transcribe", files=files)
    assert response.status_code == 400
    assert response.json() == {"success": False, "error": "Audio file is empty"}


def test_transcribe_unsupported_format():
    """Verify that uploading an unsupported format (e.g. .txt) returns a 400 validation error."""
    files = {"file": ("notes.txt", io.BytesIO(b"Sample clinical notes"), "text/plain")}
    response = client.post("/api/stt/transcribe", files=files)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert "Unsupported audio format" in data["error"]


def test_transcribe_missing_api_key():
    """Verify that when no Sarvam API key is configured, a 500 configuration error is returned."""
    with patch("stt.service.get_sarvam_api_key", return_value=None):
        with patch("stt.service.stt_service._get_client", side_effect=lambda: SarvamSTTService(api_key=None)._get_client()):
            files = {"file": ("test.wav", io.BytesIO(b"RIFF dummy wav data"), "audio/wav")}
            response = client.post("/api/stt/transcribe", files=files)
            assert response.status_code == 500
            data = response.json()
            assert data["success"] is False
            assert "API key" in data["error"]


def test_transcribe_success_mocked():
    """Verify successful transcription with mocked Sarvam SDK response."""
    mock_sarvam_resp = MagicMock()
    mock_sarvam_resp.transcript = "मुझे तीन दिन से सीने में दर्द हो रहा है।"
    mock_sarvam_resp.language_code = "hi-IN"
    mock_sarvam_resp.request_id = "sarvam-mock-req-12345"
    mock_sarvam_resp.language_probability = 0.98

    with patch("stt.service.stt_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.return_value = mock_sarvam_resp
        mock_get_client.return_value = mock_client

        files = {"file": ("chest_pain_hindi.wav", io.BytesIO(b"fake wav bytes"), "audio/wav")}
        data = {"language_code": "hi-IN"}
        response = client.post("/api/stt/transcribe", files=files, data=data)

        assert response.status_code == 200
        json_resp = response.json()
        assert json_resp["success"] is True
        assert json_resp["transcript"] == "मुझे तीन दिन से सीने में दर्द हो रहा है।"
        assert json_resp["language_code"] == "hi-IN"
        assert json_resp["request_id"] == "sarvam-mock-req-12345"
        assert json_resp["language_probability"] == 0.98

        # Verify SDK method was called with appropriate arguments
        mock_client.speech_to_text.transcribe.assert_called_once()
        _, kwargs = mock_client.speech_to_text.transcribe.call_args
        assert kwargs["model"] == "saaras:v4"
        assert kwargs["mode"] == "transcribe"
        assert kwargs["language_code"] == "hi-IN"


def test_transcribe_auth_failure_mocked():
    """Verify clean 401 response without exposing credentials on Sarvam auth error."""
    with patch("stt.service.stt_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.side_effect = UnauthorizedError({"error": "Invalid API Key"})
        mock_get_client.return_value = mock_client

        files = {"file": ("test.wav", io.BytesIO(b"fake wav bytes"), "audio/wav")}
        response = client.post("/api/stt/transcribe", files=files)

        assert response.status_code == 401
        json_resp = response.json()
        assert json_resp["success"] is False
        assert "authentication failed" in json_resp["error"].lower()


def test_transcribe_rate_limit_mocked():
    """Verify clean 429 response when Sarvam rate limits are reached."""
    with patch("stt.service.stt_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.side_effect = TooManyRequestsError({"error": "Rate limit exceeded"})
        mock_get_client.return_value = mock_client

        files = {"file": ("test.wav", io.BytesIO(b"fake wav bytes"), "audio/wav")}
        response = client.post("/api/stt/transcribe", files=files)

        assert response.status_code == 429
        json_resp = response.json()
        assert json_resp["success"] is False
        assert "rate limit" in json_resp["error"].lower()


def test_transcribe_service_failure_mocked():
    """Verify clean 502 response when Sarvam encounters service failure."""
    with patch("stt.service.stt_service._get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.side_effect = ServiceUnavailableError({"error": "Service Unavailable"})
        mock_get_client.return_value = mock_client

        files = {"file": ("test.wav", io.BytesIO(b"fake wav bytes"), "audio/wav")}
        response = client.post("/api/stt/transcribe", files=files)

        assert response.status_code == 502
        json_resp = response.json()
        assert json_resp["success"] is False
        assert "service unavailable" in json_resp["error"].lower()
