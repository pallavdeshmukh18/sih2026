# MediKiosk Voice & Speech Services (STT & TTS)

MediKiosk utilizes Sarvam AI's models to handle multilingual voice interactions for clinical patient intake in Indian hospitals:
- **Speech-to-Text (STT)**: Uses **Sarvam Saaras (`saaras:v4`)** in native transcription mode to transcribe patient speech into regional languages.
- **Text-to-Speech (TTS)**: Uses **Sarvam Bulbul (`bulbul:v3`)** to synthesize conversational clinical prompts into natural Indian-accented speech (WAV audio).

---

## 1. Eventual Interaction Flow

```
Patient microphone
    ↓
STT API (/api/stt/transcribe)
    ↓
Transcript
    ↓
Conversational AI (Param)
    ↓
Response text
    ↓
TTS API (/api/tts/synthesize)
    ↓
Audio (WAV)
    ↓
Patient
```

> [!IMPORTANT]
> **API Integration Contract Available**: For full integration specifications tailored for **Param** (Conversational AI), **Vedansh** (Backend Gateway), and **Nisarg** (Frontend UI), refer to [`VOICE_API_CONTRACT.md`](./VOICE_API_CONTRACT.md).
> 
> **Security Principle**: Other services must call `/api/stt` and `/api/tts`. Never call Sarvam directly or expose the Sarvam API subscription key outside the ML server.

---

## 2. Directory Structure

```
ML/
├── VOICE_API_CONTRACT.md     # Team integration contract (Param / Vedansh / Nisarg)
├── .env.example              # Template for environment variables
├── requirements.txt          # Python dependencies
├── README.md                 # This documentation
├── main.py                   # FastAPI service entry point & GET /health
├── stt/                      # Speech-to-Text module
│   ├── __init__.py
│   ├── config.py             # STT config & shared .env loader
│   ├── schemas.py            # STT Pydantic schemas
│   ├── service.py            # Sarvam Saaras SDK client
│   └── router.py             # POST /api/stt/transcribe
├── tts/                      # Text-to-Speech module
│   ├── __init__.py
│   ├── config.py             # TTS config & constraints (speakers, languages, pace)
│   ├── schemas.py            # TTS Pydantic schemas
│   ├── service.py            # Sarvam Bulbul v3 SDK client
│   ├── router.py             # POST /api/tts/synthesize
│   ├── decode_audio.py       # Development utility to decode Base64 into playable .wav
│   └── test_response.example.json
└── tests/
    ├── __init__.py
    ├── test_stt.py           # STT unit tests (mocked, 0 credits)
    └── test_tts.py           # TTS unit tests (mocked, 0 credits)
```

---

## 3. Environment Variables & Setup

Create or update a `.env` file in `ML/.env` or `chatbot/.env`:

```env
# Sarvam API subscription key (also accepts 'sarvam')
SARVAM_API_KEY=your_actual_sarvam_api_key

# Optional model configurations (defaults are used if omitted)
SARVAM_STT_MODEL=saaras:v4
SARVAM_TTS_MODEL=bulbul:v3
```

### Installation:
```bash
pip install -r ML/requirements.txt
```

### Running Locally:
```bash
python -m uvicorn ML.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 4. Voice API Integration

### A. Speech-to-Text (STT) Integration

- **What it does**: Ingests patient audio files, detects the regional language (or uses an explicit language code), and returns the verbatim transcription in the original language.
- **Endpoint**: `POST /api/stt/transcribe`
- **Content-Type**: `multipart/form-data`

#### Input Parameters:
- `file` (*binary file*, **required**): Audio file (`.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`, `.flac`). Max 25 MB.
- `language_code` (*string*, *optional*): BCP-47 language code (`hi-IN`, `mr-IN`, `en-IN`, etc.). Omit for automatic detection.

#### Example Request (Python):
```python
import requests

with open("patient_voice.wav", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/stt/transcribe",
        files={"file": ("voice.wav", f, "audio/wav")},
        data={"language_code": "hi-IN"}  # optional
    )
print(response.json())
```

#### Example STT Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "transcript": "मुझे तीन दिन से सीने में दर्द हो रहा है।",
  "language_code": "hi-IN",
  "request_id": "20260905_5775332c-a1d3-45b2-be5e-9d535cb2fe12",
  "language_probability": 0.98
}
```

---

### B. Text-to-Speech (TTS) Integration

- **What it does**: Synthesizes clinical question text into natural, Indian-accented speech audio encoded as a Base64 WAV string.
- **Endpoint**: `POST /api/tts/synthesize`
- **Content-Type**: `application/json`

#### Input Parameters:
- `text` (*string*, **required**): 1 to 2500 characters. Supports regional languages and code-mixed speech.
- `language_code` (*string*, **required**): BCP-47 code (e.g. `en-IN`, `hi-IN`, `mr-IN`).
- `speaker` (*string*, *optional*): Default `"shubh"`. Other options: `"priya"`, `"rohan"`, `"neha"`, `"aditya"`, etc.
- `pace` (*float*, *optional*): Default `1.0`. Allowed range: `0.5` to `2.0`.

#### Example Request (Python):
```python
import requests

response = requests.post(
    "http://localhost:8000/api/tts/synthesize",
    json={
        "text": "मेडीकियोस्क में आपका स्वागत है। आज आप कैसा महसूस कर रहे हैं?",
        "language_code": "hi-IN",
        "speaker": "shubh",
        "pace": 1.0
    }
)
print(response.json())
```

#### Example TTS Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "request_id": "20260905_5775332c-a1d3-45b2-be5e-9d535cb2fe12",
  "audio_base64": "UklGRiTQAgBXQVZFZm10IBAAAAABAAEA...",
  "audio_format": "wav",
  "language_code": "hi-IN",
  "speaker": "shubh"
}
```

#### Playing the Generated Audio in Web Frontend:
```javascript
const audio = new Audio("data:audio/wav;base64," + response.audio_base64);
audio.play();
```

---

## 5. Expected Errors & Failure Behavior

All failures across both endpoints return standard JSON with `success: false` and a clear `error` description:

```json
{
  "success": false,
  "error": "Error description here"
}
```

| HTTP Status | Trigger Conditions | Example Message |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Validation failure | `"Audio file is required"`<br>`"Unsupported audio format '.mp4'"`<br>`"Text cannot be empty"`<br>`"Text exceeds the maximum allowed length of 2500 characters"`<br>`"Unsupported language_code 'xyz'"`<br>`"Pace must be between 0.5 and 2.0"` |
| **`401 Unauthorized`** | Invalid/expired Sarvam API key | `"Speech service authentication failed"` |
| **`429 Too Many Requests`** | Sarvam account rate limit hit | `"Speech service rate limit exceeded. Please try again later."` |
| **`500 Internal Error`** | Server configuration issue | `"Sarvam API key is not configured or contains placeholder text."` |
| **`502 Bad Gateway`** | Upstream Sarvam service down | `"Speech service unavailable. Please try again later."` |

---

## 6. Automated Testing

Run the full mock unit test suite (24 tests, 0 API credits used):

```bash
pytest ML/tests/test_stt.py ML/tests/test_tts.py -v
```

---

## 7. Local Audio Decoding Utility

To verify generated TTS audio locally:
1. Save the JSON response to `ML/tts/test_response.json`
2. Run:
   ```bash
   python ML/tts/decode_audio.py ML/tts/test_response.json
   ```
3. The playable WAV file is saved to `ML/tts/output/test_output.wav`. Play it via:
   ```powershell
   start ML\tts\output\test_output.wav
   ```
