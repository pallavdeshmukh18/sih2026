import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import JSONResponse

from .config import SUPPORTED_AUDIO_EXTENSIONS, MAX_AUDIO_FILE_SIZE_BYTES
from .schemas import STTSuccessResponse, STTErrorResponse
from .service import stt_service, STTException

logger = logging.getLogger("medikiosk.stt.router")

router = APIRouter(prefix="/api/stt", tags=["Speech-to-Text"])


@router.post(
    "/transcribe",
    response_model=STTSuccessResponse,
    responses={
        400: {"model": STTErrorResponse, "description": "Validation error or invalid audio"},
        401: {"model": STTErrorResponse, "description": "Authentication failure with Sarvam"},
        429: {"model": STTErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": STTErrorResponse, "description": "Server configuration or internal error"},
        502: {"model": STTErrorResponse, "description": "Upstream speech service error"},
    },
    summary="Transcribe Patient Audio via Sarvam AI",
    description="Accepts an audio file in multipart/form-data, sends it to Sarvam Saaras STT in transcribe mode, and returns the transcript.",
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file (.wav, .mp3, .m4a, .webm, .ogg, .flac)"),
    language_code: Optional[str] = Form(
        None,
        description="Optional BCP-47 language code (e.g., 'hi-IN', 'mr-IN', 'en-IN'). Omit for auto-detection.",
    ),
):
    """
    Speech-to-text endpoint for MediKiosk.
    Processes patient audio and returns transcription preserving native language.
    """
    # 1. Validate file presence
    if not file or not file.filename:
        logger.warning("STT transcribe rejected: No audio file provided in request")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "Audio file is required"},
        )

    # 2. Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_AUDIO_EXTENSIONS:
        supported_str = ", ".join(sorted(SUPPORTED_AUDIO_EXTENSIONS))
        logger.warning("STT transcribe rejected: Unsupported audio extension '%s'", file_ext)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Unsupported audio format '{file_ext}'. Supported formats: {supported_str}",
            },
        )

    try:
        # Read file contents into memory
        audio_bytes = await file.read()

        # Validate that file is not empty
        if len(audio_bytes) == 0:
            logger.warning("STT transcribe rejected: Uploaded file '%s' is 0 bytes", file.filename)
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "error": "Audio file is empty"},
            )

        # Validate file size limit
        if len(audio_bytes) > MAX_AUDIO_FILE_SIZE_BYTES:
            max_mb = MAX_AUDIO_FILE_SIZE_BYTES // (1024 * 1024)
            logger.warning(
                "STT transcribe rejected: File '%s' exceeds max size (%d bytes)",
                file.filename,
                len(audio_bytes),
            )
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "error": f"Audio file exceeds maximum allowed size of {max_mb} MB",
                },
            )

        # 3. Process transcription via Sarvam STT service
        result = stt_service.transcribe_audio(
            file_content=audio_bytes,
            filename=file.filename,
            content_type=file.content_type,
            language_code=language_code,
        )

        return result

    except STTException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": exc.message},
        )

    except Exception as exc:
        logger.exception("Unexpected error in /api/stt/transcribe handler")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": "An internal server error occurred while processing the audio."},
        )
    finally:
        await file.close()
