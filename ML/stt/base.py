"""
Abstract base class for Speech-to-Text (ASR) providers in MediKiosk.
"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseSTT(ABC):
    """
    Abstract base class defining the provider-agnostic interface
    for Speech-to-Text (ASR) services.
    """

    @abstractmethod
    def transcribe(
        self,
        audio_bytes: bytes,
        language: str,
        audio_format: str = "wav",
        sampling_rate: int = 16000,
    ) -> str:
        """
        Transcribe audio bytes to text in the specified language.

        Args:
            audio_bytes: Binary audio content.
            language: Target language code (e.g., 'hi', 'mr', 'en').
            audio_format: Audio container format (e.g., 'wav', 'flac', 'mp3').
            sampling_rate: Audio sampling frequency in Hz.

        Returns:
            Clean transcribed text string.
        """
        pass
