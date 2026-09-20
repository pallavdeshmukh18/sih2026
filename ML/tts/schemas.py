from typing import Optional
from pydantic import BaseModel, Field


class TTSSynthesizeRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=2500,
        description="Text to synthesize into speech (1 to 2500 characters)",
    )
    language_code: str = Field(
        ...,
        description="Required BCP-47 language code (e.g. 'en-IN', 'hi-IN', 'mr-IN')",
    )
    speaker: Optional[str] = Field(
        "simran",
        description="Speaker voice identifier (default: 'simran')",
    )
    pace: Optional[float] = Field(
        1.0,
        ge=0.5,
        le=2.0,
        description="Speech pace between 0.5 and 2.0 (default: 1.0)",
    )
    provider: Optional[str] = Field(
        None,
        description="Optional TTS provider override ('bhashini' or 'sarvam'). Defaults to 'bhashini'.",
    )


class TTSSuccessResponse(BaseModel):
    success: bool = True
    request_id: Optional[str] = Field(None, description="Request ID")
    audio_base64: str = Field(..., description="Base64 encoded audio string")
    audio_format: str = Field("wav", description="Audio format")
    language_code: str = Field(..., description="Language code of synthesized speech")
    speaker: str = Field("simran", description="Speaker name used for synthesis")
    provider: Optional[str] = Field("bhashini", description="TTS provider used ('bhashini' or 'sarvam')")

    def __iter__(self):
        import base64
        return iter((base64.b64decode(self.audio_base64), {
            "request_id": self.request_id,
            "audio_format": self.audio_format,
            "language_code": self.language_code,
            "speaker": self.speaker,
            "provider": self.provider,
        }))


class TTSErrorResponse(BaseModel):
    success: bool = False
    error: str = Field(..., description="Error message")
