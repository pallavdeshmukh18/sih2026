from typing import Optional
from pydantic import BaseModel, Field


class STTSuccessResponse(BaseModel):
    success: bool = True
    transcript: str = Field(..., description="Transcribed text in the patient's spoken language")
    language_code: Optional[str] = Field(None, description="BCP-47 language code of the transcription")
    request_id: Optional[str] = Field(None, description="Sarvam request ID for tracing")
    language_probability: Optional[float] = Field(None, description="Confidence score for language detection if available")


class STTErrorResponse(BaseModel):
    success: bool = False
    error: str = Field(..., description="Error message")


class HealthResponse(BaseModel):
    status: str = "ok"
