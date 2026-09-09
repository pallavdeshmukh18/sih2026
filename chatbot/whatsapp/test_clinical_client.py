import unittest
from unittest.mock import MagicMock, patch
import requests

from chatbot.whatsapp.clinical_client import ClinicalClient, ClinicalAPIError
from chatbot.whatsapp.auth_client import WhatsAppAuthClient
from chatbot.whatsapp.config import (
    CHIEF_COMPLAINT_PROMPT,
    COMPLETION_MESSAGE,
    ERROR_MESSAGE,
    EXIT_TEXT,
    INVALID_MENU_TEXT,
    INVALID_TOKEN_MESSAGE,
    LANGUAGE_SELECTION_MESSAGE,
    LINKING_INSTRUCTIONS_MESSAGE,
    LOCALIZED_MENUS,
    MENU_MESSAGE,
    MENU_TEXT,
    UPLOAD_REPORT_TEXT,
    WhatsAppState,
    format_link_success_message,
)


class TestClinicalClient(unittest.TestCase):

    def setUp(self):
        self.client = ClinicalClient(base_url="http://localhost:8000")

    @patch("requests.post")
    def test_start_session_request(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "session_id": "test-session-123",
            "next_question": "When did your symptoms start?",
            "state": {}
        }
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        res = self.client.start_session(
            patient_id="+919876543210",
            language="en",
            consultation_type="allopathic",
            chief_complaint="generic"
        )

        self.assertEqual(res["session_id"], "test-session-123")
        self.assertEqual(res["next_question"], "When did your symptoms start?")

        # Check call arguments
        mock_post.assert_called_once_with(
            "http://localhost:8000/api/whatsapp/clinical/session/start",
            json={
                "whatsapp_id": "+919876543210",
                "patient_id": "+919876543210",
                "language": "en",
                "consultation_type": "allopathic",
                "chief_complaint": "generic"
            },
            headers={
                "Content-Type": "application/json",
                "X-WhatsApp-Service-Key": self.client.service_key,
            },
            timeout=self.client.timeout
        )

    def test_handle_message_option_1_prompts_for_chief_complaint(self):
        reply = self.client.handle_message("+919876543210", "1")
        self.assertTrue("health concern" in reply.lower() or "symptom" in reply.lower())
        self.assertIn("+919876543210", self.client.pending_complaint)

    @patch("requests.post")
    def test_handle_message_symptom_after_option_1_starts_session(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "session_id": "session-uuid-abc",
            "next_question": "When did the chest pain start?",
            "state": {}
        }
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        # Step 1: User sends "1"
        self.client.handle_message("+919876543210", "1")
        self.assertIn("+919876543210", self.client.pending_complaint)

        # Step 2: User sends symptom
        reply = self.client.handle_message("+919876543210", "I have chest pain since morning")
        self.assertEqual(reply, "When did the chest pain start?")
        self.assertEqual(self.client.get_session_id("+919876543210"), "session-uuid-abc")
        self.assertNotIn("+919876543210", self.client.pending_complaint)

    @patch("requests.post")
    def test_handle_message_first_message_starts_session(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "session_id": "session-uuid-abc",
            "next_question": "What brings you in today?",
            "state": {}
        }
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        reply = self.client.handle_message(
            patient_id="+919876543210",
            message="Hi there"
        )

        self.assertEqual(reply, "What brings you in today?")
        self.assertEqual(self.client.get_session_id("+919876543210"), "session-uuid-abc")

    @patch("requests.post")
    def test_handle_message_subsequent_message_responds(self, mock_post):
        # Pre-seed session
        self.client.set_session_id("+919876543210", "session-uuid-abc")

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "next_question": "How severe is the pain on a scale of 1 to 10?",
            "extracted_entities": [{"field": "onset", "value": "yesterday", "confidence": "High"}],
            "red_flags": [],
            "is_complete": False
        }
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        reply = self.client.handle_message(
            patient_id="+919876543210",
            message="It started yesterday"
        )

        self.assertEqual(reply, "How severe is the pain on a scale of 1 to 10?")
        mock_post.assert_called_once_with(
            "http://localhost:8000/api/whatsapp/clinical/session/session-uuid-abc/text-turn",
            json={
                "session_id": "session-uuid-abc",
                "whatsapp_id": "+919876543210",
                "patient_text": "It started yesterday"
            },
            headers={
                "Content-Type": "application/json",
                "X-WhatsApp-Service-Key": self.client.service_key,
            },
            timeout=self.client.timeout
        )

    @patch("requests.post")
    def test_handle_message_completion_flow(self, mock_post):
        self.client.set_session_id("+919876543210", "session-uuid-abc")

        # Mock respond returning is_complete: True
        respond_resp = MagicMock()
        respond_resp.json.return_value = {
            "next_question": None,
            "extracted_entities": [],
            "red_flags": [],
            "is_complete": True
        }
        respond_resp.raise_for_status.return_value = None

        # Mock summary call
        summary_resp = MagicMock()
        summary_resp.json.return_value = {
            "session_id": "session-uuid-abc",
            "summary": "# Clinical Summary\nPatient completed intake."
        }
        summary_resp.raise_for_status.return_value = None

        mock_post.side_effect = [respond_resp, summary_resp]

        reply = self.client.handle_message(
            patient_id="+919876543210",
            message="No other symptoms"
        )

        self.assertIn(COMPLETION_MESSAGE, reply)
        # Active session should now be cleared
        self.assertIsNone(self.client.get_session_id("+919876543210"))
        # Summary should be cached
        self.assertIn("+919876543210", self.client.completed_summaries)

    @patch("requests.post")
    def test_handle_message_api_failure_returns_graceful_error(self, mock_post):
        mock_post.side_effect = requests.RequestException("Connection refused")

        reply = self.client.handle_message(
            patient_id="+919876543210",
            message="Hello doctor"
        )

        self.assertEqual(reply, ERROR_MESSAGE)

    def test_reset_command(self):
        self.client.set_session_id("+919876543210", "session-uuid-abc")
        reply = self.client.handle_message("+919876543210", "/reset")
        self.assertIn("reset", reply.lower())
        self.assertIsNone(self.client.get_session_id("+919876543210"))


class TestGroupDetection(unittest.TestCase):
    """Focused unit tests for is_group_chat() DOM logic without launching Chrome."""

    def setUp(self):
        from chatbot.whatsapp.bot import WhatsAppBot
        self.bot = WhatsAppBot()
        self.bot.driver = MagicMock()

    def test_known_group_cache_hit(self):
        self.bot.known_group_chats.add("Family Group")
        self.bot._get_active_chat_title = MagicMock(return_value="Family Group")
        self.assertTrue(self.bot.is_group_chat())

    def test_individual_chat_returns_false(self):
        self.bot._get_active_chat_title = MagicMock(return_value="John Doe")
        mock_header = MagicMock()
        mock_header.text = "John Doe\nonline"
        mock_header.find_elements.return_value = []
        self.bot.driver.find_elements.side_effect = lambda by, xpath: (
            [mock_header] if "header" in xpath else []
        )
        self.assertFalse(self.bot.is_group_chat())

    def test_self_chat_returns_false(self):
        self.bot._get_active_chat_title = MagicMock(return_value="You")
        mock_header = MagicMock()
        mock_header.text = "You\nMessage yourself"
        mock_subtitle = MagicMock()
        mock_subtitle.get_attribute.return_value = "Message yourself"
        mock_subtitle.text = "Message yourself"
        mock_header.find_elements.side_effect = lambda by, xpath: (
            [mock_subtitle] if "selectable-text" in xpath or "title" in xpath else []
        )
        self.bot.driver.find_elements.side_effect = lambda by, xpath: (
            [mock_header] if "header" in xpath else []
        )
        self.assertFalse(self.bot.is_group_chat())

    def test_contact_with_comma_in_name_not_detected_as_group(self):
        # Format: "Smith, John"
        self.bot._get_active_chat_title = MagicMock(return_value="Smith, John")
        mock_header = MagicMock()
        mock_header.text = "Smith, John\nonline"
        mock_sub = MagicMock()
        mock_sub.get_attribute.return_value = "Smith, John"
        mock_sub.text = "Smith, John"
        mock_header.find_elements.side_effect = lambda by, xpath: (
            [mock_sub] if "selectable-text" in xpath or "title" in xpath else []
        )
        self.bot.driver.find_elements.side_effect = lambda by, xpath: (
            [mock_header] if "header" in xpath else []
        )
        self.assertFalse(self.bot.is_group_chat())

    def test_group_detected_by_header_group_icon(self):
        self.bot._get_active_chat_title = MagicMock(return_value="SIH 2026 Team")
        mock_header = MagicMock()
        mock_header.text = "SIH 2026 Team"
        mock_icon = MagicMock()
        mock_header.find_elements.side_effect = lambda by, xpath: (
            [mock_icon] if "default-group" in xpath or "community" in xpath else []
        )
        self.bot.driver.find_elements.side_effect = lambda by, xpath: (
            [mock_header] if "header" in xpath else []
        )
        self.assertTrue(self.bot.is_group_chat())
        self.assertIn("SIH 2026 Team", self.bot.known_group_chats)

    def test_group_detected_by_member_subtitle_list(self):
        self.bot._get_active_chat_title = MagicMock(return_value="Family Chat")
        mock_header = MagicMock()
        mock_header.text = "Family Chat\nYou, Mom, Dad"
        mock_sub = MagicMock()
        mock_sub.get_attribute.return_value = "You, Mom, Dad"
        mock_sub.text = "You, Mom, Dad"
        mock_header.find_elements.side_effect = lambda by, xpath: (
            [mock_sub] if "selectable-text" in xpath or "title" in xpath else []
        )
        self.bot.driver.find_elements.side_effect = lambda by, xpath: (
            [mock_header] if "header" in xpath else []
        )
        self.assertTrue(self.bot.is_group_chat())
        self.assertIn("Family Chat", self.bot.known_group_chats)

    def test_group_detected_by_author_color_tags(self):
        self.bot._get_active_chat_title = MagicMock(return_value="College Batch")
        mock_header = MagicMock()
        mock_header.text = "College Batch"
        mock_header.find_elements.return_value = []
        mock_author_tag = MagicMock()

        def side_effect(by, xpath):
            if "header" in xpath:
                return [mock_header]
            if "color-" in xpath:
                return [mock_author_tag]
            return []

        self.bot.driver.find_elements.side_effect = side_effect
        self.assertTrue(self.bot.is_group_chat())
        self.assertIn("College Batch", self.bot.known_group_chats)


class TestMessageProcessingAndGroupCommunityRules(unittest.TestCase):
    """
    Unit tests for the Menu-driven interface and strict behavioral rules:
    1. "hello medikiosk" -> MENU
    2. "HELLO MEDIKIOSK" -> MENU
    3. "hello" -> ignored
    4. "hello medikiosk please" -> ignored
    5. MENU + "1" -> starts ClinicalClient session
    6. MENU + "2" -> upload-not-available response -> remains MENU
    7. MENU + "3" -> exits -> clears state
    8. MENU + "hello" -> invalid menu response -> remains MENU
    9. MENU + "I have headache" -> invalid menu response -> ClinicalClient NOT called
    10. Active clinical session + "1" -> sent to ClinicalClient -> NOT treated as menu
    11. Group + "hello medikiosk" -> ignored -> no menu -> no ClinicalClient
    12. Community + "hello medikiosk" -> ignored -> no menu -> no ClinicalClient
    13. Community announcement + "hello medikiosk" -> ignored
    Plus Self-chat preservation and /reset handling.
    """

    def setUp(self):
        from chatbot.whatsapp.bot import WhatsAppBot
        self.bot = WhatsAppBot()
        self.bot.driver = MagicMock()
        self.bot.clinical_client = MagicMock()
        self.bot.auth_client = MagicMock()
        self.bot.auth_client.is_linked.return_value = True
        self.bot.send_message = MagicMock(return_value=True)
        self.bot._send_reply = self.bot.send_message


    def _setup_mock_chat(
        self,
        chat_title: str,
        message_text: str,
        is_group: bool = False,
        is_community: bool = False,
        is_announcement: bool = False,
        is_self: bool = False,
    ):
        self.bot._is_main_chat_open = MagicMock(return_value=True)
        self.bot._get_active_chat_title = MagicMock(return_value=chat_title)

        mock_header = MagicMock()
        if is_self:
            mock_header.text = f"{chat_title}\nMessage yourself"
        elif is_community or is_announcement:
            mock_header.text = f"{chat_title}\nCommunity • Announcements"
        elif is_group:
            mock_header.text = f"{chat_title}\nYou, Alice, Bob"
        else:
            mock_header.text = f"{chat_title}\nonline"

        def header_find(by, xpath):
            if is_group and ("default-group" in xpath or "group" in xpath):
                return [MagicMock()]
            if (is_community or is_announcement) and ("community" in xpath or "announcement" in xpath):
                return [MagicMock()]
            if is_group and ("selectable-text" in xpath or "title" in xpath):
                sub = MagicMock()
                sub.get_attribute.return_value = "You, Alice, Bob"
                sub.text = "You, Alice, Bob"
                return [sub]
            if is_self and ("selectable-text" in xpath or "title" in xpath):
                sub = MagicMock()
                sub.get_attribute.return_value = "Message yourself"
                sub.text = "Message yourself"
                return [sub]
            return []

        mock_header.find_elements.side_effect = header_find

        def driver_find(by, xpath):
            if "header" in xpath:
                return [mock_header]
            if is_announcement and "admin" in xpath.lower():
                return [MagicMock()]
            if is_group and "color-" in xpath:
                return [MagicMock()]
            return []

        self.bot.driver.find_elements.side_effect = driver_find

        # Mock message row
        mock_row = MagicMock()
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row])
        self.bot._extract_text_from_element = MagicMock(return_value=message_text)
        self.bot._is_outgoing_message = MagicMock(return_value=False)
        self.bot._get_message_identifier = MagicMock(return_value=f"id_{message_text}")

    # 1. "hello medikiosk" -> MENU
    def test_1_hello_medikiosk_shows_menu(self):
        self._setup_mock_chat("Patient_1", "hello medikiosk")
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.MENU)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(MENU_TEXT)

    # 2. "HELLO MEDIKIOSK" -> MENU
    def test_2_uppercase_hello_medikiosk_shows_menu(self):
        self._setup_mock_chat("Patient_1", "HELLO MEDIKIOSK")
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.MENU)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(MENU_TEXT)

    # 3. "hello" -> ignored
    def test_3_hello_ignored(self):
        self._setup_mock_chat("Patient_1", "hello")
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.IDLE)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_not_called()

    # 4. "hello medikiosk please" -> ignored
    def test_4_hello_medikiosk_please_ignored(self):
        self._setup_mock_chat("Patient_1", "hello medikiosk please")
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.IDLE)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_not_called()

    # 5. MENU + "1" -> starts ClinicalClient session
    def test_5_menu_option_1_starts_clinical_session(self):
        self._setup_mock_chat("Patient_1", "1")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)
        self.bot.clinical_client.get_session_id.return_value = None
        self.bot.clinical_client.handle_message.return_value = "When did your symptoms start?"

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.CLINICAL_SESSION)
        self.bot.clinical_client.handle_message.assert_called_once_with(
            patient_id="Patient_1", message="1"
        )
        self.bot._send_reply.assert_called_once_with("When did your symptoms start?")

    # 6. MENU + "2" -> upload-not-available response -> remains MENU
    def test_6_menu_option_2_upload_report_not_available_remains_menu(self):
        self._setup_mock_chat("Patient_1", "2")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.MENU)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(UPLOAD_REPORT_TEXT)

    # 7. MENU + "3" -> exits -> clears state
    def test_7_menu_option_3_exits_and_clears_state(self):
        self._setup_mock_chat("Patient_1", "3")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.IDLE)
        self.bot.clinical_client.reset_session.assert_called_once_with("Patient_1")
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(EXIT_TEXT)

    # 8. MENU + "hello" -> invalid menu response -> remains MENU
    def test_8_menu_hello_invalid_menu_response_remains_menu(self):
        self._setup_mock_chat("Patient_1", "hello")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.MENU)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(INVALID_MENU_TEXT)

    # 9. MENU + "I have headache" -> invalid menu response -> ClinicalClient NOT called
    def test_9_menu_headache_invalid_menu_response_no_clinical(self):
        self._setup_mock_chat("Patient_1", "I have headache")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.MENU)
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_called_once_with(INVALID_MENU_TEXT)

    # 10. Active clinical session + "1" -> sent to ClinicalClient -> NOT treated as menu
    def test_10_active_clinical_session_1_sent_to_clinical_client(self):
        self._setup_mock_chat("Patient_1", "1")
        self.bot.set_menu_state("Patient_1", WhatsAppState.CLINICAL_SESSION)
        self.bot.clinical_client.get_session_id.return_value = "active-session-uuid"
        self.bot.clinical_client.handle_message.return_value = "Pain severity 1 recorded. Any other symptoms?"

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.CLINICAL_SESSION)
        self.bot.clinical_client.handle_message.assert_called_once_with(
            patient_id="Patient_1", message="1"
        )
        self.bot._send_reply.assert_called_once_with("Pain severity 1 recorded. Any other symptoms?")

    # 11. Group + "hello medikiosk" -> ignored -> no menu -> no ClinicalClient
    def test_11_group_hello_medikiosk_ignored(self):
        self._setup_mock_chat("Family Group", "hello medikiosk", is_group=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("Family Group"), WhatsAppState.IDLE)
        self.assertTrue(self.bot.is_group_or_community_chat())
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_not_called()

    # 12. Community + "hello medikiosk" -> ignored -> no menu -> no ClinicalClient
    def test_12_community_hello_medikiosk_ignored(self):
        self._setup_mock_chat("Tech Community", "hello medikiosk", is_community=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("Tech Community"), WhatsAppState.IDLE)
        self.assertTrue(self.bot.is_community_chat())
        self.assertTrue(self.bot.is_group_or_community_chat())
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_not_called()

    # 13. Community announcement + "hello medikiosk" -> ignored
    def test_13_community_announcement_hello_medikiosk_ignored(self):
        self._setup_mock_chat("Official Announcements", "hello medikiosk", is_announcement=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("Official Announcements"), WhatsAppState.IDLE)
        self.assertTrue(self.bot.is_community_chat())
        self.assertTrue(self.bot.is_group_or_community_chat())
        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot._send_reply.assert_not_called()

    # Self-chat test: preserved
    def test_self_chat_preserved(self):
        self._setup_mock_chat("You", "hello medikiosk", is_self=True)
        self.bot.clinical_client.get_session_id.return_value = None

        self.assertFalse(self.bot.is_group_chat())
        self.assertFalse(self.bot.is_community_chat())
        self.assertFalse(self.bot.is_group_or_community_chat())

        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("You"), WhatsAppState.MENU)
        self.bot._send_reply.assert_called_once_with(MENU_TEXT)

    # Reset / Restart test
    def test_reset_command_clears_menu_and_clinical_state(self):
        self._setup_mock_chat("Patient_1", "/reset")
        self.bot.set_menu_state("Patient_1", WhatsAppState.MENU)

        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("Patient_1"), WhatsAppState.IDLE)
        self.bot.clinical_client.reset_session.assert_called_once_with("Patient_1")

    # Menu Single-Message Delivery Test
    def test_hello_medikiosk_sends_menu_as_exactly_one_message(self):
        self._setup_mock_chat("Patient_1", "hello medikiosk")
        self.bot.clinical_client.get_session_id.return_value = None

        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)

        # 1. Verification: send_message is called EXACTLY ONCE
        self.assertEqual(self.bot.send_message.call_count, 1)
        self.bot.send_message.assert_called_once_with(MENU_MESSAGE)

        # 2. Verification: The message contains all parts combined in one string
        sent_msg = self.bot.send_message.call_args[0][0]
        self.assertIn("MediKiosk", sent_msg)
        self.assertIn("AI Patient Assistant", sent_msg)
        self.assertIn("Welcome to MediKiosk", sent_msg)
        self.assertIn("1️⃣", sent_msg)
        self.assertIn("Start Consultation", sent_msg)
        self.assertIn("2️⃣", sent_msg)
        self.assertIn("Upload Medical Report", sent_msg)
        self.assertIn("3️⃣", sent_msg)
        self.assertIn("Exit", sent_msg)
        self.assertIn("Reply with 1, 2, or 3", sent_msg)

        # 3. Verification: Duplicate protection prevents second menu send for same message
        second_res = self.bot._check_active_chat_messages()
        self.assertFalse(second_res)
        self.assertEqual(self.bot.send_message.call_count, 1)

    @patch("chatbot.whatsapp.bot.ActionChains")
    def test_send_reply_types_multiline_menu_with_shift_enter(self, mock_action_chains):
        from chatbot.whatsapp.bot import WhatsAppBot
        from selenium.webdriver.common.keys import Keys
        bot = WhatsAppBot()
        bot.driver = MagicMock()

        mock_input = MagicMock()
        mock_input.is_displayed.return_value = True
        bot.driver.find_elements.return_value = [mock_input]

        mock_chain = MagicMock()
        mock_action_chains.return_value = mock_chain
        mock_chain.move_to_element.return_value = mock_chain
        mock_chain.click.return_value = mock_chain
        mock_chain.key_down.return_value = mock_chain
        mock_chain.send_keys.return_value = mock_chain
        mock_chain.key_up.return_value = mock_chain

        res = bot.send_message(MENU_MESSAGE)
        self.assertTrue(res)

        # Total newlines in MENU_MESSAGE
        newline_count = MENU_MESSAGE.count("\n")
        # Shift+Enter was called for every newline in MENU_MESSAGE
        self.assertEqual(mock_chain.key_down.call_count, newline_count)
        self.assertEqual(mock_chain.key_up.call_count, newline_count)

        # Enter was pressed only once at the end to submit the entire message
        mock_input.send_keys.assert_called_with(Keys.ENTER)



class TestWhatsAppAuthenticationAndLinking(unittest.TestCase):
    """
    Unit tests for WhatsApp Account Linking and Authentication Flow (Requirements 1-12):
    1. Unlinked user + 'hello medikiosk' -> token instructions (WAITING_FOR_TOKEN)
    2. Unlinked user + random message -> no response
    3. WAITING_FOR_TOKEN + valid token -> backend link endpoint called -> account linked -> success message
    4. WAITING_FOR_TOKEN + invalid token -> invalid-token message -> remains WAITING_FOR_TOKEN
    5. Linked user + 'hello medikiosk' -> normal menu
    6. Linked user + 'hello' -> no response
    7. Group + 'hello medikiosk' -> no response (never authenticate in groups)
    8. Community + 'hello medikiosk' -> no response
    9. Community announcement + 'hello medikiosk' -> no response
    10. Token must never be sent to ClinicalClient
    11. Token must not appear in logs
    12. After successful linking, restarting the Selenium bot must still
        recognize the WhatsApp user as linked by querying the backend.
    """

    def setUp(self):
        from chatbot.whatsapp.bot import WhatsAppBot
        self.bot = WhatsAppBot()
        self.bot.driver = MagicMock()
        self.bot.clinical_client = MagicMock()
        self.bot.clinical_client.get_session_id.return_value = None
        self.bot.auth_client = MagicMock()
        self.bot.send_message = MagicMock(return_value=True)
        self.bot._send_reply = self.bot.send_message


    def _setup_mock_chat(
        self,
        chat_title: str,
        message_text: str,
        is_group: bool = False,
        is_community: bool = False,
        is_announcement: bool = False,
        is_self: bool = False,
    ):
        self.bot._is_main_chat_open = MagicMock(return_value=True)
        self.bot._get_active_chat_title = MagicMock(return_value=chat_title)

        mock_header = MagicMock()
        if is_self:
            mock_header.text = f"{chat_title}\nMessage yourself"
        elif is_community or is_announcement:
            mock_header.text = f"{chat_title}\nCommunity • Announcements"
        elif is_group:
            mock_header.text = f"{chat_title}\nYou, Alice, Bob"
        else:
            mock_header.text = f"{chat_title}\nonline"

        def header_find(by, xpath):
            if is_group and ("default-group" in xpath or "group" in xpath):
                return [MagicMock()]
            if (is_community or is_announcement) and ("community" in xpath or "announcement" in xpath):
                return [MagicMock()]
            if is_group and ("selectable-text" in xpath or "title" in xpath):
                sub = MagicMock()
                sub.get_attribute.return_value = "You, Alice, Bob"
                sub.text = "You, Alice, Bob"
                return [sub]
            return []

        mock_header.find_elements.side_effect = header_find

        def driver_find(by, xpath):
            if "header" in xpath:
                return [mock_header]
            if is_announcement and "admin" in xpath.lower():
                return [MagicMock()]
            if is_group and "color-" in xpath:
                return [MagicMock()]
            return []

        self.bot.driver.find_elements.side_effect = driver_find

        mock_row = MagicMock()
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row])
        self.bot._extract_text_from_element = MagicMock(return_value=message_text)
        self.bot._is_outgoing_message = MagicMock(return_value=False)
        self.bot._get_message_identifier = MagicMock(return_value=f"id_{message_text}")

    # 1. Unlinked user + "hello medikiosk" -> language selection -> token instructions (WAITING_FOR_TOKEN)
    def test_1_unlinked_user_hello_medikiosk_shows_token_instructions(self):
        self.bot.auth_client.is_linked.return_value = False
        self._setup_mock_chat("+919876543210", "hello medikiosk")

        # Step 1: activation phrase prompts for language selection
        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.SELECTING_LANGUAGE)
        self.bot.send_message.assert_called_once_with(LANGUAGE_SELECTION_MESSAGE)
        self.bot.clinical_client.handle_message.assert_not_called()

        # Step 2: user selects option 1 (English) -> receives linking instructions
        self.bot.send_message.reset_mock()
        self._setup_mock_chat("+919876543210", "1")
        res2 = self.bot._check_active_chat_messages()

        self.assertTrue(res2)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.WAITING_FOR_TOKEN)
        self.bot.send_message.assert_called_once_with(LINKING_INSTRUCTIONS_MESSAGE)
        self.bot.clinical_client.handle_message.assert_not_called()

    # 1b. Unlinked user selects Hindi ("2") -> receives Hindi linking instructions and persists on token
    def test_1b_unlinked_user_selects_hindi_linking_instructions(self):
        self.bot.auth_client.is_linked.return_value = False
        self.bot.set_menu_state("+919876543210", WhatsAppState.SELECTING_LANGUAGE)
        self._setup_mock_chat("+919876543210", "2")

        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.WAITING_FOR_TOKEN)
        self.assertEqual(self.bot.pending_languages.get("+919876543210"), "hi")
        from chatbot.whatsapp.config import LOCALIZED_LINKING_INSTRUCTIONS
        self.bot.send_message.assert_called_once_with(LOCALIZED_LINKING_INSTRUCTIONS["hi"])

    # 1c. Linked user with language="mr" immediately receives Marathi menu
    def test_1c_linked_user_with_language_receives_marathi_menu(self):
        self.bot.auth_client.is_linked.return_value = True
        self.bot.auth_client.get_account_language.return_value = "mr"
        self._setup_mock_chat("+919876543210", "hello medikiosk")

        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.MENU)
        from chatbot.whatsapp.config import LOCALIZED_MENUS
        self.bot.send_message.assert_called_once_with(LOCALIZED_MENUS["mr"])

    # 1d. Linked user missing language -> prompted for language -> selects "4" -> updates account and shows Gujarati menu
    def test_1d_linked_user_missing_language_prompts_and_updates_account(self):
        self.bot.auth_client.is_linked.return_value = True
        self.bot.auth_client.get_account_language.return_value = None
        self._setup_mock_chat("+919876543210", "hello medikiosk")

        # Step 1: prompted for language
        res = self.bot._check_active_chat_messages()
        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.SELECTING_LANGUAGE)
        self.bot.send_message.assert_called_once_with(LANGUAGE_SELECTION_MESSAGE)

        # Step 2: selects "4" (Gujarati)
        self.bot.send_message.reset_mock()
        self._setup_mock_chat("+919876543210", "4")
        res2 = self.bot._check_active_chat_messages()
        self.assertTrue(res2)
        self.bot.auth_client.update_account_language.assert_called_once_with("+919876543210", "gu")
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.MENU)
        from chatbot.whatsapp.config import LOCALIZED_MENUS
        self.bot.send_message.assert_called_once_with(LOCALIZED_MENUS["gu"])

    # 2. Unlinked user + random message -> no response
    def test_2_unlinked_user_random_message_ignored(self):
        self.bot.auth_client.is_linked.return_value = False
        self._setup_mock_chat("+919876543210", "hello")

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.IDLE)
        self.bot.send_message.assert_not_called()
        self.bot.clinical_client.handle_message.assert_not_called()

    # 3. WAITING_FOR_TOKEN + valid token -> backend link endpoint called -> success message
    def test_3_waiting_for_token_valid_token_links_account(self):
        self.bot.set_menu_state("+919876543210", WhatsAppState.WAITING_FOR_TOKEN)
        self.bot.auth_client.verify_and_link.return_value = {
            "success": True,
            "user_id": "usr-uuid-1234",
            "user_name": "Aarav Sharma",
        }
        self._setup_mock_chat("+919876543210", "E4A9F2")

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.IDLE)
        self.bot.auth_client.verify_and_link.assert_called_once_with(
            whatsapp_id="+919876543210", token="E4A9F2"
        )
        expected_success_msg = format_link_success_message("Aarav Sharma")
        self.bot.send_message.assert_called_once_with(expected_success_msg)
        self.bot.clinical_client.handle_message.assert_not_called()

    # 4. WAITING_FOR_TOKEN + invalid token -> invalid-token message -> remains WAITING_FOR_TOKEN
    def test_4_waiting_for_token_invalid_token_rejects_and_remains_waiting(self):
        self.bot.set_menu_state("+919876543210", WhatsAppState.WAITING_FOR_TOKEN)
        self.bot.auth_client.verify_and_link.return_value = {
            "success": False,
            "message": "The token entered could not be verified or has expired.",
        }
        self._setup_mock_chat("+919876543210", "INVALID99")

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.WAITING_FOR_TOKEN)
        self.bot.send_message.assert_called_once_with(INVALID_TOKEN_MESSAGE)
        self.bot.clinical_client.handle_message.assert_not_called()

    # 5. Linked user + "hello medikiosk" -> normal menu
    def test_5_linked_user_hello_medikiosk_shows_menu(self):
        self.bot.auth_client.is_linked.return_value = True
        self._setup_mock_chat("+919876543210", "hello medikiosk")

        res = self.bot._check_active_chat_messages()

        self.assertTrue(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.MENU)
        self.bot.send_message.assert_called_once_with(MENU_MESSAGE)
        self.bot.clinical_client.handle_message.assert_not_called()

    # 6. Linked user + "hello" -> no response
    def test_6_linked_user_hello_ignored(self):
        self.bot.auth_client.is_linked.return_value = True
        self._setup_mock_chat("+919876543210", "hello")

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.assertEqual(self.bot.get_menu_state("+919876543210"), WhatsAppState.IDLE)
        self.bot.send_message.assert_not_called()

    # 7. Group + "hello medikiosk" -> no response
    def test_7_group_hello_medikiosk_ignored_no_auth(self):
        self.bot.auth_client.is_linked.return_value = False
        self._setup_mock_chat("Medical Team Group", "hello medikiosk", is_group=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.bot.auth_client.is_linked.assert_not_called()
        self.bot.auth_client.verify_and_link.assert_not_called()
        self.bot.send_message.assert_not_called()

    # 8. Community + "hello medikiosk" -> no response
    def test_8_community_hello_medikiosk_ignored_no_auth(self):
        self.bot.auth_client.is_linked.return_value = False
        self._setup_mock_chat("Public Health Community", "hello medikiosk", is_community=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.bot.auth_client.is_linked.assert_not_called()
        self.bot.send_message.assert_not_called()

    # 9. Community announcement + "hello medikiosk" -> no response
    def test_9_community_announcement_hello_medikiosk_ignored_no_auth(self):
        self.bot.auth_client.is_linked.return_value = False
        self._setup_mock_chat("Community Updates", "hello medikiosk", is_announcement=True)

        res = self.bot._check_active_chat_messages()

        self.assertFalse(res)
        self.bot.auth_client.is_linked.assert_not_called()
        self.bot.send_message.assert_not_called()

    # 10. Token must never be sent to ClinicalClient
    def test_10_token_must_never_be_sent_to_clinical_client(self):
        self.bot.set_menu_state("+919876543210", WhatsAppState.WAITING_FOR_TOKEN)
        self.bot.auth_client.verify_and_link.return_value = {
            "success": True,
            "user_id": "usr-123",
            "user_name": "Test Patient",
        }
        self._setup_mock_chat("+919876543210", "SECRET_TOKEN_42")

        self.bot._check_active_chat_messages()

        self.bot.clinical_client.handle_message.assert_not_called()
        self.bot.clinical_client.start_session.assert_not_called()

    # 11. Token must not appear in logs
    def test_11_token_must_not_appear_in_logs(self):
        import logging
        from chatbot.whatsapp.auth_client import WhatsAppAuthClient

        real_auth = WhatsAppAuthClient(base_url="http://localhost:5001")
        secret_token = "TOP_SECRET_AUTH_TOKEN_XYZ_123"

        with patch("requests.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"success": True, "user_id": "u-1", "user_name": "P"}
            mock_post.return_value = mock_resp

            with self.assertLogs("medikiosk.whatsapp.auth_client", level=logging.INFO) as log_capture:
                real_auth.verify_and_link("+919876543210", secret_token)

            for log_msg in log_capture.output:
                self.assertNotIn(
                    secret_token,
                    log_msg,
                    f"Security violation: Plaintext token found in log: {log_msg}",
                )

    # 12. After successful linking, restarting the Selenium bot must still recognize the WhatsApp user as linked by querying the backend
    def test_12_restart_preserves_linking_via_backend_query(self):
        from chatbot.whatsapp.bot import WhatsAppBot

        backend_mock = MagicMock()
        # Simulated backend persists that +919876543210 is linked
        backend_mock.is_linked.side_effect = lambda uid: uid == "+919876543210"

        # Simulate bot restart: create a new WhatsAppBot instance with completely clean memory
        new_bot = WhatsAppBot(auth_client_instance=backend_mock)
        new_bot.driver = MagicMock()
        new_bot.send_message = MagicMock(return_value=True)
        new_bot._send_reply = new_bot.send_message
        new_bot._is_main_chat_open = MagicMock(return_value=True)
        new_bot._get_active_chat_title = MagicMock(return_value="+919876543210")

        mock_header = MagicMock()
        mock_header.text = "+919876543210\nonline"
        mock_header.find_elements.return_value = []
        new_bot.driver.find_elements.side_effect = lambda by, xp: [mock_header] if "header" in xp else []

        mock_row = MagicMock()
        new_bot._get_newest_message_rows = MagicMock(return_value=[mock_row])
        new_bot._extract_text_from_element = MagicMock(return_value="hello medikiosk")
        new_bot._is_outgoing_message = MagicMock(return_value=False)
        new_bot._get_message_identifier = MagicMock(return_value="id_new_session")

        # Before interaction, local memory state is clean/empty (IDLE)
        self.assertEqual(new_bot.get_menu_state("+919876543210"), WhatsAppState.IDLE)

        # Process incoming "hello medikiosk" after restart
        res = new_bot._check_active_chat_messages()

        self.assertTrue(res)
        # Backend was consulted
        backend_mock.is_linked.assert_called_with("+919876543210")
        # Immediately showed normal menu without asking for token!
        new_bot.send_message.assert_called_once_with(MENU_MESSAGE)
        self.assertEqual(new_bot.get_menu_state("+919876543210"), WhatsAppState.MENU)


class TestWhatsAppAuthClient(unittest.TestCase):
    """Unit tests for the WhatsAppAuthClient HTTP client abstraction."""

    def setUp(self):
        self.auth = WhatsAppAuthClient(base_url="http://localhost:5001")

    @patch("requests.get")
    def test_check_link_status_linked(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "linked": True,
            "user_id": "usr-456",
            "user_name": "Pooja",
        }
        mock_get.return_value = mock_resp

        res = self.auth.check_link_status("+919876543210")

        self.assertTrue(res["linked"])
        self.assertEqual(res["user_id"], "usr-456")
        self.assertEqual(res["user_name"], "Pooja")
        mock_get.assert_called_once_with(
            "http://localhost:5001/api/auth/whatsapp/status",
            params={"whatsapp_id": "+919876543210"},
            timeout=10,
        )

    @patch("requests.get")
    def test_check_link_status_unlinked(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"linked": False}
        mock_get.return_value = mock_resp

        self.assertFalse(self.auth.is_linked("+919999999999"))

    @patch("requests.post")
    def test_verify_and_link_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "user_id": "usr-789",
            "user_name": "Vikram",
        }
        mock_post.return_value = mock_resp

        res = self.auth.verify_and_link("+919876543210", "VALID_TOKEN_1")

        self.assertTrue(res["success"])
        self.assertEqual(res["user_id"], "usr-789")
        self.assertEqual(res["user_name"], "Vikram")
        mock_post.assert_called_once_with(
            "http://localhost:5001/api/auth/whatsapp/link",
            json={"whatsapp_id": "+919876543210", "token": "VALID_TOKEN_1"},
            timeout=10,
        )

    @patch("requests.post")
    def test_verify_and_link_invalid_token(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "success": False,
            "message": "The token entered could not be verified or has expired.",
        }
        mock_post.return_value = mock_resp

        res = self.auth.verify_and_link("+919876543210", "EXPIRED_TOKEN")

        self.assertFalse(res["success"])
        self.assertIn("could not be verified", res["message"])


class TestChatOpeningLogic(unittest.TestCase):
    """Unit tests for WhatsAppBot unread badge detection and conversation opening."""

    def test_open_chat_from_badge_clicks_chat_row(self):
        from chatbot.whatsapp.bot import WhatsAppBot

        bot = WhatsAppBot()
        mock_driver = MagicMock()
        bot.driver = mock_driver

        mock_badge = MagicMock()
        mock_row = MagicMock()
        mock_badge.find_element.return_value = mock_row
        mock_row.is_displayed.return_value = True

        mock_driver.execute_script.return_value = "Aarav Sharma"

        opened = bot._open_chat_from_badge(mock_badge)

        self.assertEqual(opened, "Aarav Sharma")
        # Ensure row container was clicked natively or via JS
        self.assertTrue(mock_row.click.called)
        self.assertTrue(mock_driver.execute_script.called)

    def test_wait_for_chat_load_success(self):
        from chatbot.whatsapp.bot import WhatsAppBot

        bot = WhatsAppBot()
        bot._is_main_chat_open = MagicMock(return_value=True)
        bot._get_active_chat_title = MagicMock(return_value="Aarav Sharma")

        loaded = bot._wait_for_chat_load(expected_title="Aarav Sharma", max_wait=0.5)
        self.assertTrue(loaded)

    def test_wait_for_chat_load_timeout(self):
        from chatbot.whatsapp.bot import WhatsAppBot

        bot = WhatsAppBot()
        bot._is_main_chat_open = MagicMock(return_value=False)
        bot._get_active_chat_title = MagicMock(return_value="")

        loaded = bot._wait_for_chat_load(expected_title="Aarav Sharma", max_wait=0.2)
        self.assertFalse(loaded)


class TestWhatsAppUnifiedClinicalAssessmentFlow(unittest.TestCase):
    """End-to-end integration tests for WhatsApp menu selection to unified clinical pipeline."""

    def setUp(self):
        from chatbot.whatsapp.bot import WhatsAppBot
        self.bot = WhatsAppBot()
        self.bot.driver = MagicMock()
        self.bot.auth_client = MagicMock()
        self.bot.auth_client.is_linked.return_value = True
        self.bot.send_message = MagicMock(return_value=True)
        self.bot._send_reply = self.bot.send_message
        self.client = ClinicalClient(base_url="http://localhost:5001")
        self.bot.clinical_client = self.client

    def _simulate_message(self, phone: str, text: str):
        self.bot._is_main_chat_open = MagicMock(return_value=True)
        self.bot._get_active_chat_title = MagicMock(return_value=phone)
        mock_header = MagicMock()
        mock_header.text = f"{phone}\nonline"
        mock_header.find_elements.return_value = []
        self.bot.driver.find_elements.side_effect = lambda by, xp: [mock_header] if "header" in xp else []
        mock_row = MagicMock()
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row])
        self.bot._extract_text_from_element = MagicMock(return_value=text)
        self.bot._is_outgoing_message = MagicMock(return_value=False)
        self.bot._get_message_identifier = MagicMock(return_value=f"id_{phone}_{text}_{len(self.bot.processed_message_ids)}")
        return self.bot._check_active_chat_messages()

    @patch("requests.post")
    def test_e2e_option_1_chief_complaint_turn_completion(self, mock_post):
        phone = "+919876543210"

        # Step 1: User sends "hello medikiosk"
        self._simulate_message(phone, "hello medikiosk")
        self.assertEqual(self.bot.get_menu_state(phone), WhatsAppState.MENU)
        self.bot.send_message.assert_called_with(MENU_MESSAGE)

        # Step 2: User selects "1" (Start Consultation)
        self._simulate_message(phone, "1")
        self.assertEqual(self.bot.get_menu_state(phone), WhatsAppState.CLINICAL_SESSION)
        self.assertIn(phone, self.client.pending_complaint)
        self.bot.send_message.assert_called_with(CHIEF_COMPLAINT_PROMPT)

        # Step 3: User provides chief complaint
        start_mock_resp = MagicMock()
        start_mock_resp.json.return_value = {
            "success": True,
            "session_id": "session-e2e-123",
            "next_question": "When did the chest pain start?",
        }
        start_mock_resp.raise_for_status.return_value = None
        mock_post.return_value = start_mock_resp

        self._simulate_message(phone, "I have severe chest pain since this morning")
        self.assertEqual(self.client.get_session_id(phone), "session-e2e-123")
        self.assertNotIn(phone, self.client.pending_complaint)
        self.bot.send_message.assert_called_with("When did the chest pain start?")

        # Verify start request payload and service key header
        mock_post.assert_called_with(
            "http://localhost:5001/api/whatsapp/clinical/session/start",
            json={
                "whatsapp_id": phone,
                "patient_id": phone,
                "language": "en",
                "consultation_type": "allopathic",
                "chief_complaint": "I have severe chest pain since this morning",
            },
            headers={
                "Content-Type": "application/json",
                "X-WhatsApp-Service-Key": self.client.service_key,
            },
            timeout=10,
        )

        # Step 4: Patient answers question 1
        turn1_mock_resp = MagicMock()
        turn1_mock_resp.json.return_value = {
            "success": True,
            "next_question": "Does the discomfort radiate to your arm or jaw?",
            "is_complete": False,
        }
        turn1_mock_resp.raise_for_status.return_value = None
        mock_post.return_value = turn1_mock_resp

        self._simulate_message(phone, "It started 2 hours ago")
        self.bot.send_message.assert_called_with("Does the discomfort radiate to your arm or jaw?")

        # Step 5: Patient sends "1" as an answer -> Must be treated as clinical answer, NOT menu option 1
        turn2_mock_resp = MagicMock()
        turn2_mock_resp.json.return_value = {
            "success": True,
            "next_question": "Are you experiencing shortness of breath?",
            "is_complete": False,
        }
        turn2_mock_resp.raise_for_status.return_value = None
        mock_post.return_value = turn2_mock_resp

        self._simulate_message(phone, "1")
        self.assertEqual(self.bot.get_menu_state(phone), WhatsAppState.CLINICAL_SESSION)
        self.bot.send_message.assert_called_with("Are you experiencing shortness of breath?")

        # Step 6: Patient sends final answer -> is_complete: True triggers finalize summary
        turn3_mock_resp = MagicMock()
        turn3_mock_resp.json.return_value = {
            "success": True,
            "next_question": None,
            "is_complete": True,
        }
        turn3_mock_resp.raise_for_status.return_value = None

        finalize_mock_resp = MagicMock()
        finalize_mock_resp.json.return_value = {
            "success": True,
            "session_id": "session-e2e-123",
            "summary": "# Clinical Intake Summary\nPatient finalized.",
        }
        finalize_mock_resp.raise_for_status.return_value = None

        mock_post.side_effect = [turn3_mock_resp, finalize_mock_resp]

        self._simulate_message(phone, "No shortness of breath")
        # Bot sends completion message
        sent_arg = self.bot.send_message.call_args[0][0]
        self.assertIn(COMPLETION_MESSAGE, sent_arg)
        # Session state is cleared
        self.assertIsNone(self.client.get_session_id(phone))
        self.assertEqual(self.bot.get_menu_state(phone), WhatsAppState.IDLE)


class TestPromptEchoPrevention(unittest.TestCase):
    """Verifies that bot prompts (especially CHIEF_COMPLAINT_PROMPT) are never read back as patient complaints."""

    def setUp(self):
        from chatbot.whatsapp.bot import WhatsAppBot, generate_response, normalize_message_text
        self.WhatsAppBot = WhatsAppBot
        self.generate_response = generate_response
        self.normalize_message_text = normalize_message_text
        self.bot = WhatsAppBot()
        self.bot.driver = MagicMock()
        self.client = ClinicalClient(base_url="http://localhost:5001")
        self.bot.clinical_client = self.client

    def test_normalize_message_text(self):
        raw = "🩺 *Let's begin your clinical assessment.*\n\n_Example: \"test\"_"
        norm = self.normalize_message_text(raw)
        self.assertEqual(norm, '🩺 let\'s begin your clinical assessment. example: "test"')

    def test_generate_response_ignores_prompt_and_echoes(self):
        # 1. Exact CHIEF_COMPLAINT_PROMPT
        self.assertIsNone(self.generate_response(CHIEF_COMPLAINT_PROMPT))

        # 2. Rendered DOM text without asterisks / underscores
        dom_rendered = (
            "🩺 Let's begin your clinical assessment.\n\n"
            "Please describe your main health concern or symptom.\n\n"
            'Example: "I have had chest pain since this morning."'
        )
        self.assertIsNone(self.generate_response(dom_rendered))

        # 3. Substring phrases
        self.assertIsNone(self.generate_response("🩺 Let's begin your clinical assessment."))
        self.assertIsNone(self.generate_response("Please describe your main health concern or symptom."))
        self.assertIsNone(self.generate_response("Your assessment has been recorded successfully."))

    def test_is_outgoing_message_identifies_chief_complaint_prompt(self):
        mock_el = MagicMock()
        mock_el.get_attribute.return_value = ""
        mock_el.find_elements.return_value = []

        # 1. Exact prompt
        self.assertTrue(self.bot._is_outgoing_message(mock_el, CHIEF_COMPLAINT_PROMPT))

        # 2. Rendered DOM text without markdown
        dom_rendered = (
            "🩺 Let's begin your clinical assessment.\n\n"
            "Please describe your main health concern or symptom.\n\n"
            'Example: "I have had chest pain since this morning."'
        )
        self.assertTrue(self.bot._is_outgoing_message(mock_el, dom_rendered))

        # 3. Individual lines
        self.assertTrue(self.bot._is_outgoing_message(mock_el, "🩺 Let's begin your clinical assessment."))
        self.assertTrue(self.bot._is_outgoing_message(mock_el, "Please describe your main health concern or symptom."))

    def test_is_outgoing_message_identifies_status_icons(self):
        mock_el = MagicMock()
        mock_el.get_attribute.return_value = ""
        # Mock presence of double checkmark icon
        mock_icon = MagicMock()
        mock_el.find_elements.side_effect = lambda by, xp: [mock_icon] if "msg-dblcheck" in xp else []

        self.assertTrue(self.bot._is_outgoing_message(mock_el, "Some text"))

    def test_is_outgoing_message_identifies_descendant_data_id(self):
        mock_el = MagicMock()
        mock_el.get_attribute.return_value = ""
        mock_desc = MagicMock()
        mock_desc.get_attribute.return_value = "true_919876543210@c.us_3EB012345"

        mock_el.find_elements.side_effect = lambda by, xp: [mock_desc] if "@data-id" in xp else []
        self.assertTrue(self.bot._is_outgoing_message(mock_el, "Unknown text"))

    @patch("requests.post")
    def test_clinical_client_ignores_prompt_echo_in_pending_complaint(self, mock_post):
        phone = "+919876543210"

        # Step 1: User sends "1"
        reply1 = self.client.handle_message(phone, "1")
        self.assertEqual(reply1, CHIEF_COMPLAINT_PROMPT)
        self.assertIn(phone, self.client.pending_complaint)
        self.assertIsNone(self.client.get_session_id(phone))

        # Step 2: Prompt echoed back into client -> Must be ignored, no session started
        dom_rendered = (
            "🩺 Let's begin your clinical assessment.\n\n"
            "Please describe your main health concern or symptom.\n\n"
            'Example: "I have had chest pain since this morning."'
        )
        reply2 = self.client.handle_message(phone, dom_rendered)
        self.assertEqual(reply2, "")
        mock_post.assert_not_called()
        self.assertIn(phone, self.client.pending_complaint)
        self.assertIsNone(self.client.get_session_id(phone))

        # Step 3: User provides real symptom -> Session starts properly
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "success": True,
            "session_id": "session-real-123",
            "next_question": "When did your fever start?",
        }
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        reply3 = self.client.handle_message(phone, "I have a high fever and chills")
        self.assertEqual(reply3, "When did your fever start?")
        self.assertEqual(self.client.get_session_id(phone), "session-real-123")
        self.assertNotIn(phone, self.client.pending_complaint)

    @patch("requests.post")
    def test_e2e_prompt_echo_skipped_without_second_message(self, mock_post):
        phone = "+919876543210"
        self.bot.auth_client = MagicMock()
        self.bot.auth_client.is_linked.return_value = True
        self.bot.send_message = MagicMock(return_value=True)

        self.bot._is_main_chat_open = MagicMock(return_value=True)
        self.bot._get_active_chat_title = MagicMock(return_value=phone)
        mock_header = MagicMock()
        mock_header.text = f"{phone}\nonline"
        mock_header.find_elements.return_value = []
        self.bot.driver.find_elements.side_effect = lambda by, xp: [mock_header] if "header" in xp else []

        # 1. Active menu state: User chooses "1"
        self.bot.set_menu_state(phone, WhatsAppState.MENU)
        mock_row1 = MagicMock()
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row1])
        self.bot._extract_text_from_element = MagicMock(return_value="1")
        self.bot._is_outgoing_message = MagicMock(return_value=False)
        self.bot._get_message_identifier = MagicMock(return_value="msg_id_opt_1")

        result1 = self.bot._check_active_chat_messages()
        self.assertTrue(result1)
        self.bot.send_message.assert_called_with(CHIEF_COMPLAINT_PROMPT)
        self.assertEqual(self.bot.get_menu_state(phone), WhatsAppState.CLINICAL_SESSION)
        self.assertIn(phone, self.client.pending_complaint)
        self.assertIsNone(self.client.get_session_id(phone))

        # 2. Next poll: The DOM renders the bot's prompt that was just sent!
        # DO NOT mock _is_outgoing_message; let the real method run!
        del self.bot._is_outgoing_message
        mock_row_prompt = MagicMock()
        mock_row_prompt.get_attribute.return_value = ""
        mock_row_prompt.find_elements.return_value = []
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row_prompt])
        dom_rendered_prompt = (
            "🩺 Let's begin your clinical assessment.\n\n"
            "Please describe your main health concern or symptom.\n\n"
            'Example: "I have had chest pain since this morning."'
        )
        self.bot._extract_text_from_element = MagicMock(return_value=dom_rendered_prompt)
        self.bot._get_message_identifier = MagicMock(return_value="msg_id_prompt_echo")

        result2 = self.bot._check_active_chat_messages()
        # Must return False because it's outgoing / skipped!
        self.assertFalse(result2)
        # Still in pending_complaint, no session started with the prompt!
        self.assertIn(phone, self.client.pending_complaint)
        self.assertIsNone(self.client.get_session_id(phone))
        # No additional message sent
        self.assertEqual(self.bot.send_message.call_count, 1)

        # 3. Patient sends their actual health concern
        mock_post_resp = MagicMock()
        mock_post_resp.json.return_value = {
            "success": True,
            "session_id": "session-real-456",
            "next_question": "When did the chest pain start?",
        }
        mock_post_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_post_resp

        mock_row_patient = MagicMock()
        mock_row_patient.get_attribute.return_value = "message-in"
        mock_row_patient.find_elements.return_value = []
        self.bot._get_newest_message_rows = MagicMock(return_value=[mock_row_patient])
        self.bot._extract_text_from_element = MagicMock(return_value="I have severe chest pain")
        self.bot._get_message_identifier = MagicMock(return_value="msg_id_patient_symptom")

        result3 = self.bot._check_active_chat_messages()
        self.assertTrue(result3)
        self.assertEqual(self.client.get_session_id(phone), "session-real-456")
        self.bot.send_message.assert_called_with("When did the chest pain start?")
        self.assertEqual(self.bot.send_message.call_count, 2)


if __name__ == "__main__":
    unittest.main()

