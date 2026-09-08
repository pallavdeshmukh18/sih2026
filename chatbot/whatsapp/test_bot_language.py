import unittest
from unittest.mock import MagicMock, patch

from chatbot.whatsapp.bot import (
    WhatsAppBot,
    generate_response,
    _module_menu_states,
    _module_user_languages,
    _module_pending_languages,
)
from chatbot.whatsapp.config import (
    LANGUAGE_SELECTION_MESSAGE,
    LOCALIZED_MENUS,
    LOCALIZED_LINKING_INSTRUCTIONS,
    LOCALIZED_INVALID_TOKEN,
    LOCALIZED_RESET_MESSAGE,
    LOCALIZED_CHIEF_COMPLAINT_PROMPT,
    WhatsAppState,
    format_link_success_message,
)


class TestWhatsAppBotLanguageAndDeduplication(unittest.TestCase):
    """
    Test suite for:
    1. Account-authoritative language selection flow for linked and unlinked users
    2. Message deduplication fix preventing dropped repeated inputs in the same minute
    3. Noise rejection on chief complaint
    """

    def setUp(self):
        _module_menu_states.clear()
        _module_user_languages.clear()
        _module_pending_languages.clear()

    # 1. Unlinked user receives language selection first
    def test_unlinked_user_hello_medikiosk_prompts_language(self):
        mock_auth = MagicMock()
        mock_auth.is_linked.return_value = False
        mock_client = MagicMock()

        phone = "+919876543210"
        resp = generate_response("hello medikiosk", patient_id=phone, client=mock_client, auth=mock_auth)

        self.assertEqual(resp, LANGUAGE_SELECTION_MESSAGE)
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.SELECTING_LANGUAGE)

    # 2. Invalid language choice re-prompts with language selection
    def test_invalid_language_choice_reprompts(self):
        mock_auth = MagicMock()
        mock_auth.is_linked.return_value = False
        mock_client = MagicMock()

        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.SELECTING_LANGUAGE

        resp = generate_response("9", patient_id=phone, client=mock_client, auth=mock_auth)
        self.assertEqual(resp, LANGUAGE_SELECTION_MESSAGE)
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.SELECTING_LANGUAGE)

    # 3. Unlinked user selects Hindi ("2") -> receives Hindi linking instructions
    def test_unlinked_user_selects_hindi_moves_to_waiting_for_token(self):
        mock_auth = MagicMock()
        mock_auth.is_linked.return_value = False
        mock_client = MagicMock()

        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.SELECTING_LANGUAGE

        resp = generate_response("2", patient_id=phone, client=mock_client, auth=mock_auth)
        self.assertEqual(resp, LOCALIZED_LINKING_INSTRUCTIONS["hi"])
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.WAITING_FOR_TOKEN)
        self.assertEqual(_module_pending_languages.get(phone), "hi")

    # 4. Token submission sends language to backend and formats localized success message
    def test_token_submission_persists_language_to_account(self):
        mock_auth = MagicMock()
        mock_auth.verify_and_link.return_value = {
            "success": True,
            "user_id": "usr-123",
            "user_name": "राम शर्मा",
        }
        mock_client = MagicMock()

        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.WAITING_FOR_TOKEN
        _module_pending_languages[phone] = "hi"

        resp = generate_response("TOKEN123", patient_id=phone, client=mock_client, auth=mock_auth)

        mock_auth.verify_and_link.assert_called_once_with(
            whatsapp_id=phone, token="TOKEN123", language="hi"
        )
        self.assertEqual(resp, format_link_success_message("राम शर्मा", language="hi"))
        self.assertNotIn(phone, _module_menu_states)
        self.assertNotIn(phone, _module_pending_languages)
        self.assertEqual(_module_user_languages.get(phone), "hi")

    # 5. Linked user with account language="mr" immediately receives Marathi menu
    def test_linked_user_with_marathi_receives_marathi_menu(self):
        mock_auth = MagicMock()
        mock_auth.is_linked.return_value = True
        mock_auth.get_account_language.return_value = "mr"
        mock_client = MagicMock()

        phone = "+919876543210"
        resp = generate_response("hello medikiosk", patient_id=phone, client=mock_client, auth=mock_auth)

        self.assertEqual(resp, LOCALIZED_MENUS["mr"])
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.MENU)
        self.assertEqual(_module_user_languages.get(phone), "mr")

    # 6. Linked user with missing language is prompted once and saved upon selection
    def test_linked_user_missing_language_prompts_and_updates_account(self):
        mock_auth = MagicMock()
        mock_auth.is_linked.return_value = True
        mock_auth.get_account_language.return_value = None
        mock_client = MagicMock()

        phone = "+919876543210"

        # Step 1: prompted for language
        resp1 = generate_response("hello medikiosk", patient_id=phone, client=mock_client, auth=mock_auth)
        self.assertEqual(resp1, LANGUAGE_SELECTION_MESSAGE)
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.SELECTING_LANGUAGE)

        # Step 2: selects "4" (Gujarati)
        resp2 = generate_response("4", patient_id=phone, client=mock_client, auth=mock_auth)
        mock_auth.update_account_language.assert_called_once_with(phone, "gu")
        self.assertEqual(resp2, LOCALIZED_MENUS["gu"])
        self.assertEqual(_module_menu_states.get(phone), WhatsAppState.MENU)
        self.assertEqual(_module_user_languages.get(phone), "gu")

    # 7. /reset clears session but preserves account language
    def test_reset_preserves_account_language(self):
        mock_auth = MagicMock()
        mock_auth.get_account_language.return_value = "mr"
        mock_client = MagicMock()

        phone = "+919876543210"
        _module_menu_states[phone] = WhatsAppState.MENU
        _module_user_languages[phone] = "mr"

        resp = generate_response("/reset", patient_id=phone, client=mock_client, auth=mock_auth)

        mock_client.reset_session.assert_called_once_with(phone)
        self.assertNotIn(phone, _module_menu_states)
        self.assertEqual(_module_user_languages.get(phone), "mr")
        self.assertEqual(resp, LOCALIZED_RESET_MESSAGE["mr"])

    # 8. Deduplication fix: repeated messages in the same minute have distinct element identifiers
    def test_message_identifier_deduplication_fix(self):
        bot = WhatsAppBot()

        mock_el_1 = MagicMock()
        mock_el_1.id = "element_uuid_aaa"
        mock_el_1.get_attribute.return_value = None
        mock_el_1.find_elements.return_value = []
        copyable_1 = MagicMock()
        copyable_1.get_attribute.return_value = "[16:52, 9/8/2026] Patient: "
        mock_el_1.find_element.return_value = copyable_1

        mock_el_2 = MagicMock()
        mock_el_2.id = "element_uuid_bbb"
        mock_el_2.get_attribute.return_value = None
        mock_el_2.find_elements.return_value = []
        copyable_2 = MagicMock()
        copyable_2.get_attribute.return_value = "[16:52, 9/8/2026] Patient: "
        mock_el_2.find_element.return_value = copyable_2

        id_1 = bot._get_message_identifier(mock_el_1, "na")
        id_2 = bot._get_message_identifier(mock_el_2, "na")

        self.assertIsNotNone(id_1)
        self.assertIsNotNone(id_2)
        # Because element UUIDs are appended, repeated messages within the same minute are NEVER identical!
        self.assertNotEqual(id_1, id_2)
        self.assertIn("element_uuid_aaa", id_1)
        self.assertIn("element_uuid_bbb", id_2)

    # 9. Noise rejection on chief complaint ("na", "iii", "1")
    def test_chief_complaint_noise_rejection(self):
        from chatbot.whatsapp.clinical_client import ClinicalClient
        client = ClinicalClient(base_url="http://localhost:5001")

        # Select option 1
        prompt = client.process_message("+919876543210", "1", language="hi")
        self.assertEqual(prompt, LOCALIZED_CHIEF_COMPLAINT_PROMPT["hi"])
        self.assertIn("+919876543210", client.pending_complaint)

        # User replies with "na"
        rep1 = client.process_message("+919876543210", "na", language="hi")
        self.assertEqual(rep1, LOCALIZED_CHIEF_COMPLAINT_PROMPT["hi"])
        self.assertIn("+919876543210", client.pending_complaint)

        # User replies with "iii"
        rep2 = client.process_message("+919876543210", "iii", language="hi")
        self.assertEqual(rep2, LOCALIZED_CHIEF_COMPLAINT_PROMPT["hi"])
        self.assertIn("+919876543210", client.pending_complaint)

        # User replies with "1"
        rep3 = client.process_message("+919876543210", "1", language="hi")
        self.assertEqual(rep3, LOCALIZED_CHIEF_COMPLAINT_PROMPT["hi"])
        self.assertIn("+919876543210", client.pending_complaint)


if __name__ == "__main__":
    unittest.main()
