import base64
import logging
import re
import sys
from typing import Any, Dict, Optional, Set

import requests

try:
    from .config import (
        BACKEND_API_TIMEOUT,
        BACKEND_API_URL,
        CHIEF_COMPLAINT_PROMPT,
        CLINICAL_API_TIMEOUT,
        CLINICAL_API_URL,
        COMPLETION_MESSAGE,
        DEFAULT_CHIEF_COMPLAINT,
        DEFAULT_CONSULTATION_TYPE,
        DEFAULT_LANGUAGE,
        ERROR_MESSAGE,
        LOCALIZED_CHIEF_COMPLAINT_PROMPT,
        LOCALIZED_COMPLETION_MESSAGE,
        LOCALIZED_NO_DOCTORS_FOUND,
        LOCALIZED_SLOT_CONFLICT,
        WHATSAPP_SERVICE_KEY,
        format_confirmation_message,
        format_doctor_recommendations,
        format_doctor_slots,
        format_invalid_doctor_choice,
        format_invalid_slot_choice,
    )
except (ImportError, ValueError):
    from config import (
        BACKEND_API_TIMEOUT,
        BACKEND_API_URL,
        CHIEF_COMPLAINT_PROMPT,
        CLINICAL_API_TIMEOUT,
        CLINICAL_API_URL,
        COMPLETION_MESSAGE,
        DEFAULT_CHIEF_COMPLAINT,
        DEFAULT_CONSULTATION_TYPE,
        DEFAULT_LANGUAGE,
        ERROR_MESSAGE,
        LOCALIZED_CHIEF_COMPLAINT_PROMPT,
        LOCALIZED_COMPLETION_MESSAGE,
        LOCALIZED_NO_DOCTORS_FOUND,
        LOCALIZED_SLOT_CONFLICT,
        WHATSAPP_SERVICE_KEY,
        format_confirmation_message,
        format_doctor_recommendations,
        format_doctor_slots,
        format_invalid_doctor_choice,
        format_invalid_slot_choice,
    )

logger = logging.getLogger("medikiosk.whatsapp.clinical_client")


class ClinicalAPIError(Exception):
    """Raised when communication with the MediKiosk Backend Clinical service fails."""
    pass



class ClinicalClient:
    """
    HTTP client and session manager connecting WhatsApp users to MediKiosk's
    Unified Clinical Pipeline via the Express backend.

    Architecture:
        WhatsApp / Selenium
               ↓
        ClinicalClient.handle_message(patient_id, message)
               ↓ (HTTP REST + X-WhatsApp-Service-Key)
        Express Backend (/api/whatsapp/clinical/session/*)
               ↓
        whatsappClinicalController -> clinicalSessionService -> mlService
               ↓
        FastAPI ML Engine (Groq LLM + Clinical Ontology + Safety Triage)
               ↓
        PostgreSQL (clinical_sessions table, mapped to patient users.id)
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        service_key: Optional[str] = None,
    ):
        raw_url = (base_url or BACKEND_API_URL).rstrip("/")
        # Normalize base URL so it handles either root backend host or clinical path
        if "/api/whatsapp/clinical" in raw_url:
            self.clinical_base = raw_url
        elif raw_url.endswith("/clinical"):
            self.clinical_base = raw_url
        else:
            self.clinical_base = f"{raw_url}/api/whatsapp/clinical"

        self.timeout = timeout or BACKEND_API_TIMEOUT
        self.service_key = service_key or WHATSAPP_SERVICE_KEY

        # In-memory session mapping: WhatsApp phone/contact identifier -> clinical session_id
        # Example: {"+919876543210": "a4d8c72e-3f1a-4e2b-98f2-d92e59174123"}
        self.sessions: Dict[str, str] = {}

        # Tracking for contacts who have triggered Option 1 and are prompted for chief complaint
        self.pending_complaint: Set[str] = set()

        # Cache of completed session summaries for clinical audit/logging
        self.completed_summaries: Dict[str, str] = {}

        # Recommended doctors per patient: { patient_id: [doc1, doc2, ...] }
        self.recommended_doctors: Dict[str, list] = {}

        # Selected doctor per patient: { patient_id: doc_dict }
        self.selected_doctor: Dict[str, dict] = {}

        # Available slots per patient: { patient_id: [slot1, slot2, ...] }
        self.available_slots: Dict[str, list] = {}

        # Last completed clinical session ID per patient
        self.last_completed_session: Dict[str, str] = {}

        # Patient authoritative accessibility preference
        self.patient_accessibility: Dict[str, str] = {}

        self.backend_url = BACKEND_API_URL
        self.clinical_ml_url = CLINICAL_API_URL

    def synthesize_speech(self, text: str, language: str = DEFAULT_LANGUAGE) -> Optional[bytes]:
        """
        Synthesizes text into speech audio bytes using Sarvam Bulbul TTS.
        Gracefully returns None if TTS service is unavailable.
        Never crashes or blocks caller flow.
        """
        if not text or not text.strip():
            return None

        bcp47_map = {
            "en": "en-IN",
            "hi": "hi-IN",
            "mr": "mr-IN",
            "gu": "gu-IN",
        }
        lang_code = bcp47_map.get(language.lower().strip(), "en-IN")

        # Clean formatting characters for speech
        clean_text = re.sub(r"[*_#~`]", "", text).strip()
        if len(clean_text) > 2000:
            clean_text = clean_text[:2000]

        # 1. Try Backend Express TTS proxy first
        try:
            endpoint = f"{self.backend_url}/api/tts/synthesize"
            resp = requests.post(
                endpoint,
                json={"text": clean_text, "languageCode": language, "speaker": "simran", "pace": 1.0},
                headers=self._get_headers(),
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                b64 = data.get("audio_base64")
                if b64:
                    return base64.b64decode(b64)
        except Exception as err:
            logger.debug("Backend TTS proxy unavailable, trying ML service directly: %s", err)

        # 2. Try ML FastAPI direct endpoint
        try:
            endpoint = f"{self.clinical_ml_url}/api/tts/synthesize"
            resp = requests.post(
                endpoint,
                json={"text": clean_text, "language_code": lang_code, "speaker": "simran", "pace": 1.0},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                b64 = data.get("audio_base64")
                if b64:
                    return base64.b64decode(b64)
        except Exception as err:
            logger.debug("Direct ML TTS synthesis unavailable: %s", err)

        return None

    def _get_headers(self) -> Dict[str, str]:
        """Builds HTTP headers containing the secret server-to-server key."""
        headers = {"Content-Type": "application/json"}
        if self.service_key:
            headers["X-WhatsApp-Service-Key"] = self.service_key
        return headers

    def get_session_id(self, patient_id: str) -> Optional[str]:
        """Returns the active clinical session ID for a given patient identifier, if any."""
        return self.sessions.get(patient_id)

    def set_session_id(self, patient_id: str, session_id: str) -> None:
        """Manually records an active session ID for a patient identifier."""
        self.sessions[patient_id] = session_id

    def reset_session(self, patient_id: str) -> None:
        """Clears the active clinical session, pending states, and booking context for a patient."""
        if patient_id in self.sessions:
            logger.info("Resetting clinical session for patient: %s", patient_id)
            del self.sessions[patient_id]
        self.pending_complaint.discard(patient_id)
        self.recommended_doctors.pop(patient_id, None)
        self.selected_doctor.pop(patient_id, None)
        self.available_slots.pop(patient_id, None)
        self.last_completed_session.pop(patient_id, None)
        self.patient_accessibility.pop(patient_id, None)


    def start_session(
        self,
        patient_id: str,
        language: str = DEFAULT_LANGUAGE,
        consultation_type: str = DEFAULT_CONSULTATION_TYPE,
        chief_complaint: str = DEFAULT_CHIEF_COMPLAINT,
    ) -> Dict[str, Any]:
        """
        Calls POST /api/whatsapp/clinical/session/start to initialize a new clinical ontology session.

        Input:
            {
                "whatsapp_id": str,
                "language": str,
                "consultation_type": str,
                "chief_complaint": str
            }
        Returns:
            {"session_id": str, "next_question": str, "state": dict}
        """
        endpoint = f"{self.clinical_base}/session/start"
        payload = {
            "whatsapp_id": patient_id,
            "patient_id": patient_id,
            "language": language,
            "consultation_type": consultation_type,
            "chief_complaint": chief_complaint,
        }

        logger.info("Initiating clinical session at %s for patient: %s", endpoint, patient_id)
        try:
            resp = requests.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            session_id = data.get("session_id") or data.get("sessionId")
            logger.info("Clinical session started successfully. Session ID: %s", session_id)
            return data
        except requests.RequestException as exc:
            logger.error("Failed to start clinical session at %s: %s", endpoint, exc)
            raise ClinicalAPIError(f"Clinical session start failed: {exc}") from exc

    def respond(self, session_id: str, patient_text: str, patient_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calls POST /api/whatsapp/clinical/session/:id/text-turn with the patient's incoming answer.

        Input:
            {
                "whatsapp_id": str,
                "patient_text": str
            }
        Returns:
            {
                "next_question": str or None,
                "extracted_entities": list,
                "red_flags": list,
                "is_complete": bool
            }
        """
        # Format URL: handles both /session/:id/text-turn and legacy /session/respond if custom base URL
        if "/api/whatsapp/clinical" in self.clinical_base:
            endpoint = f"{self.clinical_base}/session/{session_id}/text-turn"
        else:
            endpoint = f"{self.clinical_base}/session/respond"

        payload = {
            "session_id": session_id,
            "whatsapp_id": patient_id,
            "patient_text": patient_text,
        }

        logger.debug("Sending patient response to %s for session %s", endpoint, session_id)
        try:
            resp = requests.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Failed to process patient response for session %s at %s: %s", session_id, endpoint, exc)
            raise ClinicalAPIError(f"Clinical session respond failed: {exc}") from exc

    def get_summary(
        self,
        session_id: str,
        document_data: Optional[dict] = None,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calls POST /api/whatsapp/clinical/session/:id/finalize to obtain the finalized physician summary.

        Input:
            {
                "whatsapp_id": str,
                "document_data": dict or None
            }
        Returns:
            {"session_id": str, "summary": str}
        """
        if "/api/whatsapp/clinical" in self.clinical_base:
            endpoint = f"{self.clinical_base}/session/{session_id}/finalize"
        else:
            endpoint = f"{self.clinical_base}/session/summary"

        payload = {
            "session_id": session_id,
            "whatsapp_id": patient_id,
            "document_data": document_data,
        }

        logger.info("Requesting clinical summary for session %s at %s", session_id, endpoint)
        try:
            resp = requests.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch clinical summary for session %s: %s", session_id, exc)
            raise ClinicalAPIError(f"Clinical summary generation failed: {exc}") from exc

    def get_recommendations(self, session_id: str, patient_id: str) -> Dict[str, Any]:
        """
        Calls POST /api/whatsapp/clinical/recommendations to get up to 5 verified doctors
        matching the completed clinical assessment specialization.
        """
        endpoint = f"{self.clinical_base}/recommendations"
        payload = {
            "whatsapp_id": patient_id,
            "session_id": session_id,
        }
        logger.info("Requesting doctor recommendations for session %s at %s", session_id, endpoint)
        try:
            resp = requests.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch doctor recommendations for session %s: %s", session_id, exc)
            raise ClinicalAPIError(f"Doctor recommendations failed: {exc}") from exc

    def get_doctor_slots(self, doctor_id: str, patient_id: str, date: Optional[str] = None) -> Dict[str, Any]:
        """
        Calls GET /api/whatsapp/clinical/doctors/:doctorId/slots to get real available slots.
        """
        endpoint = f"{self.clinical_base}/doctors/{doctor_id}/slots"
        params = {"whatsapp_id": patient_id}
        if date:
            params["date"] = date
        logger.info("Requesting doctor slots for doctor %s at %s", doctor_id, endpoint)
        try:
            resp = requests.get(endpoint, params=params, headers=self._get_headers(), timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch doctor slots for doctor %s: %s", doctor_id, exc)
            raise ClinicalAPIError(f"Doctor slot retrieval failed: {exc}") from exc

    def book_appointment(self, patient_id: str, session_id: str, doctor_id: str, scheduled_at: str) -> Dict[str, Any]:
        """
        Calls POST /api/whatsapp/clinical/book to book the appointment with double-booking protection.
        """
        endpoint = f"{self.clinical_base}/book"
        payload = {
            "whatsapp_id": patient_id,
            "sessionId": session_id,
            "doctorId": doctor_id,
            "scheduledAt": scheduled_at,
        }
        logger.info("Booking appointment for patient %s with doctor %s at %s", patient_id, doctor_id, endpoint)
        try:
            resp = requests.post(endpoint, json=payload, headers=self._get_headers(), timeout=self.timeout)
            try:
                data = resp.json()
            except Exception:
                data = {"message": resp.text}
            return {
                "status_code": resp.status_code,
                "success": resp.status_code == 201,
                "data": data,
            }
        except requests.RequestException as exc:
            logger.error("Failed to execute appointment booking: %s", exc)
            raise ClinicalAPIError(f"Appointment booking failed: {exc}") from exc

    def handle_message(self, patient_id: str, message: str, language: Optional[str] = None) -> str:
        """Alias for process_message for backwards compatibility."""
        return self.process_message(patient_id, message, language=language)

    def process_message(self, patient_id: str, message: str, language: Optional[str] = None) -> str:
        """
        Processes an incoming patient message by:
        1. Starting a clinical session if none exists (via Option 1 or symptom description).
        2. Validating the chief complaint to reject noise/single words.
        3. Advancing the clinical session through the shared backend pipeline.
        4. Safety red-flag logging.
        5. Triggering physician summary generation upon completion and saving to PostgreSQL.
        6. Finding up to 5 recommended doctors from the existing database and returning the recommendation message.
        """
        cleaned = message.strip()
        if not cleaned:
            return ""

        lang = language.lower().strip() if (isinstance(language, str) and language.strip()) else DEFAULT_LANGUAGE

        # Allow user to manually restart their clinical intake
        if cleaned.lower() in ("/reset", "/restart", "reset", "restart"):
            self.reset_session(patient_id)
            return 'Session reset. Send "hello medikiosk" to begin a consultation.'

        session_id = self.sessions.get(patient_id)

        try:
            # 1. NO ACTIVE SESSION: First interaction
            if not session_id:
                # Option 1 from menu -> prompt for chief complaint
                if cleaned == "1":
                    self.pending_complaint.add(patient_id)
                    return LOCALIZED_CHIEF_COMPLAINT_PROMPT.get(lang, CHIEF_COMPLAINT_PROMPT)

                # Never accept bot prompts or prompt instructions as a patient chief complaint
                cleaned_lower = cleaned.lower()
                all_prompts = [CHIEF_COMPLAINT_PROMPT.lower()] + [p.lower() for p in LOCALIZED_CHIEF_COMPLAINT_PROMPT.values()]
                if (
                    any(cleaned_lower == p for p in all_prompts)
                    or "let's begin your clinical assessment" in cleaned_lower
                    or "describe your main health concern" in cleaned_lower
                    or "example: \"i have had chest pain since this morning\"" in cleaned_lower
                    or "नैदानिक मूल्यांकन शुरू करें" in cleaned_lower
                    or "आरोग्य तपासणी सुरू करूया" in cleaned_lower
                    or "આરોગ્ય મૂલ્યાંકન શરૂ કરીએ" in cleaned_lower
                ):
                    logger.warning(
                        "Prompt text echo detected as chief complaint for patient '%s': '%s'. Ignoring.",
                        patient_id, cleaned[:40]
                    )
                    return ""

                # Check if input is obvious noise, menu digit, or non-symptom filler before treating as chief complaint
                clean_lower = cleaned.lower()
                is_noise = False
                if len(cleaned) < 3:
                    is_noise = True
                elif clean_lower in {"na", "ok", "okay", "no", "yes", "none", "nothing", "nil", "hi", "hello", "hey", "test", "bye", "iii", "aaa"}:
                    is_noise = True
                elif cleaned.isdigit():
                    is_noise = True
                elif not any(c.isalnum() for c in cleaned):
                    is_noise = True

                if is_noise:
                    self.pending_complaint.add(patient_id)
                    logger.info("Noise/invalid chief complaint detected from patient '%s': '%s'. Re-prompting.", patient_id, cleaned)
                    return LOCALIZED_CHIEF_COMPLAINT_PROMPT.get(lang, CHIEF_COMPLAINT_PROMPT)

                # Patient sent valid symptom description
                chief_complaint = cleaned
                self.pending_complaint.discard(patient_id)

                logger.info("New WhatsApp patient detected: '%s'. Starting clinical intake with complaint: '%s'", patient_id, chief_complaint)
                start_data = self.start_session(
                    patient_id=patient_id,
                    language=lang,
                    consultation_type=DEFAULT_CONSULTATION_TYPE,
                    chief_complaint=chief_complaint,
                )
                session_id = start_data.get("session_id") or start_data.get("sessionId")
                if not session_id:
                    logger.error("Clinical API returned success without session_id: %s", start_data)
                    return ERROR_MESSAGE

                # Persist session mapping
                self.sessions[patient_id] = session_id

                next_q = start_data.get("next_question") or start_data.get("nextQuestion")
                return next_q or "Welcome to MediKiosk. How can I help you today?"

            # 2. SUBSEQUENT MESSAGES: Advance the existing clinical session
            logger.info("Advancing active session %s for patient '%s'...", session_id, patient_id)
            respond_data = self.respond(session_id=session_id, patient_text=cleaned, patient_id=patient_id)

            # Log any clinical safety red flags detected by the clinical engine
            red_flags = respond_data.get("red_flags") or respond_data.get("redFlags") or []
            if red_flags:
                logger.warning(
                    "🚨 [CLINICAL RED FLAG] Detected for patient '%s' (session %s): %s",
                    patient_id,
                    session_id,
                    red_flags,
                )

            # 3. COMPLETION: All required ontology fields gathered
            is_complete = bool(respond_data.get("is_complete") or respond_data.get("isComplete"))
            if is_complete:
                logger.info("Clinical intake complete for session %s. Requesting final summary...", session_id)
                try:
                    summary_data = self.get_summary(session_id=session_id, patient_id=patient_id)
                    summary_text = summary_data.get("summary", "")
                    self.completed_summaries[patient_id] = summary_text
                    logger.info("Clinical intake summary generated for patient '%s':\n%s", patient_id, summary_text)
                except Exception as sum_exc:
                    logger.warning("Could not retrieve final summary for session %s: %s", session_id, sum_exc)

                # Record completed session for appointment linking
                self.last_completed_session[patient_id] = session_id

                # Clear active intake session mapping so patient moves on to doctor selection
                self.sessions.pop(patient_id, None)
                self.pending_complaint.discard(patient_id)

                completion_msg = LOCALIZED_COMPLETION_MESSAGE.get(lang, COMPLETION_MESSAGE)

                # Query doctor recommendations from existing database
                try:
                    rec_res = self.get_recommendations(session_id=session_id, patient_id=patient_id)
                    doctors = rec_res.get("doctors", [])
                    if rec_res.get("accessibilityPreference"):
                        self.patient_accessibility[patient_id] = rec_res["accessibilityPreference"]

                    if doctors:
                        self.recommended_doctors[patient_id] = doctors
                        rec_msg = format_doctor_recommendations(doctors, language=lang)
                        return f"{completion_msg}\n\n{rec_msg}"
                    else:
                        self.recommended_doctors.pop(patient_id, None)
                        fallback_msg = LOCALIZED_NO_DOCTORS_FOUND.get(lang, LOCALIZED_NO_DOCTORS_FOUND["en"])
                        return f"{completion_msg}\n\n{fallback_msg}"
                except Exception as rec_err:
                    logger.warning("Could not retrieve doctor recommendations for session %s: %s", session_id, rec_err)
                    fallback_msg = LOCALIZED_NO_DOCTORS_FOUND.get(lang, LOCALIZED_NO_DOCTORS_FOUND["en"])
                    return f"{completion_msg}\n\n{fallback_msg}"

            # 4. NEXT QUESTION: Continue the adaptive questioning flow
            next_q = respond_data.get("next_question") or respond_data.get("nextQuestion")
            if next_q:
                return next_q

            # Fallback if no next question and session not marked complete
            self.sessions.pop(patient_id, None)
            self.pending_complaint.discard(patient_id)
            return LOCALIZED_COMPLETION_MESSAGE.get(lang, COMPLETION_MESSAGE)


        except ClinicalAPIError as exc:
            logger.error("Clinical AI API error for patient '%s': %s", patient_id, exc)
            return ERROR_MESSAGE
        except Exception as exc:
            logger.exception("Unexpected error in clinical client handling for patient '%s': %s", patient_id, exc)
            return ERROR_MESSAGE
