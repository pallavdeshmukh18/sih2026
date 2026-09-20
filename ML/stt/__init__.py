"""
MediKiosk STT (Speech-to-Text) module.
Provides provider-agnostic interfaces supporting Sarvam AI and Bhashini.
"""

from .base import BaseSTT
from .bhashini import BhashiniSTT
from .service import SarvamSTTService, STTService, stt_service

__all__ = [
    "BaseSTT",
    "BhashiniSTT",
    "SarvamSTTService",
    "STTService",
    "stt_service",
]
