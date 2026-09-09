import unittest
from unittest.mock import MagicMock, patch

from chatbot.whatsapp.bot import (
    WhatsAppBot,
    generate_response,
    _module_menu_states,
    _module_user_languages,
)
from chatbot.whatsapp.config import (
    WhatsAppState,
    format_confirmation_message,
    format_doctor_recommendations,
    format_doctor_slots,
    format_invalid_doctor_choice,
    format_invalid_slot_choice,
    LOCALIZED_NO_DOCTORS_FOUND,
    LOCALIZED_SLOT_CONFLICT,
    LOCALIZED_RESET_MESSAGE,
    DEFAULT_LANGUAGE,
)
from chatbot.whatsapp.clinical_client import ClinicalClient


class TestDoctorRecommendationsAndBooking(unittest.TestCase):
    """
    Test suite for post-assessment doctor recommendations and appointment booking:
    1. Completion transitions to WAITING_FOR_DOCTOR_SELECTION with top-5 doctors.
    2. Valid doctor choice transitions to WAITING_FOR_APPOINTMENT_SELECTION.
    3. Invalid doctor choice reprompts with localized warning.
    4. Slot selection books appointment and returns localized confirmation.
    5. Invalid slot choice reprompts with localized warning.
    6. Double-booking conflict (409) refreshes slots and reprompts.
    7. Multilingual support across en, hi, mr, gu.
    8. Accessibility preference and Sarvam TTS audio invocation.
    9. Reset command clears all appointment booking contexts.
    """

    def setUp(self):
        _module_menu_states.clear()
        _module_user_languages.clear()

        self.mock_auth = MagicMock()
        self.mock_auth.is_linked.return_value = True
        self.mock_auth.get_account_language.return_value = "en"

        self.mock_client = MagicMock(spec=ClinicalClient)
        self.mock_client.sessions = {}
        self.mock_client.pending_complaint = set()
        self.mock_client.completed_summaries = {}
        self.mock_client.recommended_doctors = {}
        self.mock_client.selected_doctor = {}
        self.mock_client.available_slots = {}
        self.mock_client.last_completed_session = {}
        self.mock_client.patient_accessibility = {}

        self.sample_doctors = [
            {
                "id": "doc-001",
                "name": "Dr. Ramesh Gupta",
                "specialization": "Cardiology",
                "experience": 12,
            },
            {
                "id": "doc-002",
                "name": "Dr. Priya Patel",
                "specialization": "General Medicine",
                "experience": 8,
            },
        ]

        self.sample_slots = [
            {"time": "09:00", "time12": "09:00 AM", "scheduledAt": "2026-09-10T09:00:00+05:30"},
            {"time": "09:30", "time12": "09:30 AM", "scheduledAt": "2026-09-10T09:30:00+05:30"},
        ]

    # 1. Intake completion leads to WAITING_FOR_DOCTOR_SELECTION
    def test_intake_completion_transitions_to_doctor_selection(self):
        phone = "+919876543210"
        self.mock_client.get_session_id.return_value = None  # Intake just ended
        self.mock_client.recommended_doctors[phone] = self.sample_doctors
        self.mock_client.last_completed_session[phone] = "sess-123"
        self.mock_client.handle_message.return_value = "Clinical assessment complete."

        _module_menu_states[phone] = WhatsAppState.CLINICAL_SESSION
        resp = generate_response("No other symptoms", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertEqual(resp, "Clinical assessment complete.")
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_DOCTOR_SELECTION)

    # 2. Doctor selection with valid index transitions to WAITING_FOR_APPOINTMENT_SELECTION
    def test_valid_doctor_selection_queries_slots(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors
        self.mock_client.last_completed_session[phone] = "sess-123"
        self.mock_client.get_doctor_slots.return_value = {
            "success": True,
            "date": "2026-09-10",
            "slots": self.sample_slots,
        }

        resp = generate_response("1", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertIn("Dr. Ramesh Gupta", resp)
        self.assertIn("09:00 AM", resp)
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION)
        self.assertEqual(self.mock_client.selected_doctor[phone]["id"], "doc-001")
        self.assertEqual(len(self.mock_client.available_slots[phone]), 2)

    # 3. Invalid doctor index reprompts patient
    def test_invalid_doctor_selection_reprompts(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors

        resp = generate_response("5", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertEqual(resp, format_invalid_doctor_choice(2, language="en"))
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_DOCTOR_SELECTION)

    # 4. Non-numeric doctor input reprompts patient
    def test_non_numeric_doctor_selection_reprompts(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors

        resp = generate_response("doctor please", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertEqual(resp, format_invalid_doctor_choice(2, language="en"))
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_DOCTOR_SELECTION)

    # 5. Slot selection books appointment and confirms
    def test_valid_slot_selection_books_appointment(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION
        self.mock_client.selected_doctor[phone] = self.sample_doctors[0]
        self.mock_client.available_slots[phone] = self.sample_slots
        self.mock_client.last_completed_session[phone] = "sess-123"

        self.mock_client.book_appointment.return_value = {
            "success": True,
            "status_code": 201,
            "data": {
                "appointment": {"id": "apt-999"},
            },
        }

        resp = generate_response("1", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.mock_client.book_appointment.assert_called_once_with(
            patient_id=phone,
            session_id="sess-123",
            doctor_id="doc-001",
            scheduled_at="2026-09-10T09:00:00+05:30",
        )
        self.assertIn("Confirmed", resp)
        self.assertIn("Dr. Ramesh Gupta", resp)
        self.assertNotIn(phone, _module_menu_states)

    # 6. Invalid slot choice reprompts patient
    def test_invalid_slot_selection_reprompts(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION
        self.mock_client.available_slots[phone] = self.sample_slots
        self.mock_client.selected_doctor[phone] = self.sample_doctors[0]

        resp = generate_response("9", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertEqual(resp, format_invalid_slot_choice(2, language="en"))
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION)

    # 7. Slot conflict (409) refreshes slots and reprompts
    def test_slot_conflict_refreshes_slots(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION
        self.mock_client.selected_doctor[phone] = self.sample_doctors[0]
        self.mock_client.available_slots[phone] = self.sample_slots
        self.mock_client.last_completed_session[phone] = "sess-123"

        # Simulate 409 conflict
        self.mock_client.book_appointment.return_value = {
            "success": False,
            "status_code": 409,
            "data": {"error": "Slot already taken"},
        }
        refreshed_slots = [
            {"time": "10:00", "time12": "10:00 AM", "scheduledAt": "2026-09-10T10:00:00+05:30"}
        ]
        self.mock_client.get_doctor_slots.return_value = {
            "success": True,
            "date": "2026-09-10",
            "slots": refreshed_slots,
        }

        resp = generate_response("1", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertIn(LOCALIZED_SLOT_CONFLICT["en"], resp)
        self.assertIn("10:00 AM", resp)
        self.assertEqual(self.mock_client.available_slots[phone], refreshed_slots)

    # 8. Multilingual formatting in Hindi
    def test_multilingual_hindi_flow(self):
        self.mock_auth.get_account_language.return_value = "hi"
        phone = "+919876543210"
        _module_user_languages[phone] = "hi"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors
        self.mock_client.last_completed_session[phone] = "sess-123"

        # Invalid choice in Hindi
        resp = generate_response("9", patient_id=phone, client=self.mock_client, auth=self.mock_auth)
        self.assertEqual(resp, format_invalid_doctor_choice(2, language="hi"))

        # Valid choice in Hindi
        self.mock_client.get_doctor_slots.return_value = {
            "success": True,
            "date": "2026-09-10",
            "slots": self.sample_slots,
        }
        resp_slots = generate_response("1", patient_id=phone, client=self.mock_client, auth=self.mock_auth)
        self.assertIn("उपलब्ध अपॉइंटमेंट्स", resp_slots)

    # 9. Multilingual formatting in Marathi
    def test_multilingual_marathi_flow(self):
        self.mock_auth.get_account_language.return_value = "mr"
        phone = "+919876543210"
        _module_user_languages[phone] = "mr"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors

        resp = generate_response("9", patient_id=phone, client=self.mock_client, auth=self.mock_auth)
        self.assertEqual(resp, format_invalid_doctor_choice(2, language="mr"))

    # 10. Multilingual formatting in Gujarati
    def test_multilingual_gujarati_flow(self):
        self.mock_auth.get_account_language.return_value = "gu"
        phone = "+919876543210"
        _module_user_languages[phone] = "gu"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors

        resp = generate_response("9", patient_id=phone, client=self.mock_client, auth=self.mock_auth)
        self.assertEqual(resp, format_invalid_doctor_choice(2, language="gu"))

    # 11. Reset clears booking states
    def test_reset_clears_booking_state(self):
        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
        self.mock_client.recommended_doctors[phone] = self.sample_doctors
        self.mock_client.last_completed_session[phone] = "sess-123"

        resp = generate_response("/reset", patient_id=phone, client=self.mock_client, auth=self.mock_auth)

        self.assertEqual(resp, LOCALIZED_RESET_MESSAGE["en"])
        self.assertNotIn(phone, _module_menu_states)
        self.mock_client.reset_session.assert_called_once_with(phone)

    # 12. Accessibility preference TTS check
    def test_accessibility_voice_guidance_triggers_tts(self):
        bot = WhatsAppBot(clinical_client_instance=self.mock_client, auth_client_instance=self.mock_auth)
        phone = "+919876543210"
        self.mock_client.patient_accessibility[phone] = "voice_guidance"

        with patch.object(self.mock_client, "synthesize_speech", return_value=b"RIFFWAVE...") as mock_synth:
            with patch.object(bot, "send_audio", return_value=True) as mock_send_audio:
                bot._send_tts_if_enabled(phone, "Your appointment is confirmed.", "en")
                mock_synth.assert_called_once_with("Your appointment is confirmed.", language="en")
                mock_send_audio.assert_called_once_with(b"RIFFWAVE...")

    # 13. Accessibility standard preference does NOT trigger TTS
    def test_accessibility_standard_does_not_trigger_tts(self):
        bot = WhatsAppBot(clinical_client_instance=self.mock_client, auth_client_instance=self.mock_auth)
        phone = "+919876543210"
        self.mock_client.patient_accessibility[phone] = "none"

        with patch.object(self.mock_client, "synthesize_speech") as mock_synth:
            bot._send_tts_if_enabled(phone, "Your appointment is confirmed.", "en")
            mock_synth.assert_not_called()

    # 14. TTS failure never raises error
    def test_tts_failure_does_not_raise_error(self):
        bot = WhatsAppBot(clinical_client_instance=self.mock_client, auth_client_instance=self.mock_auth)
        phone = "+919876543210"
        self.mock_client.patient_accessibility[phone] = "voice_guidance"

        with patch.object(self.mock_client, "synthesize_speech", side_effect=Exception("TTS server down")):
            # Should not raise any exception
            bot._send_tts_if_enabled(phone, "Hello", "en")


if __name__ == "__main__":
    unittest.main()
