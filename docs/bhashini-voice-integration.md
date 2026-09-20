# MediKiosk Voice Layer: Bhashini & Sarvam Integration

## 1. Architectural Overview

The MediKiosk Voice Layer provides a robust, multi-lingual, multi-tier speech processing architecture for kiosk and remote telemedicine interactions. 

### Provider Hierarchy
- **Primary Provider**: **Bhashini** (National Language Translation Mission, MeitY, Govt. of India)
  - STT/ASR Service ID: `bhashini/ai4bharat/conformer-multilingual-asr`
  - TTS Service ID: `Bhashini/IITM/TTS`
- **Fallback Provider**: **Sarvam AI**
  - Used automatically when Bhashini encounters network timeouts, HTTP errors, upstream service disruptions, or rate limits.
  - Can also be explicitly requested via `provider="sarvam"`.

### End-to-End Voice Flow

```text
       +-----------------------------------------------------+
       |                  PATIENT / KIOSK                    |
       +-----------------------------------------------------+
                                  |
                   [1. Audio Input (WAV / WebM)]
                                  v
       +-----------------------------------------------------+
       |                 FastAPI STT Router                  |
       |             POST /api/stt/transcribe                |
       +-----------------------------------------------------+
                                  |
                                  v
       +-----------------------------------------------------+
       |                     STTService                      |
       |  +-----------------------------------------------+  |
       |  | PRIMARY: BhashiniSTT                          |  |
       |  | (bhashini/ai4bharat/conformer-multilingual)   |  |
       |  +-----------------------------------------------+  |
       |                          |                          |
       |            [Failure]     v     [Success]            |
       |  +-----------------------+-----------------------+  |
       |  | FALLBACK: SarvamSTT   | Transcribed Text      |  |
       |  +-----------------------+-----------------------+  |
       +-----------------------------------------------------+
                                  |
                                  v
       +-----------------------------------------------------+
       |                 MediKiosk Clinical AI               |
       |             (Triage / Reasoning / Advice)           |
       +-----------------------------------------------------+
                                  |
                    [Response Text in Language]
                                  v
       +-----------------------------------------------------+
       |                 FastAPI TTS Router                  |
       |             POST /api/tts/synthesize                |
       +-----------------------------------------------------+
                                  |
                                  v
       +-----------------------------------------------------+
       |                     TTSService                      |
       |  +-----------------------------------------------+  |
       |  | PRIMARY: BhashiniTTS                          |  |
       |  | (Bhashini/IITM/TTS)                           |  |
       |  +-----------------------------------------------+  |
       |                          |                          |
       |            [Failure]     v     [Success]            |
       |  +-----------------------+-----------------------+  |
       |  | FALLBACK: SarvamTTS   | Audio Base64 / Bytes  |  |
       |  +-----------------------+-----------------------+  |
       +-----------------------------------------------------+
                                  |
                   [Audio Output (Playback / WAV)]
                                  v
       +-----------------------------------------------------+
       |                  PATIENT / KIOSK                    |
       +-----------------------------------------------------+
```

---

## 2. Supported Languages & Normalization

Both ISO-639-1 language codes and common locale tags are accepted and normalized automatically:

| Language | Primary Code | Locale Form | Bhashini ASR Supported | Bhashini TTS Supported |
|----------|--------------|-------------|-------------------------|-------------------------|
| Hindi    | `hi`         | `hi-IN`     | Yes                     | Yes                     |
| Marathi  | `mr`         | `mr-IN`     | Yes                     | Yes                     |
| English  | `en`         | `en-IN`     | Yes                     | Yes                     |

Unsupported languages are rejected with clean application-level validation errors (`HTTP 422` / `BhashiniConfigError`), avoiding silent conversion or corrupted transcriptions.

---

## 3. Environment Configuration

All credentials and service IDs are loaded server-side inside `ML/.env`. They are never passed to or exposed on the React frontend.

```env
# Bhashini API Configuration
BHASHINI_UDYAT_API_KEY=<your_bhashini_udyat_key>
BHASHINI_INFERENCE_API_KEY=<your_bhashini_inference_key>
BHASHINI_INFERENCE_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline

# Verified Bhashini ASR Service IDs
BHASHINI_ASR_SERVICE_ID_HI=bhashini/ai4bharat/conformer-multilingual-asr
BHASHINI_ASR_SERVICE_ID_MR=bhashini/ai4bharat/conformer-multilingual-asr
BHASHINI_ASR_SERVICE_ID_EN=bhashini/ai4bharat/conformer-multilingual-asr

# Verified Bhashini TTS Service IDs
BHASHINI_TTS_SERVICE_ID_HI=Bhashini/IITM/TTS
BHASHINI_TTS_SERVICE_ID_MR=Bhashini/IITM/TTS
BHASHINI_TTS_SERVICE_ID_EN=Bhashini/IITM/TTS

# Sarvam API Configuration (Fallback)
SARVAM_API_KEY=<your_sarvam_api_key>
```

---

## 4. Provider Selection & Fallback Behavior

### Default Behavior
When calling `stt_service.transcribe(...)` or `tts_service.synthesize(...)` without an explicit provider or with `provider="bhashini"`:
1. `BhashiniSTT` / `BhashiniTTS` executes first.
2. If Bhashini succeeds:
   - Returns the transcribed text or generated audio.
   - Logs `provider=bhashini`.
3. If Bhashini encounters an upstream error (`BhashiniAPIError`, timeout, HTTP failure):
   - Logs `Bhashini STT/TTS failed; attempting Sarvam fallback`.
   - Delegates the identical request to `SarvamSTT` / `SarvamTTS`.
   - On success, returns response and logs `provider=sarvam_fallback`.
4. If both Bhashini and Sarvam fail:
   - Returns a clean application error with details logged safely.

### Explicit Provider Selection
Callers can explicitly choose Sarvam if needed:
- In Python:
  ```python
  text = stt_service.transcribe(audio_bytes, language_code="hi", provider="sarvam")
  audio, meta = tts_service.synthesize("नमस्ते", language_code="hi", provider="sarvam")
  ```
- Via REST API:
  - `POST /api/stt/transcribe` with form field `provider=sarvam` (defaults to `bhashini`)
  - `POST /api/tts/synthesize` with JSON field `"provider": "sarvam"` (defaults to `bhashini`)

---

## 5. Security & Privacy Safeguards

1. **Server-Side Isolation**: Bhashini and Sarvam keys remain strictly in `ML/.env`. No keys are passed in client bundles or network responses.
2. **Safe Logging**: The Bhashini client and voice services sanitize all logs. Raw base64 audio and authorization headers are never logged.
3. **No Sensitive Leaks**: Exception classes (`BhashiniAPIError`, `BhashiniConfigError`, `BhashiniNetworkError`) sanitize error messages before returning them to callers.

---

## 6. Running Tests

Unit and integration tests run entirely offline with mock fixtures by default:

```bash
cd ML

# Run voice integration tests
python -m pytest tests/test_voice_integration.py -v

# Run full STT and TTS test suite
python -m pytest tests/test_stt.py tests/test_tts.py tests/test_bhashini_stt.py tests/test_bhashini_tts.py tests/test_voice_integration.py -v
```

To run optional live tests against the actual Bhashini endpoint:
```bash
set RUN_LIVE_TESTS=true
python -m pytest tests/test_bhashini_stt.py tests/test_bhashini_tts.py -v -k "test_live"
```

---

## 7. Starting the Service

To start the FastAPI ML backend on port 8000:
```bash
cd ML
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
