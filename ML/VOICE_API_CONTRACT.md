# MediKiosk Voice API Integration Contract

> **Target Audience**: 
> - **Param** (Conversational AI / Clinical LLM)
> - **Vedansh** (Core Backend / Node.js & Gateway Integration)
> - **Nisarg** (Frontend & Kiosk Touch/Voice UI)
> 
> **Service Owner**: **Anuj** (Voice / Speech Layer)

---

## 1. Architectural Principle & Security Boundary

```
[Patient Kiosk / Frontend (Nisarg)]
          │ (Microphone Audio Blob)
          ▼
[Backend Gateway (Vedansh) / ML Service] ───► [STT API: POST /api/stt/transcribe]
                                                        │ (Internal Sarvam Call)
                                                        ▼
                                                 Transcript JSON
                                                        │
                                                        ▼
                                         [Conversational AI (Param)]
                                                        │
                                                        ▼
                                                 Next Question Text
                                                        │
[Patient Kiosk / Frontend (Nisarg)] ◄─── Audio ◄─ [TTS API: POST /api/tts/synthesize]
          (HTML5 Audio Playback)   (Base64 WAV)         │ (Internal Sarvam Call)
                                                        ▼
```

### Critical Security Rule:
- **Never call Sarvam AI directly from the frontend or core backend.**
- **The Sarvam API subscription key stays strictly server-side** within `ML/.env`.
- All clinical speech operations must pass through our local endpoints:
  - `POST /api/stt/transcribe`
  - `POST /api/tts/synthesize`

---

## 2. Speech-to-Text (STT) Contract

### `POST /api/stt/transcribe`
Transcribes patient speech while **preserving the original spoken language** (Hindi, Marathi, Indian English, etc.). It does **not** translate the text.

- **URL**: `http://localhost:8000/api/stt/transcribe`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`

#### Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | Binary File | **Yes** | Audio file. Supported formats: `.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`, `.flac`. Max size: **25 MB**. Max duration: **30 seconds** (recommended). |
| `language_code` | Form Text | Optional | BCP-47 language code (e.g., `hi-IN`, `mr-IN`, `en-IN`). **Omit to enable automatic language detection**. |

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "transcript": "मुझे तीन दिन से सीने में दर्द हो रहा है।",
  "language_code": "hi-IN",
  "request_id": "20260905_5775332c-a1d3-45b2-be5e-9d535cb2fe12",
  "language_probability": 0.98
}
```

#### Field Descriptions:
- `success` (`bool`): Always `true` on successful transcription.
- `transcript` (`string`): Verbatim transcription in the patient's spoken regional script.
- `language_code` (`string | null`): Detected or provided BCP-47 language code (e.g. `hi-IN`, `mr-IN`, `en-IN`).
- `request_id` (`string | null`): Unique vendor request ID for debugging/tracing.
- `language_probability` (`float | null`): Confidence score of language detection (if provided by Sarvam).

---

## 3. Text-to-Speech (TTS) Contract

### `POST /api/tts/synthesize`
Converts clinical questions or instructions into natural, Indian-accented spoken audio in WAV format.

- **URL**: `http://localhost:8000/api/tts/synthesize`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### Request JSON Schema
```json
{
  "text": "Welcome to MediKiosk. Please tell me what brings you to the hospital today.",
  "language_code": "en-IN",
  "speaker": "shubh",
  "pace": 1.0
}
```

#### Request Fields
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `string` | **Yes** | — | Clinical text to speak. Length: **1 to 2500 characters**. Supports native regional scripts and code-mixed Indian English. |
| `language_code` | `string` | **Yes** | — | BCP-47 language code. **Required** (no auto-detect for TTS). |
| `speaker` | `string` | Optional | `"shubh"` | Speaker voice identifier. Default: `"shubh"`. |
| `pace` | `float` | Optional | `1.0` | Speech pace multiplier. Range: `0.5` to `2.0`. |

#### Supported BCP-47 Language Codes for TTS:
- `en-IN` (Indian English)
- `hi-IN` (Hindi)
- `mr-IN` (Marathi)
- `bn-IN` (Bengali)
- `ta-IN` (Tamil)
- `te-IN` (Telugu)
- `kn-IN` (Kannada)
- `ml-IN` (Malayalam)
- `gu-IN` (Gujarati)
- `pa-IN` (Punjabi)
- `od-IN` (Odia)

#### Popular Speaker Voices:
- `"shubh"` (Male, default — professional, warm)
- `"priya"` (Female — gentle, clear)
- `"rohan"` (Male — confident, conversational)
- `"neha"` (Female — soft, patient-centric)
- `"aditya"` (Male — formal)

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "request_id": "20260905_5775332c-a1d3-45b2-be5e-9d535cb2fe12",
  "audio_base64": "UklGRiTQAgBXQVZFZm10IBAAAAABAAEA...",
  "audio_format": "wav",
  "language_code": "en-IN",
  "speaker": "shubh"
}
```

#### Field Descriptions:
- `success` (`bool`): Always `true` on successful synthesis.
- `request_id` (`string | null`): Unique vendor request ID.
- `audio_base64` (`string`): Standard Base64 encoded WAV audio bytes (24,000 Hz, 16-bit PCM).
- `audio_format` (`string`): Always `"wav"`.
- `language_code` (`string`): The synthesized language code.
- `speaker` (`string`): The speaker voice used.

---

## 4. Error Handling Contract (Both APIs)

All error responses return standard JSON with `success: false` and a human-readable `error` description:

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

### Standard HTTP Status Codes:
| Status Code | Scenario | Example Error Message |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Validation failure | `"Audio file is required"`<br>`"Unsupported audio format '.mp4'"`<br>`"Text cannot be empty"`<br>`"Text exceeds the maximum allowed length of 2500 characters"`<br>`"Unsupported language_code 'fr-FR'"`<br>`"Pace must be between 0.5 and 2.0"` |
| **`401 Unauthorized`** | Backend Sarvam key invalid | `"Speech service authentication failed"` |
| **`429 Too Many Requests`** | Sarvam rate limit exceeded | `"Speech service rate limit exceeded. Please try again later."` |
| **`500 Internal Error`** | Server configuration issue | `"Sarvam API key is not configured or contains placeholder text."` |
| **`502 Bad Gateway`** | Upstream Sarvam service down | `"Speech service unavailable. Please try again later."` |

---

## 5. Team Integration Guides & Code Snippets

### For Param (Conversational AI / Python)
```python
import requests

# 1. Transcribe incoming patient audio
with open("patient_audio.wav", "rb") as f:
    stt_res = requests.post(
        "http://localhost:8000/api/stt/transcribe",
        files={"file": ("audio.wav", f, "audio/wav")},
        data={"language_code": "hi-IN"}  # or omit for auto-detect
    ).json()

patient_text = stt_res["transcript"]
patient_lang = stt_res["language_code"] or "hi-IN"

# 2. Formulate doctor/kiosk clinical question via your LLM
next_question = generate_clinical_prompt(patient_text)

# 3. Synthesize speech for the patient
tts_res = requests.post(
    "http://localhost:8000/api/tts/synthesize",
    json={
        "text": next_question,
        "language_code": patient_lang,
        "speaker": "shubh",
        "pace": 1.0
    }
).json()

audio_base64 = tts_res["audio_base64"]
```

---

### For Vedansh (Backend / Node.js Express Gateway)
```javascript
const axios = require('axios');
const FormData = require('form-data');

// 1. Forward audio stream to STT
async function transcribeAudio(audioBuffer, originalName, languageCode) {
  const form = new FormData();
  form.append('file', audioBuffer, { filename: originalName });
  if (languageCode) form.append('language_code', languageCode);

  const response = await axios.post('http://localhost:8000/api/stt/transcribe', form, {
    headers: form.getHeaders(),
  });
  return response.data; // { success, transcript, language_code, request_id }
}

// 2. Request synthesized voice for patient
async function synthesizeSpeech(text, languageCode = 'en-IN', speaker = 'shubh') {
  const response = await axios.post('http://localhost:8000/api/tts/synthesize', {
    text,
    language_code: languageCode,
    speaker,
    pace: 1.0,
  });
  return response.data; // { success, audio_base64, audio_format, language_code, speaker }
}
```

---

### For Nisarg (Frontend / Web & Kiosk UI)

#### Playing the Generated Audio in Browser:
```javascript
// Given the JSON response from /api/tts/synthesize:
function playSynthesizedAudio(ttsResponse) {
  if (!ttsResponse.success || !ttsResponse.audio_base64) {
    console.error("Audio synthesis failed:", ttsResponse.error);
    return;
  }
  
  const audioSrc = `data:audio/wav;base64,${ttsResponse.audio_base64}`;
  const player = new Audio(audioSrc);
  player.play();
}
```

#### Uploading Recorded Microphone Audio:
```javascript
async function uploadPatientAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'patient_intake.wav');
  // Optional: formData.append('language_code', 'hi-IN');

  const res = await fetch('http://localhost:8000/api/stt/transcribe', {
    method: 'POST',
    body: formData,
  });
  return await res.json();
}
```

---

## 6. How to Run the Voice Service Locally

```bash
# 1. From the repository root:
python -m uvicorn ML.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Interactive Swagger documentation:
http://localhost:8000/docs

# 3. Health Check:
http://localhost:8000/health
```
