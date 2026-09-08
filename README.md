# MediKiosk

## AI-Powered Multilingual Clinical Intake, Smart Triage, and Hospital Operations Platform

[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind%20CSS-blue)](https://github.com/pallavdeshmukh18/sih2026)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20PostgreSQL-green)](https://github.com/pallavdeshmukh18/sih2026)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-FastAPI%20%7C%20Groq%20LLM%20%7C%20PaddleOCR-orange)](https://github.com/pallavdeshmukh18/sih2026)
[![Voice AI](https://img.shields.io/badge/Voice%20AI-Sarvam%20AI%20(STT%20%26%20TTS)-purple)](https://github.com/pallavdeshmukh18/sih2026)
[![Compliance](https://img.shields.io/badge/Compliance-ABHA%20%2F%20ABDM%20Architecture-teal)](https://github.com/pallavdeshmukh18/sih2026)

---

## Executive Overview

MediKiosk is an enterprise-grade clinical intake, triage, and hospital management platform engineered for primary health centers (PHCs), tertiary care hospitals, and high-density outpatient departments (OPD).

The platform addresses clinical preparation bottlenecks, language barriers, and fragmented patient registration by integrating:
- **Multilingual Voice-First Clinical Intake** across 12 Indic languages powered by Sarvam AI.
- **Dual Clinical Ontologies** bridging traditional AYUSH (*Dashavidha Pariksha*) and modern allopathic clinical protocols.
- **Dynamic Adaptive Assessment** utilizing Groq LLM inference for structured pre-consultation summaries.
- **Deterministic Red-Flag Triage** ensuring immediate identification and prioritization of critical presentations.
- **Role-Based Operational Portals** delivering tailored workflows for Patients, Doctors, and Receptionists with real-time timetable tracking and queue coordination.

---

## System Architecture

```
                                  +---------------------------------------+
                                  |           React 19 Frontend           |
                                  |     (Vite, Framer Motion, i18n)       |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTPS / REST / JWT
                                                      v
                                  +---------------------------------------+
                                  |       Express.js Core Gateway         |
                                  |    (RBAC, Auth, ORM, Orchestrator)    |
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +----------------------+
                     |                                                                 |
                     v                                                                 v
    +----------------------------------+                             +-----------------------------------+
    |        FastAPI ML Engine         |                             |      PostgreSQL / Supabase        |
    | - Groq LLM (Adaptive Intake)     |                             | - Role-Based User Accounts        |
    | - AYUSH Dashavidha Pariksha      |                             | - Doctor & Patient Profiles       |
    | - Emergency Red Flag Triage      |                             | - Appointments & Live OPD Queues  |
    | - PaddleOCR Lab Extraction       |                             | - Longitudinal Medical Records    |
    | - Sarvam Indic Voice (STT & TTS) |                             | - Hospital Bed Allocations        |
    | - Vector Document Embeddings     |                             +-----------------------------------+
    +----------------------------------+
```

---

## Role-Based Portals and Functional Workflows

MediKiosk enforces end-to-end Role-Based Access Control (RBAC) across three dedicated operational environments:

### 1. Patient Self-Service Portal (`/patient/*`)
- **Multilingual Intake Engine:** Voice and visual conversational symptom assessment supporting 12 Indian languages (*Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, Assamese, English*).
- **ABHA Digital Health ID:** Unified Ayushman Bharat Health Account identity card generation with scannable QR verification, blood group, emergency contacts, and chronic illness badges.
- **Longitudinal Health Timeline:** Comprehensive timeline detailing past surgeries, family history, chronic diagnoses, active medications, and recorded drug/environmental allergies.
- **Clinical Document Vault & OCR:** Secure repository for uploading paper prescriptions and diagnostic lab reports with automated parameter extraction and document query capabilities.
- **Self-Service Appointments & Bed Availability:** Real-time provider directory browsing and live ward bed occupancy visibility.

### 2. Doctor Clinical Command Center (`/doctor/*`)
- **Clinical Triage & Emergency Red-Flag Queue:** Dynamic prioritization matrix routing high-urgency presentations (e.g., acute coronary symptoms, respiratory distress, acute neurological deficits) to the top of the consultation queue.
- **Synthesized Intake Briefs:** Standardized clinical summaries combining conversational patient symptoms, AYUSH baseline scores, and digitized lab records into structured SOAP format before patient examination.
- **Consultation Confirmation & Diagnosis:** One-click confirmation of patient history, differential diagnosis logging, prescription creation, and automated medical record appending.
- **Medical Staff Hierarchy Management:** Verified practitioners manage administrative staff provisioning, nurse accounts, and clinic permissions.

### 3. Receptionist & Front-Desk Operations (`/receptionist/*`)
- **Live OPD Queue Counter:** Real-time queue monitor with single-click arrival verification, automated token generation, and wait-time estimation.
- **Rapid Walk-In Registration:** High-throughput desk registration for non-registered walk-in patients with automated ABHA profile creation and direct appointment confirmation.
- **Doctor Timetable & Schedule Grid:** Interactive calendar visualizer displaying 30-minute availability slots for every provider, with capacity indicators, existing bookings, and immediate slot reservation.
- **Bed Management & Department Router:** Ward occupancy tracking and inter-departmental patient routing.

---

## Clinical Intelligence and ML Architecture

| Module | Engine / Model | Clinical Function |
| :--- | :--- | :--- |
| **Adaptive Questioning** | Groq LLM (`gpt-oss-20b`) | Dynamically generates relevant follow-up clinical inquiries based on patient response history, anatomical context, and severity. |
| **Dual Ontology** | AYUSH + Allopathic Standard | Implements *Dashavidha Pariksha* parameters (*Dushya, Desha, Bala, Kala, Agni, Prakriti, Vaya, Satwa, Satmya, Ahara*) in conjunction with modern clinical taxonomies. |
| **Safety and Red Flags** | Deterministic Rule Engine | Evaluates intake responses against emergency criteria to trigger immediate red-flag warnings and prioritize triage. |
| **Multilingual Voice AI** | Sarvam AI (`saaras:v4` / `bulbul:v3`) | Sub-second Speech-to-Text transcription and high-naturalness Text-to-Speech across regional accents and dialects. |
| **Document Digitization** | PaddleOCR + LLM Extraction | Extracts text and tables from printed and handwritten laboratory reports, categorizing biochemical reference values. |

---

## Repository Structure

```
sih2026/
├── Frontend/                           # React 19 Client Application
│   ├── src/
│   │   ├── components/                 # Reusable UI & Modal Components
│   │   │   ├── DoctorScheduleModal.jsx # Doctor timetable & slot scheduling grid
│   │   │   ├── patient/                # Medical ID card & health timeline components
│   │   │   └── accessibility/          # Voice input & accessibility tools
│   │   ├── layouts/                    # ProtectedRoute (RBAC) & DashboardLayout
│   │   ├── pages/                      # Role-specific portal views
│   │   │   ├── patient/                # Assessment, MedicalHistory, Documents, MedicalID
│   │   │   ├── doctor/                 # DoctorDashboard, DoctorAppointments, PatientAccess, TeamManagement
│   │   │   ├── receptionist/           # ReceptionistDashboard, ReceptionistAppointments, ReceptionistPatients
│   │   │   └── shared/                 # DoctorDirectory, Departments, BedManager, Payment, Account
│   │   ├── i18n/                       # Translation dictionaries & language configuration
│   │   └── services/api.js             # Centralized API service layer
│   └── package.json
│
├── backend/                            # Express.js Core Backend Gateway
│   ├── src/
│   │   ├── controllers/                # authController, receptionistController, doctorController, patientController
│   │   ├── middleware/                 # authMiddleware (JWT), rbacMiddleware (Role-based access guards)
│   │   ├── routes/                     # authRoutes, receptionistRoutes, doctorRoutes, patientRoutes, appointmentRoutes
│   │   ├── services/                   # mlService, emailService, smsService
│   │   ├── tests/                      # Automated RBAC and regression test suites
│   │   └── server.js                   # Application server entrypoint and route declarations
│   ├── migrations/                     # PostgreSQL database schema migrations
│   └── package.json
│
└── ML/                                 # FastAPI Clinical Intelligence Service
    ├── clinical/                       # Adaptive intake engine, ontology mappings, safety guards, summarizer
    ├── ocr/                            # PaddleOCR lab report parser and Q&A pipeline
    ├── stt/                            # Sarvam Saaras Speech-to-Text integration
    ├── tts/                            # Sarvam Bulbul Text-to-Speech integration
    ├── tests/                          # Pytest test suites for clinical intelligence modules
    ├── main.py                         # FastAPI service entrypoint and OpenAPI configuration
    └── requirements.txt
```

---

## API and Service Specifications

### Authentication and Role Management (`backend`)
- `POST /api/auth/register` - Register new patient, doctor, or staff account.
- `POST /api/auth/login` - JWT authentication with role claims.
- `GET  /api/auth/me` - Retrieve current authenticated profile.

### Receptionist Operations (`backend`)
- `GET  /api/receptionist/queue` - Retrieve live OPD queue with status filters.
- `POST /api/receptionist/checkin/:id` - Check in arriving patient and update queue token.
- `POST /api/receptionist/walkin` - Create rapid walk-in registration and appointment.
- `GET  /api/receptionist/schedule/:doctorId` - Retrieve 30-minute doctor schedule matrix.

### Doctor Clinical Operations (`backend`)
- `GET  /api/doctor/queue` - Fetch triaged patient queue sorted by red-flag urgency.
- `GET  /api/doctor/consultation/:appointmentId` - Retrieve full clinical summary and history.
- `POST /api/doctor/consultation/:appointmentId/complete` - Finalize diagnosis and prescription.

### Clinical AI and ML Service (`ML`)
- `POST /clinical/intake/init` - Initialize adaptive intake session with language and chief complaint.
- `POST /clinical/intake/next-question` - Compute next adaptive question or assess completion.
- `POST /clinical/intake/summary` - Synthesize SOAP clinical intake summary and triage level.
- `POST /ocr/extract` - Run PaddleOCR pipeline on uploaded medical document.
- `POST /voice/stt` - Transcribe audio bytes to text via Sarvam AI.
- `POST /voice/tts` - Synthesize text into Indic speech audio.

---

## Quickstart and Local Deployment Guide

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **Python** (v3.10 or higher)
- **PostgreSQL** database instance (or Supabase URL)

---

### 1. Backend Service Setup

```bash
cd backend
npm install
```

Create a `backend/.env` configuration file:

```env
PORT=5001
DATABASE_URL=postgresql://postgres:password@localhost:5432/medikiosk
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=http://localhost:8000
```

Run database migrations and start the backend development server:

```bash
npm run dev
```

---

### 2. Clinical AI and ML Service Setup

```bash
cd ML
python -m venv venv

# On Linux / macOS:
source venv/bin/activate

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create an `ML/.env` configuration file:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
SARVAM_API_KEY=your_sarvam_api_key
```

Start the FastAPI application:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at: `http://localhost:8000/docs`

---

### 3. Frontend Web Application Setup

```bash
cd Frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Testing and Quality Assurance

### Automated Backend and RBAC Test Suite
```bash
cd backend
node src/tests/test_patient_regression.js
node src/tests/test_doctor_auth.js
node src/tests/test_doctor_directory.js
node src/tests/test_doctor_consultation.js
node src/tests/test_receptionist_rbac.js
```

### ML and Clinical Intelligence Tests
```bash
cd ML
pytest tests/ -v
```

### Frontend Production Build
```bash
cd Frontend
npm run build
```

---

## Security and Privacy Compliance

- **Role-Based Access Control:** Strict JWT token validation and route guards ensure complete data isolation across patient, doctor, and receptionist sessions.
- **ABDM Standards Alignment:** Medical record structures follow Ayushman Bharat Digital Mission guidelines for health data storage and exchange.
- **Cryptographic Security:** User credentials and sensitive clinical data employ bcrypt hashing and parameterized database interfaces to mitigate injection risks.

---

## License

This project is developed for the **Smart India Hackathon (SIH) 2026**.
