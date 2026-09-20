"""
MediKiosk TTS (Text-to-Speech) module.
Provides provider-agnostic interfaces supporting Sarvam AI and Bhashini.
"""

from .base import BaseTTS
from .bhashini import BhashiniTTS, TTSResult
from .service import SarvamTTSService, TTSService, tts_service

__all__ = [
    "BaseTTS",
    "BhashiniTTS",
    "TTSResult",
    "SarvamTTSService",
    "TTSService",
    "tts_service",
]
