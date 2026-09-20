import os
from typing import Optional, Set
from stt.config import get_sarvam_api_key


def get_sarvam_tts_model() -> str:
    """
    Retrieve the configured Sarvam TTS model.
    Defaults to 'bulbul:v3'.
    """
    return os.getenv("SARVAM_TTS_MODEL", "bulbul:v3").strip().strip("'\"")


# Supported language codes for TTS (BCP-47 and standard 2-letter ISO-639)
SUPPORTED_TTS_LANGUAGES: Set[str] = {
    "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
    "hi", "mr", "en", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or",
}

# Complete list of supported speaker voices (including Bhashini female/male voices)
SUPPORTED_SPEAKERS: Set[str] = {
    "female", "male", "default",
    "anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh",
    "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran",
    "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan",
    "sumit", "roopa", "kabir", "aayan", "shubh", "ashutosh", "advait",
    "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti",
    "suhani", "mohit", "kavitha", "rehan", "soham", "rupali",
}

DEFAULT_SPEAKER: str = "simran"
DEFAULT_PACE: float = 1.0
MIN_PACE: float = 0.5
MAX_PACE: float = 2.0
MAX_TEXT_LENGTH: int = 2500
OUTPUT_AUDIO_CODEC: str = "wav"
SPEECH_SAMPLE_RATE: int = 24000
