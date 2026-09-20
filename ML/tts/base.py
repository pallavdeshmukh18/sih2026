"""
Abstract base class for Text-to-Speech (TTS) providers in MediKiosk.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple


class BaseTTS(ABC):
    """
    Abstract base class defining the provider-agnostic interface
    for Text-to-Speech (TTS) services.
    """

    @abstractmethod
    def synthesize(
        self,
        text: str,
        language: str,
        gender: Optional[str] = None,
        sampling_rate: Optional[int] = None,
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Synthesize text into speech audio in the specified language.

        Args:
            text: Text to convert to speech.
            language: Target language code (e.g., 'hi', 'mr', 'en').
            gender: Voice gender / speaker characteristic (e.g., 'female', 'male').
            sampling_rate: Target audio sampling frequency in Hz.

        Returns:
            Tuple of (audio_bytes, metadata_dict).
        """
        pass
