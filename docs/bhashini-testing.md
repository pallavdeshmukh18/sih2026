# Bhashini Speech Services (ASR & TTS) Testing & Verification Guide

This guide details how to verify and test the standalone **Bhashini ASR (Speech-to-Text)** and **Bhashini TTS (Text-to-Speech)** pipeline independently using **Postman** or **cURL** before connecting it into the MediKiosk application flow.

---

## 1. Overview & Architecture

Bhashini (Dhruva) services use a centralized ULCA pipeline inference endpoint:
- **Inference URL**: `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`
- **Protocol**: HTTP POST (JSON body)
- **Supported Languages for MediKiosk**:
  - **Hindi (`hi`)**
  - **Marathi (`mr`)**
  - **English (`en`)**

### Two-Phase Bhashini Workflow
1. **Model Discovery / Pipeline Config (Optional/Pre-requisite)**: A configuration call (`/ulca/apis/v0/model/getModelsPipeline`) can be made using the `BHASHINI_UDYAT_API_KEY` to discover available models and active `serviceId`s for each task and language pair.
2. **Inference Execution**: Direct calls are made to `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` using the `BHASHINI_INFERENCE_API_KEY` in the `Authorization` header and the specific `serviceId` inside each task's `config`.

---

## 2. Environment Variables Configuration

Configure your `ML/.env` file with your credentials:

```bash
# Bhashini Credentials
BHASHINI_UDYAT_API_KEY=your_bhashini_udyat_key_here
BHASHINI_INFERENCE_API_KEY=your_bhashini_inference_key_here
BHASHINI_INFERENCE_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline

# Bhashini ASR Service IDs (Discovered per language)
BHASHINI_ASR_SERVICE_ID_HI=YOUR_ASR_SERVICE_ID_HI
BHASHINI_ASR_SERVICE_ID_MR=YOUR_ASR_SERVICE_ID_MR
BHASHINI_ASR_SERVICE_ID_EN=YOUR_ASR_SERVICE_ID_EN

# Bhashini TTS Service IDs (Discovered per language)
BHASHINI_TTS_SERVICE_ID_HI=YOUR_TTS_SERVICE_ID_HI
BHASHINI_TTS_SERVICE_ID_MR=YOUR_TTS_SERVICE_ID_MR
BHASHINI_TTS_SERVICE_ID_EN=YOUR_TTS_SERVICE_ID_EN
```

> **IMPORTANT**:
> - Never commit real credentials to GitHub.
> - `BHASHINI_INFERENCE_API_KEY` is passed directly in the HTTP `Authorization` header. Do **not** prefix it with `Bearer ` unless your specific Bhashini tenant instructions require it.
> - Actual `serviceId`s are provider-specific and must be discovered from your Bhashini account or pipeline config response.

---

## 3. Postman Setup

### Common Request Headers
Set the following headers on all inference requests in Postman:

| Key | Value | Description |
|---|---|---|
| `Authorization` | `{{BHASHINI_INFERENCE_API_KEY}}` | Bhashini Inference API Token |
| `Content-Type` | `application/json` | JSON request payload |
| `Accept` | `application/json` | JSON response payload |

---

## 4. Testing Speech-to-Text (ASR) via Postman

### Step 1: Prepare Test Audio to Base64
Bhashini requires audio files (e.g. 16kHz mono `.wav`) to be Base64-encoded as a string.

You can encode audio on Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("sample.wav")) | Set-Clipboard
```
*(This copies the Base64 string directly to your clipboard)*

### Step 2: Postman Request Configuration
- **Method**: `POST`
- **URL**: `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`
- **Headers**:
  ```http
  Authorization: {{BHASHINI_INFERENCE_API_KEY}}
  Content-Type: application/json
  Accept: application/json
  ```

### Example ASR Payloads

#### A. Hindi ASR Request (`hi`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "asr",
      "config": {
        "language": {
          "sourceLanguage": "hi"
        },
        "serviceId": "YOUR_ASR_SERVICE_ID_HI",
        "audioFormat": "wav",
        "samplingRate": 16000
      }
    }
  ],
  "inputData": {
    "audio": [
      {
        "audioContent": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
      }
    ]
  }
}
```

#### B. Marathi ASR Request (`mr`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "asr",
      "config": {
        "language": {
          "sourceLanguage": "mr"
        },
        "serviceId": "YOUR_ASR_SERVICE_ID_MR",
        "audioFormat": "wav",
        "samplingRate": 16000
      }
    }
  ],
  "inputData": {
    "audio": [
      {
        "audioContent": "PASTE_YOUR_BASE64_AUDIO_HERE"
      }
    ]
  }
}
```

#### C. English ASR Request (`en`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "asr",
      "config": {
        "language": {
          "sourceLanguage": "en"
        },
        "serviceId": "YOUR_ASR_SERVICE_ID_EN",
        "audioFormat": "wav",
        "samplingRate": 16000
      }
    }
  ],
  "inputData": {
    "audio": [
      {
        "audioContent": "PASTE_YOUR_BASE64_AUDIO_HERE"
      }
    ]
  }
}
```

### Expected ASR Response Structure
```json
{
  "pipelineResponse": [
    {
      "taskType": "asr",
      "config": {
        "serviceId": "YOUR_ASR_SERVICE_ID",
        "language": {
          "sourceLanguage": "hi"
        },
        "audioFormat": "wav"
      },
      "output": [
        {
          "source": "मुझे पिछले दो दिनों से बुखार और सिरदर्द है।"
        }
      ]
    }
  ]
}
```
*Note: In Bhashini ASR, the transcribed text is located at `pipelineResponse[0].output[0].source` (or in some models `target`).*

---

## 5. Testing Text-to-Speech (TTS) via Postman

- **Method**: `POST`
- **URL**: `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`
- **Headers**:
  ```http
  Authorization: {{BHASHINI_INFERENCE_API_KEY}}
  Content-Type: application/json
  Accept: application/json
  ```

### Example TTS Payloads

#### A. Hindi TTS Request (`hi`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "tts",
      "config": {
        "language": {
          "sourceLanguage": "hi"
        },
        "serviceId": "YOUR_TTS_SERVICE_ID_HI",
        "gender": "female",
        "samplingRate": 22050
      }
    }
  ],
  "inputData": {
    "input": [
      {
        "source": "नमस्ते, मेडीकियोस्क में आपका स्वागत है। कृपया अपनी समस्या बताएं।"
      }
    ]
  }
}
```

#### B. Marathi TTS Request (`mr`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "tts",
      "config": {
        "language": {
          "sourceLanguage": "mr"
        },
        "serviceId": "YOUR_TTS_SERVICE_ID_MR",
        "gender": "female",
        "samplingRate": 22050
      }
    }
  ],
  "inputData": {
    "input": [
      {
        "source": "नमस्कार, मेडीकिओस्क मध्ये आपले स्वागत आहे. कृपया तुमची लक्षणे सांगा."
      }
    ]
  }
}
```

#### C. English TTS Request (`en`)
```json
{
  "pipelineTasks": [
    {
      "taskType": "tts",
      "config": {
        "language": {
          "sourceLanguage": "en"
        },
        "serviceId": "YOUR_TTS_SERVICE_ID_EN",
        "gender": "female",
        "samplingRate": 22050
      }
    }
  ],
  "inputData": {
    "input": [
      {
        "source": "Welcome to MediKiosk. Please describe your symptoms to begin your clinical assessment."
      }
    ]
  }
}
```

### Expected TTS Response Structure
```json
{
  "pipelineResponse": [
    {
      "taskType": "tts",
      "config": {
        "serviceId": "YOUR_TTS_SERVICE_ID",
        "language": {
          "sourceLanguage": "hi"
        },
        "gender": "female",
        "samplingRate": 22050
      },
      "audio": [
        {
          "audioContent": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
        }
      ]
    }
  ]
}
```

### Playing Back TTS Audio from Postman
The returned `audioContent` string is Base64-encoded WAV audio.
To verify audio playback in Postman, add this snippet under the **Tests** tab of your Postman request:

```javascript
const response = pm.response.json();
const base64Audio = response.pipelineResponse[0].audio[0].audioContent;

pm.visualizer.set(`
  <audio controls autoplay>
    <source src="data:audio/wav;base64,${base64Audio}" type="audio/wav">
    Your browser does not support audio playback.
  </audio>
`);
```
Then click the **Visualize** tab in the Postman response window to listen to the audio directly.

---

## 6. Testing via Python Service Layer (Standalone)

You can test the implementation directly in Python once your `.env` contains valid service IDs and inference keys:

### A. Testing Bhashini STT (ASR)
```python
from stt.bhashini import BhashiniSTT

stt = BhashiniSTT()

with open("sample_hindi.wav", "rb") as f:
    audio_bytes = f.read()

# Transcribe Hindi audio
text = stt.transcribe(audio_bytes=audio_bytes, language="hi")
print(f"Recognized Text: {text}")
```

### B. Testing Bhashini TTS
```python
from tts.bhashini import BhashiniTTS

tts = BhashiniTTS()

# Synthesize Marathi speech
audio_bytes, metadata = tts.synthesize(
    text="तुमची तपासणी पूर्ण झाली आहे.",
    language="mr",
    gender="female"
)

# Save audio to disk
with open("output_marathi.wav", "wb") as f:
    f.write(audio_bytes)

print(f"Generated {len(audio_bytes)} bytes of audio. Metadata: {metadata}")
```

### C. Testing Provider-Agnostic Facade (`STTService` / `TTSService`)
```python
from stt.service import STTService
from tts.service import TTSService

# Select Bhashini as provider explicitly
stt_service = STTService(provider="bhashini")
tts_service = TTSService(provider="bhashini")

# Transcribe
transcript = stt_service.transcribe(audio_bytes=audio_bytes, language="hi")

# Synthesize
audio_bytes, meta = tts_service.synthesize(text=transcript, language="hi")
```

---

## 7. Discovering Actual Bhashini Service IDs

If you only have `BHASHINI_UDYAT_API_KEY` and need to look up active `serviceId`s for Hindi, Marathi, and English:

Send a POST request to:
- **URL**: `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline`
- **Headers**:
  ```http
  ulcaApiKey: {{BHASHINI_UDYAT_API_KEY}}
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "pipelineTasks": [
      {
        "taskType": "asr",
        "config": {
          "language": {
            "sourceLanguage": "hi"
          }
        }
      },
      {
        "taskType": "tts",
        "config": {
          "language": {
            "sourceLanguage": "hi"
          }
        }
      }
    ],
    "pipelineRequestConfig": {
      "pipelineId": "64392f96daac500b55c543d6"
    }
  }
  ```
The response will provide:
1. `pipelineResponseConfig[].config[].serviceId` for the requested language.
2. `pipelineInferenceAPIEndPoint.inferenceApiKey.value` (the active inference key to populate `BHASHINI_INFERENCE_API_KEY`).

---

## 8. Common Errors & Troubleshooting

| Status Code / Error | Cause | Resolution |
|---|---|---|
| `401 Unauthorized` | Invalid `BHASHINI_INFERENCE_API_KEY` | Check key in `Authorization` header. Ensure it is the inference key, not the Udyat key. |
| `400 Bad Request` | Unsupported language or missing/invalid `serviceId` | Verify that `serviceId` exists and corresponds to the exact `sourceLanguage`. |
| `429 Too Many Requests` | Rate limit on Bhashini API quota | Back off and retry; check quota allocated in Bhashini dashboard. |
| `504 Gateway Timeout` | Large audio payload or high upstream latency | Ensure audio duration is under 30 seconds and sampling rate is 16000 Hz. |
| `MissingServiceIdError` | Environment variable not set in `.env` | Set `BHASHINI_ASR_SERVICE_ID_{HI,MR,EN}` and `BHASHINI_TTS_SERVICE_ID_{HI,MR,EN}`. |
| `InvalidAudioDataError` | 0-byte audio or empty text | Pass non-empty audio bytes for STT and non-empty string for TTS. |
