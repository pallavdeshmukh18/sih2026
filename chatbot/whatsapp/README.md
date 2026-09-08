# MediKiosk WhatsApp Web Bot (Clinical AI Integration)

This module provides a standalone **WhatsApp Web automation prototype** for MediKiosk using **Python + Selenium**, integrated directly with **Param's Clinical AI Engine** (`ML/clinical`) via `ClinicalClient`.

#### Key Characteristics & Guardrails:
- **Individual 1-to-1 Chats Only**: The bot processes strictly 1-to-1 individual patient conversations.
- **Exact Menu Activation**: When an individual user sends exactly `"hello medikiosk"` (case-insensitive, trimmed), the bot enters `MENU` state and presents the MediKiosk menu. Non-activation messages sent without an active session/menu are completely ignored.
- **Menu Options**:
  - `1️⃣ Start Consultation`: Initiates Param's Clinical AI session using defaults, delivers the first clinical question, and transitions the chat to `CLINICAL_SESSION` state.
  - `2️⃣ Upload Medical Report`: Informs the user that document upload will be available soon and prompts the menu choices again while remaining in `MENU` state.
  - `3️⃣ Exit`: Greets the user with a thank-you exit message, clears WhatsApp menu state, resets any clinical session, and returns to `IDLE`.
- **Strict State Priority**:
  1. Group & Community Protection (ignored completely)
  2. Active Clinical Session (user answering clinical questions, e.g. "1" treated as answer, not menu option)
  3. Active WhatsApp Menu State (processes options `1`, `2`, `3` or prompts invalid selection)
  4. Exact Activation Phrase (`"hello medikiosk"`)
  5. Otherwise ignored
- **Groups & Communities Ignored**: WhatsApp groups, Communities, and Community Announcement channels are detected via structural DOM indicators (header icons, member lists, author tags, admin-only footers) and completely ignored. No Clinical AI calls are made and no messages are sent inside groups/communities.
- **Optimized Message Detection**: The bot avoids repetitive full DOM scans across long chat histories. It utilizes unread badge targeting, dynamic chat loading, and targeted XPath slicing (`position() > last() - N`) to focus strictly on new/unread messages.
- **Selenium Prototype**: Operates directly on [WhatsApp Web](https://web.whatsapp.com/) via ChromeDriver without external aggregators (no Twilio, Meta Cloud API, or Botpress).
- **Clinical AI Integration**: Full integration with Param's Clinical AI endpoints (`/clinical/session/start`, `/clinical/session/respond`, `/clinical/session/summary`) remains preserved through `ClinicalClient`.

---

## 1. Architecture

```
[Patient on WhatsApp]
         │ (Text message)
         ▼
[Google Chrome / WhatsApp Web]
         │ (DOM event)
         ▼
[Selenium WhatsAppBot (bot.py)]
         │
         ├─ Check Group / Community Guard ──► [Ignored]
         ├─ Check Active Clinical Session ──► [ClinicalClient]
         ├─ Check Active Menu State ────────► [Menu Options: 1, 2, 3]
         └─ Check Exact Activation Phrase ──► [Present MediKiosk Menu]
                         │
                         ▼
             [ClinicalClient (clinical_client.py)]
                         │ (HTTP REST: JSON)
                         ▼
             [FastAPI ML Service (http://localhost:8000/clinical/*)]
                         │
                         ▼
             [Param's Clinical AI Engine (ML/clinical/)]
               ├─ Groq LLM (Entity Extraction & Question Generation)
               ├─ Allopathic & AYUSH Ontologies (Chest pain, Abdominal, Dashavidha)
               ├─ Deterministic Safety Triage (Red Flags: Cardiac, Stroke, Abdomen)
               └─ Clinical Summarizer (Physician Markdown Summary)
```

---

## 2. Directory Structure

```
chatbot/
├── requirements.txt              # Dependencies (selenium, webdriver-manager, requests)
└── whatsapp/
    ├── __init__.py
    ├── config.py                 # URLs, timeouts, DOM selectors, menu texts & state definitions
    ├── clinical_client.py        # HTTP client & session mapping for Param's Clinical AI
    ├── bot.py                    # Main Selenium automation loop, state machine & message dispatcher
    ├── test_clinical_client.py   # Unit tests for clinical client integration & menu state rules
    ├── README.md                 # This documentation
    └── .session/                 # Local Chrome user profile (auto-generated, git-ignored)
```

---

## 3. Environment Variables & Configuration

Configure via `.env` or system environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `CLINICAL_API_URL` | `http://localhost:8000` | Base URL of the running FastAPI ML Clinical Service |
| `CLINICAL_API_TIMEOUT` | `30` | HTTP timeout in seconds for clinical API calls |
| `CLINICAL_LANGUAGE` | `en` | Default intake language code (`en`, `hi`, etc.) |
| `CLINICAL_CONSULTATION_TYPE` | `allopathic` | Intake type: `allopathic` or `ayush` |
| `CLINICAL_CHIEF_COMPLAINT` | `generic` | Default complaint category (e.g. `chest_pain`, `generic`) |

---

## 4. End-to-End Conversation Flow

### A. Activation & Menu Presentation
1. Patient sends `"hello medikiosk"` (case-insensitive, trimmed).
2. Bot displays the MediKiosk menu:
   ```
   Welcome to MediKiosk 👋

   Please select an option:

   1️⃣ Start Consultation
   2️⃣ Upload Medical Report
   3️⃣ Exit
   ```
3. WhatsApp chat state is set to `MENU`.

### B. Option 1: Start Clinical Consultation
1. Patient replies `1`.
2. Bot starts a clinical session via `POST /clinical/session/start`:
   ```json
   {
     "patient_id": "<WhatsApp Contact/Phone>",
     "language": "en",
     "consultation_type": "allopathic",
     "chief_complaint": "generic"
   }
   ```
3. State transitions to `CLINICAL_SESSION`.
4. Bot sends the initial clinical question returned by ClinicalClient.
5. All subsequent messages from this chat now follow the adaptive clinical intake questioning loop.

### C. Option 2: Upload Medical Report
1. Patient replies `2`.
2. Bot replies with report upload notice:
   ```
   📄 Medical report upload will be available soon.

   Please choose:
   1️⃣ Start Consultation
   2️⃣ Upload Medical Report
   3️⃣ Exit
   ```
3. Remains in `MENU` state without calling ClinicalClient.

### D. Option 3: Exit
1. Patient replies `3`.
2. Bot replies with exit confirmation:
   ```
   Thank you for using MediKiosk. 👋

   Send "hello medikiosk" anytime to start again.
   ```
3. Bot clears menu state and any active clinical session.

### E. Invalid Menu Input
- If user in `MENU` state sends anything other than `1`, `2`, or `3`, bot replies:
  ```
  Please select a valid option:

  1️⃣ Start Consultation
  2️⃣ Upload Medical Report
  3️⃣ Exit
  ```
  Chat remains in `MENU` state and ClinicalClient is never called.

### F. Adaptive Questioning & Completion
- During `CLINICAL_SESSION`, patient replies are forwarded to `POST /clinical/session/respond`.
- When `is_complete: true`, summary is requested via `POST /clinical/session/summary`, completion message is sent, and session is cleared.

---

## 5. Error Handling & Safety Principles

- **API Unavailability**: If the ML service is down or times out, the Selenium bot logs the error and gracefully responds:
  > *"Sorry, I'm temporarily unable to process your response. Please try again."*
  Stack traces, internal URLs, and API keys are never exposed to the patient.
- **Self-Message Filtering**: The bot inspects `.message-in` vs `.message-out` classes, tracks sent message hashes, and checks known menu reply strings so it never responds to its own messages.
- **Manual Reset**: A patient or tester can send `/reset` or `/restart` at any time to clear both menu state and active clinical session.

---

## 6. How to Run

### Step 1: Start the ML Clinical AI Service
In a terminal, start the FastAPI ML backend on port 8000:
```powershell
python -m uvicorn ML.main:app --host 0.0.0.0 --port 8000 --reload
```
Verify health: [http://localhost:8000/health](http://localhost:8000/health) or Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs).

### Step 2: Start the WhatsApp Bot
In a second terminal, start the Selenium WhatsApp bot:
```powershell
python -m chatbot.whatsapp.bot
```
Or from inside `chatbot/whatsapp/`:
```powershell
cd chatbot\whatsapp
python bot.py
```

### Step 3: Scan QR Code & Interact
1. Chrome will open [web.whatsapp.com](https://web.whatsapp.com/).
2. Scan the QR code using WhatsApp on your phone (**Linked Devices** > **Link a device**).
3. Send any message from another WhatsApp account or test chat to initiate clinical intake.

---

## 7. Running Unit Tests

To run the automated integration unit tests (which verify request construction, session lifecycle, completion, and error fallbacks using mocks without requiring Chrome):

```powershell
python -m unittest chatbot/whatsapp/test_clinical_client.py
```
