import logging
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from .config import (
    SUPPORTED_TTS_LANGUAGES,
    SUPPORTED_SPEAKERS,
    MAX_TEXT_LENGTH,
    MIN_PACE,
    MAX_PACE,
)
from .schemas import TTSSynthesizeRequest, TTSSuccessResponse, TTSErrorResponse
from .service import tts_service, TTSException

logger = logging.getLogger("medikiosk.tts.router")

router = APIRouter(prefix="/api/tts", tags=["Text-to-Speech"])


@router.post(
    "/synthesize",
    response_model=TTSSuccessResponse,
    responses={
        400: {"model": TTSErrorResponse, "description": "Validation error (empty text, invalid language, invalid pace)"},
        401: {"model": TTSErrorResponse, "description": "Authentication failure with Sarvam"},
        429: {"model": TTSErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": TTSErrorResponse, "description": "Configuration or internal server error"},
        502: {"model": TTSErrorResponse, "description": "Upstream speech service error"},
    },
    summary="Synthesize Speech Audio via Sarvam Bulbul v3",
    description="Synthesizes input text in Indian languages or Indian English into base64-encoded WAV audio.",
)
async def synthesize_speech(request: TTSSynthesizeRequest):
    """
    Text-to-Speech synthesis endpoint for MediKiosk.
    Synthesizes clinical prompts and conversation into patient-facing speech audio.
    """
    # 1. Validate text presence and whitespace
    clean_text = request.text.strip()
    if not clean_text:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "Text cannot be empty"},
        )

    # 2. Validate maximum character limit
    if len(clean_text) > MAX_TEXT_LENGTH:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Text exceeds the maximum allowed length of {MAX_TEXT_LENGTH} characters",
            },
        )

    # 3. Validate language code
    target_lang = request.language_code.strip()
    if not target_lang:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "language_code is required"},
        )

    if target_lang not in SUPPORTED_TTS_LANGUAGES:
        supported_str = ", ".join(sorted(SUPPORTED_TTS_LANGUAGES))
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Unsupported language_code '{target_lang}'. Supported: {supported_str}",
            },
        )

    # 4. Validate speaker
    speaker = (request.speaker or "simran").strip().lower()
    if speaker not in SUPPORTED_SPEAKERS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Unsupported speaker '{request.speaker}'.",
            },
        )

    # 5. Validate pace
    pace = request.pace if request.pace is not None else 1.0
    if pace < MIN_PACE or pace > MAX_PACE:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Pace must be between {MIN_PACE} and {MAX_PACE}",
            },
        )

    try:
        result = tts_service.synthesize(
            text=clean_text,
            language_code=target_lang,
            speaker=speaker,
            pace=pace,
        )
        return result

    except TTSException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": exc.message},
        )

    except Exception as exc:
        logger.exception("Unexpected error in /api/tts/synthesize handler")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": "An internal server error occurred while synthesizing speech."},
        )
