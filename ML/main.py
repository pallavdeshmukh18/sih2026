import logging
import sys
from pathlib import Path

# Ensure ML directory is on sys.path so stt package can be imported regardless of execution root
_ml_dir = Path(__file__).resolve().parent
if str(_ml_dir) not in sys.path:
    sys.path.insert(0, str(_ml_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from stt.router import router as stt_router
from tts.router import router as tts_router
from stt.schemas import HealthResponse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("medikiosk.ml")

# Create FastAPI application
app = FastAPI(
    title="MediKiosk ML & Voice Service",
    description="Speech-to-Text and Machine Learning ingestion services for the MediKiosk Clinical Intake platform.",
    version="1.0.0",
)

# Allow CORS for development and cross-origin kiosk/frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register health check endpoint
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
    description="Returns service operational status without calling external dependencies.",
)
async def health_check():
    return HealthResponse(status="ok")


# Include STT and TTS routers
app.include_router(stt_router)
app.include_router(tts_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
