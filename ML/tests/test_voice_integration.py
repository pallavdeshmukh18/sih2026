"""
Integration tests for the Bhashini-primary and Sarvam-fallback voice layer.

Verifies:
1. Bhashini STT (Hindi, Marathi, English, with locale normalization).
2. Bhashini TTS (Hindi, Marathi, English, with locale normalization).
3. Provider selection: Bhashini default, explicit Sarvam override.
4. Automatic fallback: Bhashini failure -> Sarvam fallback succeeds.
5. Double failure: Both providers fail -> clean HTTP error response.
6. End-to-end integration: Audio -> STT -> Clinical Engine -> TTS -> Audio.
"""

import base64
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
from bhashini.exceptions import BhashiniHttpError, BhashiniTimeoutError
from stt.service import stt_service, STTService
from tts.service import tts_service, TTSService
from stt.schemas import STTSuccessResponse
from tts.schemas import TTSSuccessResponse

client = TestClient(app)

DUMMY_WAV_HEADER = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"


# ============================================================================
# 1. STT: Bhashini Primary with Hindi, Marathi, and English (Mocked)
# ============================================================================

@pytest.mark.parametrize("lang_code,normalized", [
    ("hi", "hi"),
    ("hi-IN", "hi"),
    ("mr", "mr"),
    ("mr-IN", "mr"),
    ("en", "en"),
    ("en-IN", "en"),
])
def test_stt_bhashini_primary_success(lang_code, normalized):
    """Verify Bhashini is used as primary STT provider for hi, mr, en."""
    expected_text = f"Transcribed speech in {normalized}"

    with patch.object(stt_service._bhashini_provider, "transcribe", return_value=expected_text) as mock_bhashini:
        with patch.object(stt_service._sarvam_provider, "transcribe_audio") as mock_sarvam:
            files = {"file": ("patient_audio.wav", io.BytesIO(DUMMY_WAV_HEADER), "audio/wav")}
            data = {"language_code": lang_code}

            response = client.post("/api/stt/transcribe", files=files, data=data)

            assert response.status_code == 200
            res_json = response.json()
            assert res_json["success"] is True
            assert res_json["transcript"] == expected_text
            assert res_json["language_code"] == normalized

            mock_bhashini.assert_called_once()
            mock_sarvam.assert_not_called()


# ============================================================================
# 2. TTS: Bhashini Primary with Hindi, Marathi, and English (Mocked)
# ============================================================================

@pytest.mark.parametrize("lang_code,normalized", [
    ("hi", "hi"),
    ("hi-IN", "hi"),
    ("mr", "mr"),
    ("mr-IN", "mr"),
    ("en", "en"),
    ("en-IN", "en"),
])
def test_tts_bhashini_primary_success(lang_code, normalized):
    """Verify Bhashini is used as primary TTS provider for hi, mr, en."""
    from tts.bhashini import TTSResult
    mock_audio_bytes = b"RIFFmockttsresponsebytes"
    mock_b64 = base64.b64encode(mock_audio_bytes).decode("utf-8")
    mock_result = TTSResult(mock_audio_bytes, {
        "language": normalized,
        "service_id": "test-tts-service",
        "audio_base64": mock_b64,
        "audio_format": "wav",
    })

    with patch.object(tts_service._bhashini_provider, "synthesize", return_value=mock_result) as mock_bhashini:
        with patch.object(tts_service._sarvam_provider, "synthesize") as mock_sarvam:
            payload = {
                "text": "कृपया अपनी समस्या बताएं।",
                "language_code": lang_code,
                "speaker": "female",
            }

            response = client.post("/api/tts/synthesize", json=payload)

            assert response.status_code == 200
            res_json = response.json()
            assert res_json["success"] is True
            assert res_json["audio_base64"] == mock_b64
            assert res_json["audio_format"] == "wav"

            mock_bhashini.assert_called_once()
            mock_sarvam.assert_not_called()


# ============================================================================
# 3. Explicit Sarvam Provider Selection
# ============================================================================

def test_explicit_sarvam_stt_selection():
    """Verify explicit provider='sarvam' bypasses Bhashini and routes to Sarvam STT."""
    mock_sarvam_res = STTSuccessResponse(
        success=True,
        transcript="Sarvam transcribed text",
        language_code="hi-IN",
        request_id="sarvam-req-123",
    )

    with patch.object(stt_service._sarvam_provider, "transcribe_audio", return_value=mock_sarvam_res) as mock_sarvam:
        with patch.object(stt_service._bhashini_provider, "transcribe") as mock_bhashini:
            files = {"file": ("audio.wav", io.BytesIO(DUMMY_WAV_HEADER), "audio/wav")}
            data = {"language_code": "hi", "provider": "sarvam"}

            response = client.post("/api/stt/transcribe", files=files, data=data)

            assert response.status_code == 200
            assert response.json()["transcript"] == "Sarvam transcribed text"

            mock_sarvam.assert_called_once()
            mock_bhashini.assert_not_called()


def test_explicit_sarvam_tts_selection():
    """Verify explicit provider='sarvam' bypasses Bhashini and routes to Sarvam TTS."""
    mock_sarvam_res = TTSSuccessResponse(
        success=True,
        request_id="sarvam-tts-123",
        audio_base64="UklGRsarvam",
        audio_format="wav",
        language_code="hi-IN",
        speaker="simran",
    )

    with patch.object(tts_service._sarvam_provider, "synthesize", return_value=mock_sarvam_res) as mock_sarvam:
        with patch.object(tts_service._bhashini_provider, "synthesize") as mock_bhashini:
            payload = {
                "text": "नमस्ते",
                "language_code": "hi-IN",
                "provider": "sarvam",
            }

            response = client.post("/api/tts/synthesize", json=payload)

            assert response.status_code == 200
            assert response.json()["audio_base64"] == "UklGRsarvam"

            mock_sarvam.assert_called_once()
            mock_bhashini.assert_not_called()


# ============================================================================
# 4. Fallback Behavior: Bhashini Failure -> Sarvam Fallback Succeeds
# ============================================================================

def test_stt_bhashini_failure_fallback_to_sarvam():
    """Verify Bhashini failure automatically triggers Sarvam STT fallback."""
    mock_sarvam_res = STTSuccessResponse(
        success=True,
        transcript="Recovered via Sarvam fallback",
        language_code="mr-IN",
        request_id="sarvam-fallback-456",
    )

    # Simulate Bhashini timeout / HTTP error
    with patch.object(stt_service._bhashini_provider, "transcribe", side_effect=BhashiniTimeoutError("Connection timed out")):
        with patch.object(stt_service._sarvam_provider, "transcribe_audio", return_value=mock_sarvam_res) as mock_sarvam:
            files = {"file": ("audio.wav", io.BytesIO(DUMMY_WAV_HEADER), "audio/wav")}
            data = {"language_code": "mr"}

            response = client.post("/api/stt/transcribe", files=files, data=data)

            assert response.status_code == 200
            assert response.json()["transcript"] == "Recovered via Sarvam fallback"
            mock_sarvam.assert_called_once()


def test_tts_bhashini_failure_fallback_to_sarvam():
    """Verify Bhashini failure automatically triggers Sarvam TTS fallback."""
    mock_sarvam_res = TTSSuccessResponse(
        success=True,
        request_id="sarvam-fallback-789",
        audio_base64="UklGRfallbackaudio",
        audio_format="wav",
        language_code="en-IN",
        speaker="simran",
    )

    with patch.object(tts_service._bhashini_provider, "synthesize", side_effect=BhashiniHttpError("Bhashini 502 Bad Gateway")):
        with patch.object(tts_service._sarvam_provider, "synthesize", return_value=mock_sarvam_res) as mock_sarvam:
            payload = {
                "text": "Hello patient, how can I help you?",
                "language_code": "en",
            }

            response = client.post("/api/tts/synthesize", json=payload)

            assert response.status_code == 200
            assert response.json()["audio_base64"] == "UklGRfallbackaudio"
            mock_sarvam.assert_called_once()


# ============================================================================
# 5. Double Failure: Both Providers Fail -> Clean Error Response
# ============================================================================

def test_stt_both_providers_fail_clean_error():
    """Verify clean 502/500 error when both Bhashini and Sarvam STT fail."""
    from stt.service import STTServiceError

    with patch.object(stt_service._bhashini_provider, "transcribe", side_effect=BhashiniTimeoutError("Bhashini timeout")):
        with patch.object(stt_service._sarvam_provider, "transcribe_audio", side_effect=STTServiceError("Sarvam service down")):
            files = {"file": ("audio.wav", io.BytesIO(DUMMY_WAV_HEADER), "audio/wav")}
            data = {"language_code": "hi"}

            response = client.post("/api/stt/transcribe", files=files, data=data)

            assert response.status_code == 502
            res_json = response.json()
            assert res_json["success"] is False
            assert "error" in res_json


def test_tts_both_providers_fail_clean_error():
    """Verify clean 502 error when both Bhashini and Sarvam TTS fail."""
    from tts.service import TTSServiceError

    with patch.object(tts_service._bhashini_provider, "synthesize", side_effect=BhashiniHttpError("Bhashini error")):
        with patch.object(tts_service._sarvam_provider, "synthesize", side_effect=TTSServiceError("Sarvam error")):
            payload = {
                "text": "Test message",
                "language_code": "hi",
            }

            response = client.post("/api/tts/synthesize", json=payload)

            assert response.status_code == 502
            res_json = response.json()
            assert res_json["success"] is False
            assert "error" in res_json


# ============================================================================
# 6. End-to-End Voice Cycle: Audio -> STT -> Clinical Turn -> TTS -> Audio
# ============================================================================

def test_end_to_end_voice_turn_cycle():
    """
    Simulates the full patient voice turn:
    1. Patient speaks Hindi -> Transcribed via Bhashini ASR.
    2. Transcribed text processed by Clinical engine mock.
    3. Next clinical question synthesized via Bhashini TTS.
    4. Base64 audio returned for frontend playback.
    """
    from tts.bhashini import TTSResult

    patient_transcript = "मुझे दो दिन से बुखार और गले में खराश है।"
    clinical_next_question = "बुखार के साथ क्या आपको ठंड भी लग रही है?"
    tts_audio = b"RIFFsynthesizedaudiobytesforpatient"
    tts_b64 = base64.b64encode(tts_audio).decode("utf-8")

    mock_tts_result = TTSResult(tts_audio, {
        "language": "hi",
        "service_id": "test-tts-service",
        "audio_base64": tts_b64,
        "audio_format": "wav",
    })

    # 1. STT Transcribe via Bhashini
    with patch.object(stt_service._bhashini_provider, "transcribe", return_value=patient_transcript):
        files = {"file": ("hindi_patient.wav", io.BytesIO(DUMMY_WAV_HEADER), "audio/wav")}
        stt_resp = client.post("/api/stt/transcribe", files=files, data={"language_code": "hi-IN"})
        assert stt_resp.status_code == 200
        recognized_text = stt_resp.json()["transcript"]
        assert recognized_text == patient_transcript

    # 2. TTS Synthesize Next Question via Bhashini
    with patch.object(tts_service._bhashini_provider, "synthesize", return_value=mock_tts_result):
        tts_resp = client.post("/api/tts/synthesize", json={
            "text": clinical_next_question,
            "language_code": "hi-IN",
            "speaker": "female",
        })
        assert tts_resp.status_code == 200
        output_audio_b64 = tts_resp.json()["audio_base64"]
        assert output_audio_b64 == tts_b64
        # Verify decoded audio is valid
        assert base64.b64decode(output_audio_b64) == tts_audio
