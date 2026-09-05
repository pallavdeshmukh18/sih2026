# MediKiosk (SIH 2026) 🏥

**MediKiosk** is an AI-powered, multilingual patient triage and clinical intake kiosk designed for Indian healthcare systems. It combines adaptive conversational AI, AYUSH clinical parameters (Dashavidha Pariksha), real-time emergency red-flag detection, voice STT/TTS intake in regional languages, and document OCR parsing to assist physicians and speed up patient consultation.

---

## 🏗️ System Architecture

```
                                  +-----------------------+
                                  |    React Frontend     |
                                  |    (Vite / Tailwind)  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |  Express Backend      |
                                  |  (Auth, DB, Gateway)  |
                                  +-----+-----------+-----+
                                        |           |
                     +------------------+           +-------------------+
                     |                                                  |
                     v                                                  v
   +----------------------------------+               +-----------------------------------+
   |      FastAPI ML Engine           |               |       Supabase / PostgreSQL       |
   | - Groq LLM (gpt-oss-20b)         |               | - Users, Doctors, Patients        |
   | - AYUSH Dashavidha Pariksha      |               | - Clinical Sessions               |
   | - Red Flag Triage & Summarizer   |               | - Medical Docs & Embeddings       |
   | - PaddleOCR & Entity Extractor   |               +-----------------------------------+
   | - Sarvam Voice STT / TTS         |
   +----------------------------------+
```

---

## 🛠️ Module Breakdown

### 1. Frontend (`/Frontend`)
- **Built with:** React, Vite, React Router, Modular CSS.
- **Pages & Components:**
  - Modern animated Landing Page.
  - Doctor & Patient Authentication UI (`/auth`).
  - Signup workflow & profile creation (`/auth?mode=signup`).
  - Medical document upload & OCR embedding management views.

### 2. Core Backend Gateway (`/backend`)
- **Built with:** Node.js, Express, PostgreSQL (`pg`), JWT, bcryptjs.
- **Key Functionality:**
  - **Auth Pipeline:** Doctor email/password login (`POST /api/auth/doctor/login`), Patient OTP phone & email login/registration, token verification (`/api/auth/me`).
  - **Clinical Session Orchestration:** Connects frontend patient inputs to ML engine endpoints and persists session state.
  - **Database Migrations:** Supabase SQL schema migrations (`20260905140000_create_clinical_sessions.sql`, user tables, doctor profiles, clinical sessions).

### 3. ML & Clinical AI Engine (`/ML`)
- **Built with:** Python, FastAPI, Groq SDK, Pydantic, PaddleOCR, Pytest.
- **Key Modules:**
  - **Adaptive Questioning (`ML/clinical/engine.py`):** Powered by Groq LLM (`openai/gpt-oss-20b`) to extract structured symptoms and dynamically generate relevant follow-up questions.
  - **AYUSH Dashavidha Pariksha (`ML/clinical/ontology.py`):** Incorporates traditional Indian medicine parameters (*Dushya, Desha, Bala, Kala, Anala/Agni, Prakriti, Vaya, Satwa, Satmya, Ahara*).
  - **Emergency Red Flags (`ML/clinical/safety.py`):** Deterministic heuristic rules flagging life-threatening symptoms (chest pain + dyspnea, stroke signs, high fever) for immediate triage.
  - **Clinical Summarizer (`ML/clinical/summarizer.py`):** Synthesizes conversational intake and document OCR into physician-ready Markdown summaries.
  - **OCR & Entity Extraction (`ML/ocr/`):** Uses PaddleOCR with angle classification disabled to suppress C++ log spam, coupled with Groq JSON extraction for lab reports & medical docs.

### 4. Voice Services (`/ML/stt`, `/ML/tts`)
- **Built with:** Sarvam AI SDK.
- **Speech-to-Text (STT):** Sarvam Saaras (`saaras:v4`) for native Indian language transcription.
- **Text-to-Speech (TTS):** Sarvam Bulbul (`bulbul:v3`) for synthesizing clinical prompts into natural Indian accents.

---

## 👥 Team Contributions

| Team Member | Primary Role & Responsibility |
| :--- | :--- |
| **Pallav Deshmukh** | **Authentication, Identity & Security:** Patient/Doctor signup/login auth flows, ABHA integration, RBAC, JWT middleware, and session security. |
| **Vedansh Dubey** | **Core Backend & Clinical Data Architecture:** Express REST gateway orchestration, medical history & document APIs, database schema, and AI service orchestration. |
| **Anuj Ghugarkar** | **Voice & Conversational Interface:** Multilingual STT (Sarvam Saaras v4) and TTS (Sarvam Bulbul v3) voice intake pipeline & tele-interface. |
| **Anushka Gupte** | **OCR, Document Intelligence & Red Flags:** Document OCR pipeline, JSON medical entity extraction, document embeddings retrieval, and red-flag rule implementation. |
| **Param Savla** | **ML/AI Pipeline & Adaptive Questioning:** Groq LLM clinical engine (`openai/gpt-oss-20b`), AYUSH Dashavidha Pariksha ontology, adaptive questioning engine, structured extraction, summarizer, and 100% test coverage. |
| **Nisarg Anand** | **Frontend & User Experience:** Vite React UI, patient voice/touch kiosk flow, physician dashboard summary view, and medical timeline UI. |

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL / Supabase connection URL

---

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `backend/.env` file:
```env
PORT=5001
DATABASE_URL=postgresql://user:password@localhost:5432/medikiosk
JWT_SECRET=your_jwt_secret_key
```
Run the server:
```bash
npm run dev
```

---

### 2. ML & Clinical AI Service Setup
```bash
cd ML
pip install -r requirements.txt
```
Create an `ML/.env` file:
```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
SARVAM_API_KEY=your_sarvam_api_key
```
Run the FastAPI service:
```bash
python -m uvicorn ML.main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive API Docs: `http://localhost:8000/docs`

---

### 3. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
Access the application at `http://localhost:5173`.

---

## 🧪 Running Tests

### ML Service Unit Tests
```bash
pytest ML/tests/test_clinical_engine.py ML/tests/test_stt.py ML/tests/test_tts.py -v
```

---

## 📄 License
Developed for Smart India Hackathon (SIH) 2026.
