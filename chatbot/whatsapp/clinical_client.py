import logging
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
        WHATSAPP_SERVICE_KEY,
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
        WHATSAPP_SERVICE_KEY,
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
        """Clears the active clinical session and pending states for a patient."""
        if patient_id in self.sessions:
            logger.info("Resetting clinical session for patient: %s", patient_id)
            del self.sessions[patient_id]
        self.pending_complaint.discard(patient_id)

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

    def handle_message(self, patient_id: str, message: str) -> str:
        """
        High-level entry point called by the WhatsApp Selenium bot.

        Orchestrates:
        1. Prompting for chief complaint upon Option 1 selection.
        2. Starting the session using the patient's symptom description.
        3. Advancing the clinical session through the shared backend pipeline.
        4. Safety red-flag logging.
        5. Triggering physician summary generation upon completion and saving to PostgreSQL.
        6. Returning user-facing text to send back to WhatsApp.
        """
        cleaned = message.strip()
        if not cleaned:
            return ""

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
                    return CHIEF_COMPLAINT_PROMPT

                # Never accept bot prompts or prompt instructions as a patient chief complaint
                cleaned_lower = cleaned.lower()
                if (
                    cleaned_lower == CHIEF_COMPLAINT_PROMPT.lower()
                    or "let's begin your clinical assessment" in cleaned_lower
                    or "describe your main health concern" in cleaned_lower
                    or "example: \"i have had chest pain since this morning\"" in cleaned_lower
                ):
                    logger.warning(
                        "Prompt text echo detected as chief complaint for patient '%s': '%s'. Ignoring.",
                        patient_id, cleaned[:40]
                    )
                    return ""

                # Patient sent symptom description (or directly provided first text)
                chief_complaint = cleaned
                self.pending_complaint.discard(patient_id)

                logger.info("New WhatsApp patient detected: '%s'. Starting clinical intake with complaint: '%s'", patient_id, chief_complaint)
                start_data = self.start_session(
                    patient_id=patient_id,
                    language=DEFAULT_LANGUAGE,
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

                # Clear active session mapping so patient can start anew in future
                self.sessions.pop(patient_id, None)
                self.pending_complaint.discard(patient_id)

                return COMPLETION_MESSAGE

            # 4. NEXT QUESTION: Continue the adaptive questioning flow
            next_q = respond_data.get("next_question") or respond_data.get("nextQuestion")
            if next_q:
                return next_q

            # Fallback if no next question and session not marked complete
            self.sessions.pop(patient_id, None)
            self.pending_complaint.discard(patient_id)
            return COMPLETION_MESSAGE

        except ClinicalAPIError as exc:
            logger.error("Clinical AI API error for patient '%s': %s", patient_id, exc)
            return ERROR_MESSAGE
        except Exception as exc:
            logger.exception("Unexpected error in clinical client handling for patient '%s': %s", patient_id, exc)
            return ERROR_MESSAGE
