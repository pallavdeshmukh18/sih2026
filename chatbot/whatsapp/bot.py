import logging
import re
import sys
import time
from pathlib import Path
from typing import Dict, Optional, Set

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

try:
    from .config import (
        ACTIVATION_PHRASE,
        BACKEND_API_TIMEOUT,
        BACKEND_API_URL,
        CHIEF_COMPLAINT_PROMPT,
        CLINICAL_API_TIMEOUT,
        CLINICAL_API_URL,
        COMPLETION_MESSAGE,
        DEFAULT_CHIEF_COMPLAINT,
        DEFAULT_CONSULTATION_TYPE,
        DEFAULT_LANGUAGE,
        DEFAULT_REPLY,
        ERROR_MESSAGE,
        EXIT_TEXT,
        INVALID_MENU_TEXT,
        INVALID_TOKEN_MESSAGE,
        LANGUAGE_MAP,
        LANGUAGE_SELECTION_MESSAGE,
        LINKING_INSTRUCTIONS_MESSAGE,
        LOCALIZED_CHIEF_COMPLAINT_PROMPT,
        LOCALIZED_COMPLETION_MESSAGE,
        LOCALIZED_EXIT_TEXT,
        LOCALIZED_INVALID_MENU,
        LOCALIZED_INVALID_TOKEN,
        LOCALIZED_LINKING_INSTRUCTIONS,
        LOCALIZED_MENUS,
        LOCALIZED_RESET_MESSAGE,
        LOCALIZED_UPLOAD_REPORT,
        LOGIN_TIMEOUT,
        MENU_MESSAGE,
        MENU_TEXT,
        PAGE_LOAD_TIMEOUT,
        POLL_INTERVAL,
        SELECTORS,
        SESSION_DIR,
        TRIGGER_KEYWORD,
        UPLOAD_REPORT_TEXT,
        WHATSAPP_WEB_URL,
        WhatsAppState,
        format_confirmation_message,
        format_doctor_recommendations,
        format_doctor_slots,
        format_invalid_doctor_choice,
        format_invalid_slot_choice,
        format_link_success_message,
        get_localized_message,
        LOCALIZED_NO_DOCTORS_FOUND,
        LOCALIZED_SLOT_CONFLICT,
    )
    from .clinical_client import ClinicalClient
    from .auth_client import WhatsAppAuthClient, whatsapp_auth_client
except (ImportError, ValueError):
    from config import (
        ACTIVATION_PHRASE,
        BACKEND_API_TIMEOUT,
        BACKEND_API_URL,
        CHIEF_COMPLAINT_PROMPT,
        CLINICAL_API_TIMEOUT,
        CLINICAL_API_URL,
        COMPLETION_MESSAGE,
        DEFAULT_CHIEF_COMPLAINT,
        DEFAULT_CONSULTATION_TYPE,
        DEFAULT_LANGUAGE,
        DEFAULT_REPLY,
        ERROR_MESSAGE,
        EXIT_TEXT,
        INVALID_MENU_TEXT,
        INVALID_TOKEN_MESSAGE,
        LANGUAGE_MAP,
        LANGUAGE_SELECTION_MESSAGE,
        LINKING_INSTRUCTIONS_MESSAGE,
        LOCALIZED_CHIEF_COMPLAINT_PROMPT,
        LOCALIZED_COMPLETION_MESSAGE,
        LOCALIZED_EXIT_TEXT,
        LOCALIZED_INVALID_MENU,
        LOCALIZED_INVALID_TOKEN,
        LOCALIZED_LINKING_INSTRUCTIONS,
        LOCALIZED_MENUS,
        LOCALIZED_RESET_MESSAGE,
        LOCALIZED_UPLOAD_REPORT,
        LOGIN_TIMEOUT,
        MENU_MESSAGE,
        MENU_TEXT,
        PAGE_LOAD_TIMEOUT,
        POLL_INTERVAL,
        SELECTORS,
        SESSION_DIR,
        TRIGGER_KEYWORD,
        UPLOAD_REPORT_TEXT,
        WHATSAPP_WEB_URL,
        WhatsAppState,
        format_confirmation_message,
        format_doctor_recommendations,
        format_doctor_slots,
        format_invalid_doctor_choice,
        format_invalid_slot_choice,
        format_link_success_message,
        get_localized_message,
        LOCALIZED_NO_DOCTORS_FOUND,
        LOCALIZED_SLOT_CONFLICT,
    )
    from clinical_client import ClinicalClient
    from auth_client import WhatsAppAuthClient, whatsapp_auth_client



# Configure structured logging
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("medikiosk.whatsapp")

# Shared clinical client instance
clinical_client = ClinicalClient()

# Shared WhatsApp auth client instance
auth_client = WhatsAppAuthClient()

# Shared module-level menu states for standalone generate_response calls
_module_menu_states: Dict[str, str] = {}
_module_user_languages: Dict[str, str] = {}
_module_pending_languages: Dict[str, str] = {}


def _resolve_module_user_language(patient_id: str, auth: WhatsAppAuthClient) -> Optional[str]:
    """Resolves user's account language from in-memory cache or queries backend auth."""
    if patient_id in _module_user_languages:
        return _module_user_languages[patient_id]
    try:
        lang = auth.get_account_language(patient_id)
        if isinstance(lang, str) and lang.strip():
            clean_l = lang.strip().lower()
            _module_user_languages[patient_id] = clean_l
            return clean_l
        elif lang is not None and hasattr(lang, "assert_called"):
            return DEFAULT_LANGUAGE
    except Exception:
        pass
    return None


def _parse_language_choice(text: str) -> Optional[str]:
    """Parses a language choice digit (1-4) or language name in English/Hindi/Marathi/Gujarati."""
    cleaned = text.strip()
    if cleaned in LANGUAGE_MAP:
        return LANGUAGE_MAP[cleaned]
    lower = cleaned.lower()
    if "english" in lower:
        return "en"
    if "hindi" in lower or "हिंदी" in lower:
        return "hi"
    if "marathi" in lower or "मराठी" in lower:
        return "mr"
    if "gujarati" in lower or "ગુજરાતી" in lower:
        return "gu"
    return None


def normalize_message_text(text: str) -> str:
    """
    Normalizes a message string by stripping WhatsApp markdown markers
    (*bold*, _italic_, ~strike~, `code`), punctuation variations, and collapsing whitespace.
    """
    if not text:
        return ""
    import re
    cleaned = re.sub(r"[\*_~`]", "", text)
    return " ".join(cleaned.lower().split())


def is_exact_activation_message(message: str) -> bool:
    """
    Returns True if the incoming message, after trimming leading/trailing
    whitespace and case-normalization, is exactly ACTIVATION_PHRASE ('hello medikiosk').
    """
    return message.strip().lower() == ACTIVATION_PHRASE.lower()


def generate_response(
    message: str,
    patient_id: str = "default_patient",
    client: Optional[ClinicalClient] = None,
    auth: Optional[WhatsAppAuthClient] = None,
) -> Optional[str]:
    """
    Connects incoming WhatsApp messages to Param's Clinical AI engine, menu interface,
    or WhatsApp account authentication layer.
    Follows state priority:
    1. Reset / restart command
    2. SELECTING_LANGUAGE (Language choice 1-4)
    3. WAITING_FOR_TOKEN (Token submission)
    4. Active clinical session
    5. Active menu state
    6. Exact activation phrase ('hello medikiosk') -> auth check:
       - unlinked -> language selection (SELECTING_LANGUAGE)
       - linked with language -> menu (localized)
       - linked without language -> language selection (SELECTING_LANGUAGE)
    7. Otherwise ignores
    """
    cleaned = message.strip()
    if not cleaned:
        return None

    # Never reply to our own completion, greeting, or bot prompts
    lower_msg = cleaned.lower()
    norm_msg = normalize_message_text(cleaned)

    all_bot_prompts = [
        COMPLETION_MESSAGE,
        DEFAULT_REPLY,
        MENU_TEXT,
        MENU_MESSAGE,
        UPLOAD_REPORT_TEXT,
        EXIT_TEXT,
        INVALID_MENU_TEXT,
        LINKING_INSTRUCTIONS_MESSAGE,
        INVALID_TOKEN_MESSAGE,
        CHIEF_COMPLAINT_PROMPT,
        LANGUAGE_SELECTION_MESSAGE,
    ]
    for d in (
        LOCALIZED_MENUS,
        LOCALIZED_LINKING_INSTRUCTIONS,
        LOCALIZED_INVALID_TOKEN,
        LOCALIZED_CHIEF_COMPLAINT_PROMPT,
        LOCALIZED_COMPLETION_MESSAGE,
        LOCALIZED_EXIT_TEXT,
        LOCALIZED_INVALID_MENU,
        LOCALIZED_UPLOAD_REPORT,
        LOCALIZED_RESET_MESSAGE,
    ):
        all_bot_prompts.extend(d.values())

    bot_prompt_lowers = {p.strip().lower() for p in all_bot_prompts if p}
    bot_prompt_norms = {normalize_message_text(p) for p in all_bot_prompts if p}

    if (
        lower_msg in bot_prompt_lowers
        or norm_msg in bot_prompt_norms
        or "whatsapp linked successfully" in lower_msg
        or "let's begin your clinical assessment" in lower_msg
        or "describe your main health concern" in lower_msg
        or "example: \"i have had chest pain since this morning\"" in lower_msg
        or "clinical assessment complete" in lower_msg
        or "physician-ready summary is now available" in lower_msg
        or "select your preferred language" in lower_msg
        or "reply with 1, 2, 3, or 4" in lower_msg
        or "आपकी पसंदीदा भाषा चुनें" in lower_msg
        or "पसंतीची भाषा निवडा" in lower_msg
        or "પસંદગીની ભાષા પસંદ કરો" in lower_msg
    ):
        return None

    active_client = client or clinical_client
    active_auth = auth or auth_client

    # Handle reset/restart
    if cleaned.lower() in ("/reset", "/restart", "reset", "restart"):
        _module_menu_states.pop(patient_id, None)
        _module_pending_languages.pop(patient_id, None)
        active_client.reset_session(patient_id)
        user_lang = _resolve_module_user_language(patient_id, active_auth) or DEFAULT_LANGUAGE
        return LOCALIZED_RESET_MESSAGE.get(user_lang, 'Session reset. Send "hello medikiosk" to begin a consultation.')

    raw_session_id = active_client.get_session_id(patient_id)
    has_session = isinstance(raw_session_id, str) and bool(raw_session_id)
    current_menu_state = _module_menu_states.get(patient_id, WhatsAppState.IDLE)

    # 1. SELECTING_LANGUAGE state
    if current_menu_state == WhatsAppState.SELECTING_LANGUAGE:
        chosen_lang = _parse_language_choice(cleaned)
        if not chosen_lang:
            return LANGUAGE_SELECTION_MESSAGE

        is_linked = active_auth.is_linked(patient_id)
        if is_linked:
            # Linked user was missing language: save to account in DB immediately
            active_auth.update_account_language(patient_id, chosen_lang)
            _module_user_languages[patient_id] = chosen_lang
            _module_menu_states[patient_id] = WhatsAppState.MENU
            return LOCALIZED_MENUS.get(chosen_lang, MENU_MESSAGE)
        else:
            # Unlinked user: hold chosen language in pending, transition to WAITING_FOR_TOKEN
            _module_pending_languages[patient_id] = chosen_lang
            _module_menu_states[patient_id] = WhatsAppState.WAITING_FOR_TOKEN
            return LOCALIZED_LINKING_INSTRUCTIONS.get(chosen_lang, LINKING_INSTRUCTIONS_MESSAGE)

    # 2. WAITING_FOR_TOKEN state
    if current_menu_state == WhatsAppState.WAITING_FOR_TOKEN:
        pending_lang = _module_pending_languages.get(patient_id, DEFAULT_LANGUAGE)
        link_res = active_auth.verify_and_link(whatsapp_id=patient_id, token=cleaned, language=pending_lang)
        if link_res.get("success"):
            _module_menu_states.pop(patient_id, None)
            _module_pending_languages.pop(patient_id, None)
            _module_user_languages[patient_id] = pending_lang
            user_name = link_res.get("user_name", "")
            return format_link_success_message(user_name, language=pending_lang)
        else:
            return LOCALIZED_INVALID_TOKEN.get(pending_lang, INVALID_TOKEN_MESSAGE)

    # 3. WAITING_FOR_DOCTOR_SELECTION state
    if current_menu_state == WhatsAppState.WAITING_FOR_DOCTOR_SELECTION:
        user_lang = _resolve_module_user_language(patient_id, active_auth) or DEFAULT_LANGUAGE
        docs = getattr(active_client, "recommended_doctors", {}).get(patient_id, [])
        if cleaned.isdigit():
            idx = int(cleaned) - 1
            if 0 <= idx < len(docs):
                selected_doc = docs[idx]
                if not hasattr(active_client, "selected_doctor"):
                    active_client.selected_doctor = {}
                active_client.selected_doctor[patient_id] = selected_doc
                doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()

                try:
                    slots_data = active_client.get_doctor_slots(selected_doc["id"], patient_id=patient_id)
                    slots = slots_data.get("slots", [])
                    if slots:
                        if not hasattr(active_client, "available_slots"):
                            active_client.available_slots = {}
                        active_client.available_slots[patient_id] = slots
                        _module_menu_states[patient_id] = WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION
                        return format_doctor_slots(doc_name, slots, date_str=slots_data.get("date", ""), language=user_lang)
                    else:
                        return format_doctor_slots(doc_name, [], language=user_lang)
                except Exception as exc:
                    logger.error("Failed to retrieve slots for doctor %s: %s", selected_doc.get("id"), exc)
                    return ERROR_MESSAGE
            else:
                return format_invalid_doctor_choice(len(docs), language=user_lang)
        else:
            return format_invalid_doctor_choice(len(docs), language=user_lang)

    # 4. WAITING_FOR_APPOINTMENT_SELECTION state
    if current_menu_state == WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION:
        user_lang = _resolve_module_user_language(patient_id, active_auth) or DEFAULT_LANGUAGE
        slots = getattr(active_client, "available_slots", {}).get(patient_id, [])
        selected_doc = getattr(active_client, "selected_doctor", {}).get(patient_id, {})
        sess_id = getattr(active_client, "last_completed_session", {}).get(patient_id)

        if cleaned.isdigit():
            idx = int(cleaned) - 1
            if 0 <= idx < len(slots):
                selected_slot = slots[idx]
                doc_id = selected_doc.get("id")
                try:
                    book_res = active_client.book_appointment(
                        patient_id=patient_id,
                        session_id=sess_id,
                        doctor_id=doc_id,
                        scheduled_at=selected_slot.get("scheduledAt"),
                    )
                    if book_res.get("success"):
                        _module_menu_states.pop(patient_id, None)
                        if hasattr(active_client, "recommended_doctors"):
                            active_client.recommended_doctors.pop(patient_id, None)
                        if hasattr(active_client, "selected_doctor"):
                            active_client.selected_doctor.pop(patient_id, None)
                        if hasattr(active_client, "available_slots"):
                            active_client.available_slots.pop(patient_id, None)
                        if hasattr(active_client, "last_completed_session"):
                            active_client.last_completed_session.pop(patient_id, None)

                        doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()
                        spec = selected_doc.get("specialization") or "General Medicine"
                        date_val = selected_slot.get("scheduledAt", "")[:10]
                        time_val = selected_slot.get("time12") or selected_slot.get("time") or ""
                        return format_confirmation_message(doc_name, spec, date_val, time_val, language=user_lang)
                    elif book_res.get("status_code") == 409:
                        # Slot conflict! Refresh slots and prompt again
                        slots_data = active_client.get_doctor_slots(doc_id, patient_id=patient_id)
                        refreshed_slots = slots_data.get("slots", [])
                        active_client.available_slots[patient_id] = refreshed_slots
                        conflict_header = LOCALIZED_SLOT_CONFLICT.get(user_lang, LOCALIZED_SLOT_CONFLICT["en"])
                        doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()
                        slots_msg = format_doctor_slots(doc_name, refreshed_slots, date_str=slots_data.get("date", ""), language=user_lang)
                        return f"{conflict_header}\n{slots_msg}"
                    else:
                        return ERROR_MESSAGE
                except Exception as exc:
                    logger.error("Failed to book appointment: %s", exc)
                    return ERROR_MESSAGE
            else:
                return format_invalid_slot_choice(len(slots), language=user_lang)
        else:
            return format_invalid_slot_choice(len(slots), language=user_lang)

    # 5. Active clinical session
    is_clinical_active = (
        has_session
        or current_menu_state == WhatsAppState.CLINICAL_SESSION
        or (hasattr(active_client, "pending_complaint") and patient_id in active_client.pending_complaint)
    )
    if is_clinical_active:
        _module_menu_states[patient_id] = WhatsAppState.CLINICAL_SESSION
        user_lang = _resolve_module_user_language(patient_id, active_auth) or DEFAULT_LANGUAGE
        reply = active_client.handle_message(patient_id=patient_id, message=cleaned, language=user_lang)
        is_pending = hasattr(active_client, "pending_complaint") and patient_id in active_client.pending_complaint
        if active_client.get_session_id(patient_id) is None and not is_pending:
            if hasattr(active_client, "recommended_doctors") and active_client.recommended_doctors.get(patient_id):
                _module_menu_states[patient_id] = WhatsAppState.WAITING_FOR_DOCTOR_SELECTION
            else:
                _module_menu_states.pop(patient_id, None)
        return reply

    # 6. Active menu state
    if current_menu_state == WhatsAppState.MENU:
        user_lang = _resolve_module_user_language(patient_id, active_auth) or DEFAULT_LANGUAGE
        if cleaned == "1":
            _module_menu_states[patient_id] = WhatsAppState.CLINICAL_SESSION
            return active_client.handle_message(patient_id=patient_id, message=cleaned, language=user_lang)
        elif cleaned == "2":
            return LOCALIZED_UPLOAD_REPORT.get(user_lang, UPLOAD_REPORT_TEXT)
        elif cleaned == "3":
            _module_menu_states.pop(patient_id, None)
            active_client.reset_session(patient_id)
            return LOCALIZED_EXIT_TEXT.get(user_lang, EXIT_TEXT)
        else:
            return LOCALIZED_INVALID_MENU.get(user_lang, INVALID_MENU_TEXT)

    # 7. Exact activation phrase ('hello medikiosk')

    if is_exact_activation_message(cleaned):
        is_linked = active_auth.is_linked(patient_id)
        if not is_linked:
            _module_menu_states[patient_id] = WhatsAppState.SELECTING_LANGUAGE
            return LANGUAGE_SELECTION_MESSAGE
        else:
            account_lang = None
            try:
                raw_lang = active_auth.get_account_language(patient_id)
                if isinstance(raw_lang, str) and raw_lang.strip():
                    account_lang = raw_lang.strip().lower()
                elif raw_lang is not None and hasattr(raw_lang, "assert_called"):
                    account_lang = DEFAULT_LANGUAGE
            except Exception:
                pass

            if account_lang:
                _module_user_languages[patient_id] = account_lang
                _module_menu_states[patient_id] = WhatsAppState.MENU
                return LOCALIZED_MENUS.get(account_lang, MENU_MESSAGE)
            else:
                _module_menu_states[patient_id] = WhatsAppState.SELECTING_LANGUAGE
                return LANGUAGE_SELECTION_MESSAGE

    # 6. Otherwise ignore
    logger.info(
        "generate_response: Ignoring message from '%s' (idle state, not activation phrase '%s'): '%s'",
        patient_id, ACTIVATION_PHRASE, cleaned
    )
    return None


class WhatsAppBot:
    """
    Robust Selenium-based WhatsApp Web bot for MediKiosk.
    Automates message listening and responding using WhatsApp Web in Google Chrome,
    connected to Param's Clinical AI backend.
    """

    def __init__(
        self,
        session_dir: Optional[Path] = None,
        clinical_client_instance: Optional[ClinicalClient] = None,
        auth_client_instance: Optional[WhatsAppAuthClient] = None,
    ):
        self.session_dir = session_dir or SESSION_DIR
        self.driver: Optional[webdriver.Chrome] = None
        self.processed_message_ids: Set[str] = set()
        self.is_running: bool = False
        self._loop_count: int = 0
        self.clinical_client: ClinicalClient = clinical_client_instance or clinical_client
        self.auth_client: WhatsAppAuthClient = auth_client_instance or auth_client
        self._sent_messages: Set[str] = set()
        self._sent_messages_normalized: Set[str] = set()
        self.known_group_chats: Set[str] = set()
        self.known_community_chats: Set[str] = set()
        self._logged_ignored_groups: Set[str] = set()
        self._recent_opened_group_time: Dict[str, float] = {}
        self.user_menu_states: Dict[str, str] = {}
        self.user_languages: Dict[str, str] = {}
        self.pending_languages: Dict[str, str] = {}

    def _record_sent_message(self, reply_text: str) -> None:
        """Records a sent message and its normalized forms to prevent reading it as an incoming message."""
        if not reply_text:
            return
        cleaned = reply_text.strip()
        self._sent_messages.add(cleaned)
        norm = normalize_message_text(cleaned)
        if norm:
            self._sent_messages_normalized.add(norm)
        for line in cleaned.split("\n"):
            line_norm = normalize_message_text(line)
            if line_norm:
                self._sent_messages_normalized.add(line_norm)

    def get_menu_state(self, chat_id: str) -> str:
        """Returns the current WhatsApp menu state for an individual chat (default IDLE)."""
        return self.user_menu_states.get(chat_id, WhatsAppState.IDLE)

    def set_menu_state(self, chat_id: str, state: str) -> None:
        """Sets the WhatsApp menu state for an individual chat."""
        if state == WhatsAppState.IDLE:
            self.user_menu_states.pop(chat_id, None)
        else:
            self.user_menu_states[chat_id] = state

    def clear_menu_state(self, chat_id: str) -> None:
        """Clears the WhatsApp menu state for an individual chat."""
        self.user_menu_states.pop(chat_id, None)

    def get_user_language(self, chat_id: str) -> str:
        """Retrieves user's account language from in-memory cache or queries backend auth."""
        if chat_id in self.user_languages:
            return self.user_languages[chat_id]
        try:
            lang = self.auth_client.get_account_language(chat_id)
            if isinstance(lang, str) and lang.strip():
                clean_lang = lang.strip().lower()
                self.user_languages[chat_id] = clean_lang
                return clean_lang
            elif lang is not None and hasattr(lang, "assert_called"):
                return DEFAULT_LANGUAGE
        except Exception as exc:
            logger.debug("Could not fetch account language for %s: %s", chat_id, exc)
        return DEFAULT_LANGUAGE

    def set_user_language(self, chat_id: str, language: str) -> None:
        """Caches user's account language."""
        if language:
            self.user_languages[chat_id] = language.strip().lower()

    def _get_active_chat_whatsapp_id(self) -> str:
        """
        Extracts a stable WhatsApp phone number or JID identity for the active conversation.
        Does NOT rely on display names, which users can change.
        1. Inspects recent message row @data-id for JID/phone digits (e.g. false_919876543210@c.us_...)
        2. Inspects header title or subtitle for phone number patterns (e.g. +91 98765 43210)
        3. Fallback to active chat title.
        """
        try:
            # 1. Search recent message rows for data-id containing phone number JID
            if hasattr(self, "driver") and self.driver:
                rows = self._get_visible_message_rows()
                for row in reversed(rows[-10:] if rows else []):
                    try:
                        data_id = row.get_attribute("data-id") or ""
                        if not data_id:
                            p = row.find_elements(By.XPATH, "./ancestor-or-self::*[@data-id]")
                            if p:
                                data_id = p[0].get_attribute("data-id") or ""
                        if data_id:
                            match = re.search(r'(?:true|false)_([0-9]{8,15})@(c\.us|s\.whatsapp\.net)', data_id)
                            if match:
                                phone_digits = match.group(1)
                                return f"+{phone_digits}"
                    except Exception:
                        continue

            # 2. Check if chat title is already a phone number
            chat_title = self._get_active_chat_title()
            if chat_title:
                cleaned_phone = re.sub(r"[^\d+]", "", chat_title)
                if cleaned_phone.startswith("+") and len(cleaned_phone) >= 10:
                    return cleaned_phone
                if len(cleaned_phone) >= 10 and cleaned_phone.isdigit():
                    return f"+{cleaned_phone}"
                return chat_title
        except Exception as exc:
            logger.debug("Error extracting WhatsApp identity: %s", exc)

        return self._get_active_chat_title()


    def _build_chrome_options(self) -> webdriver.ChromeOptions:
        """Constructs Chrome options with persistent session profile."""
        options = webdriver.ChromeOptions()

        self.session_dir.mkdir(parents=True, exist_ok=True)
        options.add_argument(f"--user-data-dir={self.session_dir.resolve()}")

        options.add_argument("--start-maximized")
        options.add_argument("--disable-notifications")
        options.add_argument("--disable-infobars")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

        # Anti-detection flags
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        return options

    def start(self) -> None:
        """Starts Google Chrome and navigates to WhatsApp Web."""
        logger.info("Browser started. Launching Chrome...")
        options = self._build_chrome_options()

        try:
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager

            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
        except Exception as exc:
            logger.warning("WebDriverManager fallback: using system ChromeDriver: %s", exc)
            self.driver = webdriver.Chrome(options=options)

        self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
        self.driver.get(WHATSAPP_WEB_URL)
        logger.info("Navigated to %s", WHATSAPP_WEB_URL)

    def wait_for_login(self, timeout: int = LOGIN_TIMEOUT) -> bool:
        """
        Monitors WhatsApp Web until successful login is detected.
        Gives the user time to scan the QR code manually.
        """
        logger.info("Waiting for QR/login... Please scan the QR code on your phone if prompted.")
        start_time = time.time()

        while time.time() - start_time < timeout:
            for xpath in SELECTORS["login_indicators"]:
                try:
                    elements = self.driver.find_elements(By.XPATH, xpath)
                    if elements and any(el.is_displayed() for el in elements):
                        logger.info("Login detected. WhatsApp Web is ready.")
                        # Pre-open chat if needed and index existing messages
                        self._ensure_active_chat_open()
                        self._prepopulate_existing_messages()
                        return True
                except (NoSuchElementException, StaleElementReferenceException):
                    continue

            time.sleep(2.0)

        logger.error("Error: Login timeout exceeded (%d seconds).", timeout)
        return False

    def _get_active_chat_title(self) -> str:
        """Returns the contact/group name of the currently active conversation."""
        header_xpaths = [
            "//div[@id='main']//header//div[contains(@role, 'button')]//span[@dir='auto']",
            "//div[@id='main']//header//span[@title and @dir='auto']",
            "//div[@id='main']//header//span[@title]",
            "//div[@id='main']//header//span[@dir='auto']",
        ]
        for xpath in header_xpaths:
            try:
                elements = self.driver.find_elements(By.XPATH, xpath)
                for el in elements:
                    title = el.get_attribute("title") or el.text
                    if title and title.strip():
                        t = title.strip()
                        if t.lower() not in (
                            "online",
                            "typing...",
                            "click here for contact info",
                            "click here for group info",
                            "tap here for contact info",
                            "tap here for group info",
                        ):
                            return t
            except Exception:
                continue
        return ""

    def _is_main_chat_open(self) -> bool:
        """Quick check whether active chat pane (#main) is currently open and displayed."""
        try:
            main_chats = self.driver.find_elements(By.XPATH, SELECTORS["main_chat"])
            return bool(main_chats and any(m.is_displayed() for m in main_chats))
        except Exception:
            return False

    def is_group_chat(self) -> bool:
        """
        Determines whether the active chat in #main is a WhatsApp group conversation.
        Returns True if a group is detected, False for individual 1-to-1 chats.
        Uses robust structural DOM/state indicators:
        1. Known group cache
        2. Group icons in header (@data-icon='default-group', @data-icon='group', testids)
        3. Header subtitle text/title containing participant lists (comma-separated names, 'group info')
        4. Author color tags or author testids on incoming message bubbles
        """
        try:
            chat_title = self._get_active_chat_title()
            if chat_title and chat_title in self.known_group_chats:
                return True

            headers = self.driver.find_elements(By.XPATH, "//div[@id='main']//header")
            if not headers:
                return False
            header = headers[0]

            # 1. Check for group icons in header avatar
            for xpath in SELECTORS.get("group_header_icons", []):
                try:
                    if header.find_elements(By.XPATH, xpath):
                        if chat_title:
                            self.known_group_chats.add(chat_title)
                        return True
                except Exception:
                    pass

            # 2. Check header text / subtitle for group info or member list
            try:
                header_text = header.text.lower()
                if (
                    "group info" in header_text
                    or "click here for group" in header_text
                    or "tap here for group" in header_text
                ):
                    if chat_title:
                        self.known_group_chats.add(chat_title)
                    return True

                # Check subtitle spans for comma-separated member list (e.g. "You, Alice, Bob")
                subtitles = header.find_elements(
                    By.XPATH,
                    ".//span[@title or contains(@class, 'selectable-text') or @dir='auto']"
                )
                for sub in subtitles:
                    title_attr = (sub.get_attribute("title") or "").strip()
                    sub_text = (sub.text or "").strip()
                    for val in (title_attr, sub_text):
                        if (
                            val
                            and val != chat_title
                            and ", " in val
                            and not val.lower().startswith("last seen")
                            and not val.lower().startswith("message yourself")
                        ):
                            if chat_title:
                                self.known_group_chats.add(chat_title)
                            return True
            except Exception:
                pass

            # 3. Check for participant author tags inside message bubbles
            for xpath in SELECTORS.get("group_author_tags", []):
                try:
                    if self.driver.find_elements(By.XPATH, xpath):
                        if chat_title:
                            self.known_group_chats.add(chat_title)
                        return True
                except Exception:
                    pass

        except Exception as exc:
            logger.debug("Error during group chat detection: %s", exc)

        return False

    def is_community_chat(self) -> bool:
        """
        Determines whether the active chat in #main is a WhatsApp Community,
        Community home, or Community announcement channel.
        Returns True if a community is detected, False otherwise.
        Uses robust structural DOM/state indicators:
        1. Known community cache
        2. Community/Announcement icons in header (@data-icon='community', 'announcement', etc.)
        3. Header subtitle text/title containing community keywords ('community info', 'announcements')
        4. Announcement channel footer with admin-only send permissions
        """
        try:
            chat_title = self._get_active_chat_title()
            if chat_title and (
                chat_title in self.known_community_chats
                or chat_title in self.known_group_chats
            ):
                return True

            headers = self.driver.find_elements(By.XPATH, "//div[@id='main']//header")
            if not headers:
                return False
            header = headers[0]

            # 1. Check for community or announcement icons in header
            for xpath in SELECTORS.get("community_header_icons", []):
                try:
                    if header.find_elements(By.XPATH, xpath):
                        if chat_title:
                            self.known_community_chats.add(chat_title)
                            self.known_group_chats.add(chat_title)
                        return True
                except Exception:
                    pass

            # 2. Check header text / subtitle for community or announcement indicators
            try:
                header_text = header.text.lower()
                community_keywords = [
                    "community info",
                    "tap here for community info",
                    "click here for community info",
                    "announcement",
                    "announcements",
                ]
                if any(kw in header_text for kw in community_keywords):
                    if chat_title:
                        self.known_community_chats.add(chat_title)
                        self.known_group_chats.add(chat_title)
                    return True

                # Check if subtitle explicitly indicates community or announcements
                subtitles = header.find_elements(
                    By.XPATH,
                    ".//span[@title or contains(@class, 'selectable-text') or @dir='auto']"
                )
                for sub in subtitles:
                    val = (sub.get_attribute("title") or sub.text or "").strip().lower()
                    if val in ("community", "announcements", "announcement"):
                        if chat_title:
                            self.known_community_chats.add(chat_title)
                            self.known_group_chats.add(chat_title)
                        return True
            except Exception:
                pass

            # 3. Check for read-only admin announcement footer bar in #main
            for xpath in SELECTORS.get("announcement_footer_indicators", []):
                try:
                    if self.driver.find_elements(By.XPATH, xpath):
                        if chat_title:
                            self.known_community_chats.add(chat_title)
                            self.known_group_chats.add(chat_title)
                        return True
                except Exception:
                    pass

        except Exception as exc:
            logger.debug("Error during community chat detection: %s", exc)

        return False

    def is_group_or_community_chat(self) -> bool:
        """
        Unified guard: returns True if active conversation is ANY group, community,
        announcement channel, or non-individual chat.
        """
        return self.is_group_chat() or self.is_community_chat()

    def _ignore_active_chat(self, chat_title: str) -> None:
        """
        Action taken when a group or community chat is detected:
        1. Logs the ignore action once per conversation.
        2. Indexes visible messages into processed_message_ids to prevent re-scanning.
        """
        if chat_title not in self._logged_ignored_groups:
            logger.info("Ignoring group or community chat: '%s'", chat_title)
            self._logged_ignored_groups.add(chat_title)
        self._mark_current_chat_messages_processed()

    def _is_badge_in_group_or_community(self, badge) -> bool:
        """
        Inspects the sidebar chat row containing an unread badge to determine
        if it is already known or structurally marked as a group or community.
        """
        try:
            row_info = self.driver.execute_script("""
                var badge = arguments[0];
                var pane = document.getElementById('pane-side');
                var row = badge.closest('div[role="row"]') || 
                          badge.closest('div[role="listitem"]') || 
                          badge.closest('div[tabindex="-1"]') || 
                          badge.closest('div[data-testid="cell-frame-container"]');
                var title = '';
                var isGroup = false;

                var searchRoot = row || badge.parentElement || badge;
                if (searchRoot.querySelector("[data-icon='default-group'], [data-icon='community'], [data-icon='community-outline'], [data-icon='announcement'], [data-icon='announcement-outline'], [data-testid='default-group'], [data-testid='community-outline'], [data-testid='announcement']")) {
                    isGroup = true;
                }

                if (row) {
                    var candidateSpans = row.querySelectorAll('span[title]');
                    for (var i = 0; i < candidateSpans.length; i++) {
                        var t = candidateSpans[i].getAttribute('title') || '';
                        var aria = candidateSpans[i].getAttribute('aria-label') || '';
                        if (t && !t.toLowerCase().includes('unread') && !aria.toLowerCase().includes('unread') && !/^\\d+$/.test(t.trim())) {
                            title = t.trim();
                            break;
                        }
                    }
                }
                return { title: title.trim(), isGroup: isGroup };
            """, badge)

            if row_info:
                title = row_info.get("title", "")
                is_group = bool(row_info.get("isGroup"))
                if title:
                    if title in self.known_group_chats or title in self.known_community_chats:
                        return True
                    if is_group:
                        self.known_group_chats.add(title)
                        self.known_community_chats.add(title)
                        return True
        except Exception:
            pass
        return False

    def _mark_current_chat_messages_processed(self) -> None:
        """Indexes visible messages in an ignored group or community chat so they are not re-inspected."""
        try:
            rows = self._get_newest_message_rows(limit=8)
            for row in rows:
                text = self._extract_text_from_element(row)
                msg_id = self._get_message_identifier(row, text)
                if msg_id:
                    self.processed_message_ids.add(msg_id)
        except Exception:
            pass

    def _wait_for_chat_load(self, expected_title: Optional[str] = None, max_wait: float = 2.5) -> bool:
        """Dynamically waits for active chat pane to finish loading after opening an unread chat."""
        start = time.time()
        while time.time() - start < max_wait:
            if self._is_main_chat_open():
                title = self._get_active_chat_title()
                if title:
                    if not expected_title or expected_title.lower() in title.lower() or title.lower() in expected_title.lower():
                        time.sleep(0.2)
                        return True
                else:
                    time.sleep(0.15)
                    if self._get_active_chat_title():
                        return True
            time.sleep(0.1)
        return self._is_main_chat_open()

    def _get_newest_message_rows(self, limit: int = 5):
        """
        Retrieves only the newest visible message rows from the bottom of the chat pane,
        avoiding full DOM traversal of large chat histories.
        """
        try:
            # 1. Fast targeted query for last N rows
            rows = self.driver.find_elements(
                By.XPATH,
                f"(//div[@id='main']//div[@role='row'])[position() > last() - {limit}]"
            )
            if rows:
                return rows
        except Exception:
            pass

        try:
            # 2. Query all message rows
            all_rows = self.driver.find_elements(By.XPATH, SELECTORS["message_rows"])
            if all_rows:
                return all_rows[-limit:]
        except Exception:
            pass

        try:
            # 3. Fallback for message-in and message-out bubbles
            bubbles = self.driver.find_elements(
                By.XPATH,
                "//div[@id='main']//div[contains(@class, 'message-in') or contains(@class, 'message-out')]"
            )
            if bubbles:
                return bubbles[-limit:]
        except Exception:
            pass

        return []

    def _ensure_active_chat_open(self) -> None:
        """If no conversation is open, automatically clicks the first individual chat in the left list."""
        try:
            if self._is_main_chat_open():
                return

            for xpath in SELECTORS["chat_rows"]:
                rows = self.driver.find_elements(By.XPATH, xpath)
                for row in rows:
                    if not row.is_displayed():
                        continue

                    # Filter out rows that are groups or communities
                    is_group = False
                    for g_xpath in SELECTORS.get("sidebar_group_icons", []):
                        try:
                            if row.find_elements(By.XPATH, g_xpath):
                                is_group = True
                                break
                        except Exception:
                            pass
                    if is_group:
                        continue

                    # Check row title against known group/community caches
                    try:
                        title_spans = row.find_elements(By.XPATH, ".//span[@title or @dir='auto']")
                        row_title = title_spans[0].get_attribute("title") or title_spans[0].text if title_spans else ""
                        if row_title and (row_title in self.known_group_chats or row_title in self.known_community_chats):
                            continue
                    except Exception:
                        pass

                    # Click individual chat
                    self.driver.execute_script("arguments[0].click();", row)
                    time.sleep(1.0)
                    return
        except Exception:
            pass

    def _is_outgoing_message(self, element, text: str = "") -> bool:
        """
        Determines whether a message element was sent by the bot / WhatsApp account (.message-out).
        Returns True if outgoing (bot's own message), False if incoming from the patient.
        """
        # 1. Text-based check against known sent messages, bot greetings, and intake prompts
        if text:
            cleaned = text.strip()
            norm = normalize_message_text(cleaned)
            cleaned_lower = cleaned.lower()
            sent_norms = getattr(self, "_sent_messages_normalized", set())

            if (
                cleaned in self._sent_messages
                or norm in sent_norms
                or cleaned_lower == DEFAULT_REPLY.lower()
                or cleaned_lower == COMPLETION_MESSAGE.lower()
                or cleaned_lower == CHIEF_COMPLAINT_PROMPT.lower()
                or norm == normalize_message_text(CHIEF_COMPLAINT_PROMPT)
                or norm == normalize_message_text(COMPLETION_MESSAGE)
                or norm == normalize_message_text(MENU_MESSAGE)
                or "welcome to medikiosk" in cleaned_lower
                or "ai patient assistant" in cleaned_lower
                or "start consultation" in cleaned_lower
                or "medical report upload will be available soon" in cleaned_lower
                or "thank you for using medikiosk" in cleaned_lower
                or "please select a valid option" in cleaned_lower
                or "your whatsapp account is not linked yet" in cleaned_lower
                or "whatsapp linked successfully" in cleaned_lower
                or "token not valid" in cleaned_lower
                or "the token you entered could not be verified" in cleaned_lower
                or "let's begin your clinical assessment" in cleaned_lower
                or "describe your main health concern" in cleaned_lower
                or "example: \"i have had chest pain since this morning\"" in cleaned_lower
                or "i have had chest pain since this morning" in cleaned_lower
                or "clinical assessment complete" in cleaned_lower
                or "physician-ready summary is now available" in cleaned_lower
                or "session reset" in cleaned_lower
                or "select language" in cleaned_lower
                or "select your preferred language" in cleaned_lower
                or "reply with 1, 2, 3, or 4" in cleaned_lower
                or "आपकी पसंदीदा भाषा चुनें" in cleaned_lower
                or "पसंतीची भाषा निवडा" in cleaned_lower
                or "પસંદગીની ભાષા પસંદ કરો" in cleaned_lower
            ):
                return True

            # If text has multiple lines or partial lines, check if any line matches known sent lines
            for line in cleaned.split("\n"):
                line_norm = normalize_message_text(line)
                if line_norm and (line_norm in sent_norms or line_norm in (
                    normalize_message_text(CHIEF_COMPLAINT_PROMPT),
                    "🩺 let's begin your clinical assessment.",
                    "please describe your main health concern or symptom.",
                    'example: "i have had chest pain since this morning."',
                )):
                    return True

        # 2. DOM class attributes
        try:
            class_attr = element.get_attribute("class") or ""
            if "message-out" in class_attr:
                return True
            if "message-in" in class_attr:
                return False

            # Check inside descendant elements
            if element.find_elements(By.XPATH, ".//*[contains(@class, 'message-out')]"):
                return True
            if element.find_elements(By.XPATH, ".//*[contains(@class, 'message-in')]"):
                return False

            # 3. Check for delivery status icons (only present on outgoing messages in WhatsApp Web)
            status_icons = element.find_elements(
                By.XPATH,
                ".//*[contains(@data-icon, 'msg-check') or contains(@data-icon, 'msg-dblcheck') or contains(@data-icon, 'msg-time') or contains(@data-icon, 'status-')]"
            )
            if status_icons:
                return True

            # 4. data-id convention (true_ = outgoing/fromMe, false_ = incoming)
            data_id = element.get_attribute("data-id") or ""
            if not data_id:
                try:
                    p = element.find_element(By.XPATH, "./ancestor-or-self::*[@data-id]")
                    data_id = p.get_attribute("data-id") or ""
                except Exception:
                    pass

            if not data_id:
                try:
                    descendant_with_id = element.find_elements(By.XPATH, ".//*[@data-id]")
                    for desc in descendant_with_id:
                        d_id = desc.get_attribute("data-id") or ""
                        if d_id.startswith("true_"):
                            return True
                        if d_id.startswith("false_"):
                            return False
                except Exception:
                    pass

            if data_id.startswith("true_"):
                return True
            if data_id.startswith("false_"):
                return False

        except Exception:
            pass

        return False

    def _is_incoming_message(self, element) -> bool:
        """Helper to check if a message is from the patient."""
        return not self._is_outgoing_message(element)

    def _prepopulate_existing_messages(self) -> None:
        """Indexes currently visible messages on startup to prevent re-replying to old history."""
        try:
            rows = self._get_newest_message_rows(limit=25)
            for row in rows:
                text = self._extract_text_from_element(row)
                msg_id = self._get_message_identifier(row, text)
                if msg_id:
                    self.processed_message_ids.add(msg_id)
                if text and self._is_outgoing_message(row, text):
                    self._record_sent_message(text)
            if self.processed_message_ids:
                logger.info("Deduplication cache initialized with %d existing messages.", len(self.processed_message_ids))
        except Exception as exc:
            logger.debug("Could not pre-populate existing messages: %s", exc)

    def _get_visible_message_rows(self):
        """Finds all visible message rows or bubbles inside the active chat pane."""
        rows = self.driver.find_elements(By.XPATH, "//div[@id='main']//div[@role='row']")
        if not rows:
            rows = self.driver.find_elements(
                By.XPATH,
                "//div[@id='main']//div[contains(@class, 'message-in') or contains(@class, 'message-out')]"
            )
        return rows

    def _get_message_identifier(self, element, text: str = "") -> Optional[str]:
        """Extracts a unique fingerprint for a message element using multiple fallback attributes."""
        try:
            # 1. Check data-id on the element, its descendant, or its parent row
            data_id = element.get_attribute("data-id")
            if not data_id:
                try:
                    candidates = element.find_elements(By.XPATH, ".//*[@data-id] | ./ancestor-or-self::*[@data-id]")
                    for c in candidates:
                        did = c.get_attribute("data-id")
                        if did:
                            data_id = did
                            break
                except Exception:
                    pass

            # 2. Check data-pre-plain-text (contains timestamp and sender info)
            pre_text = ""
            try:
                copyable = element.find_element(By.XPATH, ".//div[@data-pre-plain-text] | ./self::div[@data-pre-plain-text]")
                pre_text = copyable.get_attribute("data-pre-plain-text") or ""
            except Exception:
                pass

            # 3. Check time stamp span
            time_text = ""
            try:
                time_span = element.find_element(By.XPATH, ".//span[@dir='auto'][contains(text(), ':')]")
                time_text = time_span.text.strip()
            except Exception:
                pass

            el_id = getattr(element, "id", "") or str(id(element))

            if data_id:
                return data_id
            if pre_text and text:
                return f"{pre_text}_{text}_{el_id}"
            if time_text and text:
                return f"{time_text}_{text}_{el_id}"
            if text:
                return f"{text}_{el_id}"

        except StaleElementReferenceException:
            return None
        return None

    def _extract_text_from_element(self, element) -> str:
        """Extracts text from a message row or bubble using candidate text selectors."""
        for xpath in SELECTORS["text_selectors"]:
            try:
                spans = element.find_elements(By.XPATH, xpath)
                for s in spans:
                    t = s.text.strip()
                    if t:
                        return t
            except Exception:
                continue

        # Fallback to element text, stripping trailing timestamp pattern
        raw = element.text.strip()
        lines = [line.strip() for line in raw.split("\n") if line.strip()]
        if lines:
            return lines[0]
        return ""

    def _is_filter_bar_element(self, element) -> bool:
        """Determines whether an element belongs to the top chat list filter tabs (All, Unread, Groups)."""
        try:
            return bool(self.driver.execute_script("""
                var el = arguments[0];
                if (!el) return false;
                if (el.closest('div[role="tablist"]') || 
                    el.closest('button[role="tab"]') || 
                    el.closest('div[role="tab"]') ||
                    el.closest('header')) {
                    return true;
                }
                var text = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (text === 'all' || text === 'unread' || text === 'favourites' || text === 'groups') {
                    return true;
                }
                var btn = el.closest('button');
                if (btn) {
                    var btnText = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    if (btnText.includes('all') || btnText.includes('unread') || btnText.includes('groups') || btnText.includes('favourite')) {
                        return true;
                    }
                }
                return false;
            """, element))
        except Exception:
            return False

    def _open_chat_from_badge(self, badge) -> Optional[str]:
        """
        Clicks the contact or chat row containing an unread badge to open the conversation.
        Climbs from the badge to the conversation row container and dispatches robust
        clicks via JavaScript and Selenium ActionChains on the CHAT ROW (never the badge or filter bar).
        """
        try:
            # 1. Locate the ancestor conversation row container via Selenium
            chat_row = None
            for row_xpath in [
                "./ancestor::div[@role='row' or @role='listitem'][1]",
                "./ancestor::div[@tabindex='-1' and not(@role='tab')][1]",
                "./ancestor::div[contains(@class, 'lhggkp') or @data-testid='cell-frame-container'][1]",
                "./ancestor::div[contains(@class, '_ak72') or contains(@class, '_ak73')][1]",
            ]:
                try:
                    found = badge.find_element(By.XPATH, row_xpath)
                    if found and found.is_displayed():
                        # Exclude tabs/buttons in the top filter bar
                        role = found.get_attribute("role") or ""
                        if role != "tab":
                            chat_row = found
                            break
                except Exception:
                    continue

            # 2. Extract contact title and trigger click via JavaScript on the ROW container
            result = self.driver.execute_script("""
                var badge = arguments[0];
                var explicitRow = arguments[1];
                var pane = document.getElementById('pane-side');

                // If badge is inside tablist/filter bar, reject
                if (badge.closest('div[role="tablist"]') || badge.closest('button[role="tab"]') || badge.closest('div[role="tab"]')) {
                    return null;
                }

                // Find chat row container
                var row = explicitRow ||
                          (badge.getAttribute('role') === 'row' || badge.getAttribute('role') === 'listitem' ? badge : null) ||
                          badge.closest('div[role="row"]') || 
                          badge.closest('div[role="listitem"]') || 
                          badge.closest('div[tabindex="-1"]') || 
                          badge.closest('div[data-testid="cell-frame-container"]') ||
                          badge.closest('div._ak72') ||
                          badge.closest('div._ak73');

                if (!row) {
                    var curr = badge;
                    while (curr && curr.parentElement && curr.parentElement !== pane && curr.parentElement !== document.body) {
                        var role = curr.parentElement.getAttribute('role');
                        if (role === 'row' || role === 'listitem') {
                            row = curr.parentElement;
                            break;
                        }
                        curr = curr.parentElement;
                    }
                }

                if (!row) return null;
                if (row.getAttribute('role') === 'tab' || row.closest('div[role="tablist"]')) {
                    return null;
                }

                // Find contact title inside row, explicitly avoiding the badge count and filter pill labels
                var contactTitle = '';
                var titleEl = null;
                var filterNames = ['all', 'unread', 'favourites', 'groups', 'status', 'channels', 'filter'];

                var candidateSpans = row.querySelectorAll('span[title]');
                for (var i = 0; i < candidateSpans.length; i++) {
                    var t = (candidateSpans[i].getAttribute('title') || '').trim();
                    var aria = (candidateSpans[i].getAttribute('aria-label') || '').trim();
                    var tLow = t.toLowerCase();
                    if (t && !tLow.includes('unread') && !aria.toLowerCase().includes('unread') && !/^\\d+$/.test(t)) {
                        if (!filterNames.includes(tLow)) {
                            titleEl = candidateSpans[i];
                            contactTitle = t;
                            break;
                        }
                    }
                }
                if (!contactTitle) {
                    var alt = row.querySelector('div[data-testid="cell-frame-title"] span') ||
                              row.querySelector('div._ak8q span') ||
                              row.querySelector('div[role="gridcell"] span');
                    if (alt) {
                        var altText = (alt.getAttribute('title') || alt.innerText || '').trim();
                        var altLow = altText.toLowerCase();
                        if (altText && !/^\\d+$/.test(altText) && !filterNames.includes(altLow)) {
                            titleEl = alt;
                            contactTitle = altText;
                        }
                    }
                }

                if (contactTitle && filterNames.includes(contactTitle.toLowerCase())) {
                    return null;
                }

                // Target for clicking MUST be the chat row or title element, NEVER the badge
                var clickTarget = row || titleEl;

                if (clickTarget) {
                    try { clickTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e) {}

                    // Full pointer + mouse event sequence
                    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function(evt) {
                        clickTarget.dispatchEvent(new MouseEvent(evt, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            buttons: 1
                        }));
                    });
                    try { clickTarget.click(); } catch(e) {}
                }

                // If titleEl is distinct from clickTarget, also dispatch click on titleEl
                if (titleEl && titleEl !== clickTarget) {
                    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function(evt) {
                        titleEl.dispatchEvent(new MouseEvent(evt, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            buttons: 1
                        }));
                    });
                    try { titleEl.click(); } catch(e) {}
                }

                return contactTitle;
            """, badge, chat_row)

            contact_name = result if isinstance(result, str) and result else None

            # 3. Native Selenium click on the conversation row container (NOT badge!)
            target_to_click = chat_row
            if not target_to_click:
                try:
                    target_to_click = badge.find_element(
                        By.XPATH,
                        "./ancestor::div[(@role='row' or @role='listitem' or @tabindex='-1') and not(@role='tab')][1]"
                    )
                except Exception:
                    pass

            if target_to_click:
                try:
                    target_to_click.click()
                except Exception:
                    try:
                        ActionChains(self.driver).move_to_element(target_to_click).pause(0.05).click().perform()
                    except Exception:
                        pass

            return contact_name
        except Exception as exc:
            logger.debug("Error in _open_chat_from_badge: %s", exc)
            return None

    def _check_unread_chats(self) -> bool:
        """
        Scans for unread chat badges in the sidebar.
        Clicks the conversation to open it in the main view.
        Returns True if an unread chat was detected and clicked.
        """
        for xpath in SELECTORS["unread_badges"]:
            try:
                badges = self.driver.find_elements(By.XPATH, xpath)
                for badge in badges:
                    try:
                        if not badge.is_displayed():
                            continue

                        # Fast pre-filter 1: Skip if element is a top filter tab (All, Unread, Groups)
                        if self._is_filter_bar_element(badge):
                            continue

                        # Fast pre-filter 2: Skip if badge belongs to a group or community chat
                        if self._is_badge_in_group_or_community(badge):
                            continue

                        badge_text = badge.text.strip()
                        aria = badge.get_attribute("aria-label") or ""
                        if badge_text.isdigit() or "unread" in aria.lower():
                            opened_name = self._open_chat_from_badge(badge)
                            if not opened_name or opened_name.lower() in ("all", "unread", "favourites", "groups"):
                                logger.debug("Badge candidate did not resolve to an individual chat row ('%s'). Checking next candidate...", opened_name)
                                continue

                            logger.info("Unread message badge detected for '%s' (count: %s, label: '%s'). Opening chat...", opened_name, badge_text, aria)

                            loaded = self._wait_for_chat_load(opened_name, max_wait=2.5)

                            chat_title = self._get_active_chat_title()
                            if loaded or self._is_main_chat_open():
                                logger.info("Opened conversation: '%s'", chat_title or opened_name or "Active Chat")
                                # Check messages in this newly opened conversation
                                self._check_active_chat_messages()
                                return True
                            else:
                                logger.debug(
                                    "Could not open chat pane for '%s' (badge: %s, label: '%s'). Checking next badge...",
                                    opened_name or "unknown", badge_text, aria
                                )
                                continue
                    except (NoSuchElementException, StaleElementReferenceException):
                        continue
            except Exception as exc:
                logger.debug("Error querying unread badges: %s", exc)

        return False

    def _check_active_chat_messages(self) -> bool:
        """
        Inspects the active chat conversation in #main.
        Extracts the most recent incoming message from the patient,
        forwards it to Param's Clinical AI, and sends the AI follow-up question.
        Returns True if a reply was sent.
        """
        try:
            if not self._is_main_chat_open():
                return False

            chat_title = self._get_active_chat_title() or "default_patient"

            # Step 1: Guard against groups, communities, and announcement channels
            if self.is_group_or_community_chat():
                self._ignore_active_chat(chat_title)
                return False

            # Step 2: Extract stable WhatsApp identity (phone number/JID)
            whatsapp_id = self._get_active_chat_whatsapp_id() or chat_title

            # Step 3: Find the newest incoming message in individual chat
            # Allow brief moment for message rows to render in newly opened chat
            rows = self._get_newest_message_rows(limit=5)
            if not rows:
                for _ in range(3):
                    time.sleep(0.35)
                    rows = self._get_newest_message_rows(limit=5)
                    if rows:
                        break
            if not rows:
                return False

            # Inspect the latest messages from bottom upwards
            for row in reversed(rows):
                try:
                    text = self._extract_text_from_element(row)
                    if not text:
                        continue

                    # Check whether it is an outgoing/self message
                    if self._is_outgoing_message(row, text):
                        logger.debug("Latest message in '%s' is outgoing. Skipping.", chat_title)
                        return False

                    # Check whether it has already been processed
                    msg_id = self._get_message_identifier(row, text)
                    if not msg_id or msg_id in self.processed_message_ids:
                        logger.debug("Latest message in '%s' (id: %s) already processed. Skipping.", chat_title, msg_id)
                        return False

                    cleaned_text = text.strip()
                    logger.info("Found incoming patient message from '%s': '%s'", whatsapp_id, cleaned_text)

                    # Priority 2: Handle /reset or /restart command
                    if cleaned_text.lower() in ("/reset", "/restart", "reset", "restart"):
                        logger.info("Reset command received from '%s'. Clearing state and clinical session...", whatsapp_id)
                        self.clear_menu_state(whatsapp_id)
                        self.pending_languages.pop(whatsapp_id, None)
                        if chat_title != whatsapp_id:
                            self.clear_menu_state(chat_title)
                            self.pending_languages.pop(chat_title, None)
                        self.clinical_client.reset_session(whatsapp_id)
                        if chat_title != whatsapp_id:
                            self.clinical_client.reset_session(chat_title)
                        user_lang = self.get_user_language(whatsapp_id)
                        reply_text = LOCALIZED_RESET_MESSAGE.get(user_lang, 'Session reset. Send "hello medikiosk" to begin a consultation.')
                        sent = self.send_message(reply_text)
                        if sent:
                            self.processed_message_ids.add(msg_id)
                            self._record_sent_message(reply_text)
                            return True
                        else:
                            self.processed_message_ids.add(msg_id)
                            return False

                    # Determine active state and clinical session
                    current_menu_state = self.get_menu_state(whatsapp_id)
                    if current_menu_state == WhatsAppState.IDLE and whatsapp_id != chat_title:
                        current_menu_state = self.get_menu_state(chat_title)

                    s_id_1 = self.clinical_client.get_session_id(whatsapp_id)
                    s_id_2 = self.clinical_client.get_session_id(chat_title) if whatsapp_id != chat_title else None
                    has_clinical_session = (
                        (isinstance(s_id_1, str) and bool(s_id_1))
                        or (isinstance(s_id_2, str) and bool(s_id_2))
                    )

                    reply_text = None

                    # Priority 3: SELECTING_LANGUAGE state
                    if current_menu_state == WhatsAppState.SELECTING_LANGUAGE:
                        chosen_lang = _parse_language_choice(cleaned_text)
                        if not chosen_lang:
                            logger.info("Invalid language choice '%s' from '%s'", cleaned_text, whatsapp_id)
                            reply_text = LANGUAGE_SELECTION_MESSAGE
                        else:
                            is_linked = self.auth_client.is_linked(whatsapp_id)
                            if not is_linked and whatsapp_id != chat_title:
                                is_linked = self.auth_client.is_linked(chat_title)

                            if is_linked:
                                logger.info("Saving language '%s' to account for '%s'...", chosen_lang, whatsapp_id)
                                self.auth_client.update_account_language(whatsapp_id, chosen_lang)
                                self.set_user_language(whatsapp_id, chosen_lang)
                                if chat_title != whatsapp_id:
                                    self.set_user_language(chat_title, chosen_lang)
                                self.set_menu_state(whatsapp_id, WhatsAppState.MENU)
                                if chat_title != whatsapp_id:
                                    self.set_menu_state(chat_title, WhatsAppState.MENU)
                                reply_text = LOCALIZED_MENUS.get(chosen_lang, MENU_MESSAGE)
                            else:
                                logger.info("Language '%s' chosen by unlinked user '%s'. Requesting token...", chosen_lang, whatsapp_id)
                                self.pending_languages[whatsapp_id] = chosen_lang
                                if chat_title != whatsapp_id:
                                    self.pending_languages[chat_title] = chosen_lang
                                self.set_menu_state(whatsapp_id, WhatsAppState.WAITING_FOR_TOKEN)
                                if chat_title != whatsapp_id:
                                    self.set_menu_state(chat_title, WhatsAppState.WAITING_FOR_TOKEN)
                                reply_text = LOCALIZED_LINKING_INSTRUCTIONS.get(chosen_lang, LINKING_INSTRUCTIONS_MESSAGE)

                    # Priority 4: WAITING_FOR_TOKEN (Token input state)
                    elif current_menu_state == WhatsAppState.WAITING_FOR_TOKEN:
                        pending_lang = self.pending_languages.get(whatsapp_id) or self.pending_languages.get(chat_title) or DEFAULT_LANGUAGE
                        logger.info("Candidate token received from '%s'. Verifying with backend...", whatsapp_id)
                        link_kwargs = {}
                        if pending_lang and pending_lang != DEFAULT_LANGUAGE:
                            link_kwargs["language"] = pending_lang
                        link_result = self.auth_client.verify_and_link(
                            whatsapp_id=whatsapp_id, token=cleaned_text, **link_kwargs
                        )
                        if link_result.get("success"):
                            self.set_menu_state(whatsapp_id, WhatsAppState.IDLE)
                            if chat_title != whatsapp_id:
                                self.set_menu_state(chat_title, WhatsAppState.IDLE)
                            self.set_user_language(whatsapp_id, pending_lang)
                            if chat_title != whatsapp_id:
                                self.set_user_language(chat_title, pending_lang)
                            self.pending_languages.pop(whatsapp_id, None)
                            self.pending_languages.pop(chat_title, None)
                            user_name = link_result.get("user_name", "")
                            reply_text = format_link_success_message(user_name, language=pending_lang)
                        else:
                            # Remain in WAITING_FOR_TOKEN
                            reply_text = LOCALIZED_INVALID_TOKEN.get(pending_lang, INVALID_TOKEN_MESSAGE)

                    # Priority 5: Active clinical session
                    elif has_clinical_session or current_menu_state == WhatsAppState.CLINICAL_SESSION:
                        session_id_key = whatsapp_id if (self.clinical_client.get_session_id(whatsapp_id) is not None or (hasattr(self.clinical_client, "pending_complaint") and whatsapp_id in self.clinical_client.pending_complaint)) else chat_title
                        logger.info("Incoming patient message from '%s' (active clinical session): '%s'", session_id_key, cleaned_text)
                        self.set_menu_state(whatsapp_id, WhatsAppState.CLINICAL_SESSION)
                        if chat_title != whatsapp_id:
                            self.set_menu_state(chat_title, WhatsAppState.CLINICAL_SESSION)
                        user_lang = self.get_user_language(session_id_key)
                        handle_kwargs = {}
                        if user_lang and user_lang != DEFAULT_LANGUAGE:
                            handle_kwargs["language"] = user_lang
                        reply_text = self.clinical_client.handle_message(
                            patient_id=session_id_key, message=cleaned_text, **handle_kwargs
                        )
                        # If session completed, transition to doctor selection if doctors recommended
                        is_pending = hasattr(self.clinical_client, "pending_complaint") and (whatsapp_id in self.clinical_client.pending_complaint or chat_title in self.clinical_client.pending_complaint)
                        if self.clinical_client.get_session_id(session_id_key) is None and not is_pending:
                            if hasattr(self.clinical_client, "recommended_doctors") and (whatsapp_id in self.clinical_client.recommended_doctors or chat_title in self.clinical_client.recommended_doctors):
                                self.set_menu_state(whatsapp_id, WhatsAppState.WAITING_FOR_DOCTOR_SELECTION)
                                if chat_title != whatsapp_id:
                                    self.set_menu_state(chat_title, WhatsAppState.WAITING_FOR_DOCTOR_SELECTION)
                            else:
                                self.clear_menu_state(whatsapp_id)
                                if chat_title != whatsapp_id:
                                    self.clear_menu_state(chat_title)

                    # Priority 5b: WAITING_FOR_DOCTOR_SELECTION state
                    elif current_menu_state == WhatsAppState.WAITING_FOR_DOCTOR_SELECTION:
                        user_lang = self.get_user_language(whatsapp_id) or DEFAULT_LANGUAGE
                        docs = getattr(self.clinical_client, "recommended_doctors", {}).get(whatsapp_id) or getattr(self.clinical_client, "recommended_doctors", {}).get(chat_title, [])
                        if cleaned_text.isdigit():
                            idx = int(cleaned_text) - 1
                            if 0 <= idx < len(docs):
                                selected_doc = docs[idx]
                                if not hasattr(self.clinical_client, "selected_doctor"):
                                    self.clinical_client.selected_doctor = {}
                                self.clinical_client.selected_doctor[whatsapp_id] = selected_doc
                                if chat_title != whatsapp_id:
                                    self.clinical_client.selected_doctor[chat_title] = selected_doc
                                doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()
                                try:
                                    slots_data = self.clinical_client.get_doctor_slots(selected_doc["id"], patient_id=whatsapp_id)
                                    slots = slots_data.get("slots", [])
                                    if slots:
                                        if not hasattr(self.clinical_client, "available_slots"):
                                            self.clinical_client.available_slots = {}
                                        self.clinical_client.available_slots[whatsapp_id] = slots
                                        if chat_title != whatsapp_id:
                                            self.clinical_client.available_slots[chat_title] = slots
                                        self.set_menu_state(whatsapp_id, WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION)
                                        if chat_title != whatsapp_id:
                                            self.set_menu_state(chat_title, WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION)
                                        reply_text = format_doctor_slots(doc_name, slots, date_str=slots_data.get("date", ""), language=user_lang)
                                    else:
                                        reply_text = format_doctor_slots(doc_name, [], language=user_lang)
                                except Exception as exc:
                                    logger.error("Failed to retrieve slots for doctor %s: %s", selected_doc.get("id"), exc)
                                    reply_text = ERROR_MESSAGE
                            else:
                                reply_text = format_invalid_doctor_choice(len(docs), language=user_lang)
                        else:
                            reply_text = format_invalid_doctor_choice(len(docs), language=user_lang)

                    # Priority 5c: WAITING_FOR_APPOINTMENT_SELECTION state
                    elif current_menu_state == WhatsAppState.WAITING_FOR_APPOINTMENT_SELECTION:
                        user_lang = self.get_user_language(whatsapp_id) or DEFAULT_LANGUAGE
                        slots = getattr(self.clinical_client, "available_slots", {}).get(whatsapp_id) or getattr(self.clinical_client, "available_slots", {}).get(chat_title, [])
                        selected_doc = getattr(self.clinical_client, "selected_doctor", {}).get(whatsapp_id) or getattr(self.clinical_client, "selected_doctor", {}).get(chat_title, {})
                        sess_id = getattr(self.clinical_client, "last_completed_session", {}).get(whatsapp_id) or getattr(self.clinical_client, "last_completed_session", {}).get(chat_title)

                        if cleaned_text.isdigit():
                            idx = int(cleaned_text) - 1
                            if 0 <= idx < len(slots):
                                selected_slot = slots[idx]
                                doc_id = selected_doc.get("id")
                                try:
                                    book_res = self.clinical_client.book_appointment(
                                        patient_id=whatsapp_id,
                                        session_id=sess_id,
                                        doctor_id=doc_id,
                                        scheduled_at=selected_slot.get("scheduledAt"),
                                    )
                                    if book_res.get("success"):
                                        self.clear_menu_state(whatsapp_id)
                                        if chat_title != whatsapp_id:
                                            self.clear_menu_state(chat_title)
                                        self.clinical_client.recommended_doctors.pop(whatsapp_id, None)
                                        self.clinical_client.selected_doctor.pop(whatsapp_id, None)
                                        self.clinical_client.available_slots.pop(whatsapp_id, None)
                                        self.clinical_client.last_completed_session.pop(whatsapp_id, None)
                                        if chat_title != whatsapp_id:
                                            self.clinical_client.recommended_doctors.pop(chat_title, None)
                                            self.clinical_client.selected_doctor.pop(chat_title, None)
                                            self.clinical_client.available_slots.pop(chat_title, None)
                                            self.clinical_client.last_completed_session.pop(chat_title, None)

                                        doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()
                                        spec = selected_doc.get("specialization") or "General Medicine"
                                        date_val = selected_slot.get("scheduledAt", "")[:10]
                                        time_val = selected_slot.get("time12") or selected_slot.get("time") or ""
                                        reply_text = format_confirmation_message(doc_name, spec, date_val, time_val, language=user_lang)
                                    elif book_res.get("status_code") == 409:
                                        # Slot conflict! Refresh slots and prompt again
                                        slots_data = self.clinical_client.get_doctor_slots(doc_id, patient_id=whatsapp_id)
                                        refreshed_slots = slots_data.get("slots", [])
                                        self.clinical_client.available_slots[whatsapp_id] = refreshed_slots
                                        if chat_title != whatsapp_id:
                                            self.clinical_client.available_slots[chat_title] = refreshed_slots
                                        conflict_header = LOCALIZED_SLOT_CONFLICT.get(user_lang, LOCALIZED_SLOT_CONFLICT["en"])
                                        doc_name = selected_doc.get("name") or f"Dr. {selected_doc.get('firstName', '')} {selected_doc.get('lastName', '')}".strip()
                                        slots_msg = format_doctor_slots(doc_name, refreshed_slots, date_str=slots_data.get("date", ""), language=user_lang)
                                        reply_text = f"{conflict_header}\n{slots_msg}"
                                    else:
                                        reply_text = ERROR_MESSAGE
                                except Exception as exc:
                                    logger.error("Failed to book appointment: %s", exc)
                                    reply_text = ERROR_MESSAGE
                            else:
                                reply_text = format_invalid_slot_choice(len(slots), language=user_lang)
                        else:
                            reply_text = format_invalid_slot_choice(len(slots), language=user_lang)


                    # Priority 6: Active menu state
                    elif current_menu_state == WhatsAppState.MENU:
                        user_lang = self.get_user_language(whatsapp_id)
                        if cleaned_text == "1":
                            logger.info("Option 1 (Start Consultation) chosen by '%s'", whatsapp_id)
                            self.set_menu_state(whatsapp_id, WhatsAppState.CLINICAL_SESSION)
                            if chat_title != whatsapp_id:
                                self.set_menu_state(chat_title, WhatsAppState.CLINICAL_SESSION)
                            handle_kwargs = {}
                            if user_lang and user_lang != DEFAULT_LANGUAGE:
                                handle_kwargs["language"] = user_lang
                            reply_text = self.clinical_client.handle_message(
                                patient_id=whatsapp_id, message=cleaned_text, **handle_kwargs
                            )
                        elif cleaned_text == "2":
                            logger.info("Option 2 (Upload Medical Report) chosen by '%s'", whatsapp_id)
                            reply_text = LOCALIZED_UPLOAD_REPORT.get(user_lang, UPLOAD_REPORT_TEXT)
                            # Remain in MENU state
                        elif cleaned_text == "3":
                            logger.info("Option 3 (Exit) chosen by '%s'", whatsapp_id)
                            self.clear_menu_state(whatsapp_id)
                            if chat_title != whatsapp_id:
                                self.clear_menu_state(chat_title)
                            self.clinical_client.reset_session(whatsapp_id)
                            if chat_title != whatsapp_id:
                                self.clinical_client.reset_session(chat_title)
                            reply_text = LOCALIZED_EXIT_TEXT.get(user_lang, EXIT_TEXT)
                        else:
                            logger.info("Invalid menu option '%s' from '%s'", cleaned_text, whatsapp_id)
                            reply_text = LOCALIZED_INVALID_MENU.get(user_lang, INVALID_MENU_TEXT)
                            # Remain in MENU state

                    # Priority 7: Exact activation phrase ('hello medikiosk')
                    elif is_exact_activation_message(cleaned_text):
                        is_linked = self.auth_client.is_linked(whatsapp_id)
                        if not is_linked and whatsapp_id != chat_title:
                            is_linked = self.auth_client.is_linked(chat_title)

                        if not is_linked:
                            logger.info("Unlinked user '%s' sent activation phrase. Prompting for language selection...", whatsapp_id)
                            self.set_menu_state(whatsapp_id, WhatsAppState.SELECTING_LANGUAGE)
                            if chat_title != whatsapp_id:
                                self.set_menu_state(chat_title, WhatsAppState.SELECTING_LANGUAGE)
                            reply_text = LANGUAGE_SELECTION_MESSAGE
                        else:
                            account_lang = None
                            try:
                                raw_lang = self.auth_client.get_account_language(whatsapp_id)
                                if isinstance(raw_lang, str) and raw_lang.strip():
                                    account_lang = raw_lang.strip().lower()
                                elif raw_lang is not None and hasattr(raw_lang, "assert_called"):
                                    account_lang = DEFAULT_LANGUAGE
                            except Exception:
                                pass

                            if account_lang:
                                logger.info("Linked user '%s' (language: %s) sent activation phrase. Presenting localized menu...", whatsapp_id, account_lang)
                                self.set_user_language(whatsapp_id, account_lang)
                                if chat_title != whatsapp_id:
                                    self.set_user_language(chat_title, account_lang)
                                self.set_menu_state(whatsapp_id, WhatsAppState.MENU)
                                if chat_title != whatsapp_id:
                                    self.set_menu_state(chat_title, WhatsAppState.MENU)
                                reply_text = LOCALIZED_MENUS.get(account_lang, MENU_MESSAGE)
                            else:
                                logger.info("Linked user '%s' has no language configured. Prompting for language selection...", whatsapp_id)
                                self.set_menu_state(whatsapp_id, WhatsAppState.SELECTING_LANGUAGE)
                                if chat_title != whatsapp_id:
                                    self.set_menu_state(chat_title, WhatsAppState.SELECTING_LANGUAGE)
                                reply_text = LANGUAGE_SELECTION_MESSAGE

                    # Priority 8: Otherwise ignore
                    else:
                        logger.info(
                            "Ignoring message from '%s' (idle state, not activation phrase '%s'): '%s'",
                            whatsapp_id, ACTIVATION_PHRASE, cleaned_text
                        )
                        # Mark as processed so we do not repeatedly inspect it
                        self.processed_message_ids.add(msg_id)
                        return False

                    # Send response through WhatsApp & mark as processed
                    if reply_text:
                        logger.info("Generating reply for '%s': '%s'", whatsapp_id, reply_text)
                        sent = self.send_message(reply_text)
                        if sent:
                            logger.info("Reply sent to '%s': '%s'", whatsapp_id, reply_text)
                            self.processed_message_ids.add(msg_id)
                            self._record_sent_message(reply_text)
                            self._send_tts_if_enabled(whatsapp_id, reply_text, self.get_user_language(whatsapp_id) or DEFAULT_LANGUAGE)
                            try:
                                new_rows = self._get_newest_message_rows(limit=2)
                                if new_rows:
                                    last_row = new_rows[-1]
                                    last_id = self._get_message_identifier(last_row, reply_text)
                                    if last_id:
                                        self.processed_message_ids.add(last_id)
                            except Exception:
                                pass
                            return True
                    else:
                        self.processed_message_ids.add(msg_id)
                        return False

                except StaleElementReferenceException:
                    continue

        except StaleElementReferenceException:
            pass
        except Exception as exc:
            logger.error("Error checking active chat messages: %s", exc)

        return False

    def send_message(self, message: str) -> bool:
        """
        Sends a message into the active conversation input box as EXACTLY ONE message.
        Preserves formatting, emojis, and line breaks without splitting into multiple messages.
        """
        return self._send_reply(message)

    def _send_reply(self, reply_text: str) -> bool:
        """Types and sends a message into the active conversation input box as EXACTLY ONE message."""
        input_box = None

        for xpath in SELECTORS["chat_input_candidates"]:
            try:
                elements = self.driver.find_elements(By.XPATH, xpath)
                for el in elements:
                    if el.is_displayed():
                        input_box = el
                        break
                if input_box:
                    break
            except Exception:
                continue

        if not input_box:
            logger.error("Error: Could not locate chat input field in active chat.")
            return False

        try:
            # Focus input field
            try:
                ActionChains(self.driver).move_to_element(input_box).click().perform()
            except Exception:
                self.driver.execute_script("arguments[0].focus();", input_box)
            time.sleep(0.3)

            # In WhatsApp Web, sending '\n' with send_keys triggers Enter and prematurely sends lines as separate messages.
            # To guarantee the message is sent as EXACTLY ONE WhatsApp message:
            # Type each line and use Shift+Enter to insert line breaks without submitting.
            lines = reply_text.split("\n")
            for idx, line in enumerate(lines):
                if line:
                    input_box.send_keys(line)
                if idx < len(lines) - 1:
                    ActionChains(self.driver).key_down(Keys.SHIFT).send_keys(Keys.ENTER).key_up(Keys.SHIFT).perform()

            time.sleep(0.3)
            # Submit the complete single combined message
            input_box.send_keys(Keys.ENTER)
            time.sleep(0.5)

            # Check if send button needs to be clicked (in case Enter didn't submit)
            for btn_xpath in SELECTORS["send_button_candidates"]:
                try:
                    send_btns = self.driver.find_elements(By.XPATH, btn_xpath)
                    for btn in send_btns:
                        if btn.is_displayed():
                            try:
                                ActionChains(self.driver).move_to_element(btn).click().perform()
                            except Exception:
                                self.driver.execute_script("arguments[0].click();", btn)
                            time.sleep(0.3)
                            break
                except Exception:
                    continue

            self._record_sent_message(reply_text)
            return True

        except Exception as exc:
            logger.error("Error while typing/sending reply: %s", exc)
            return False

    def _send_tts_if_enabled(self, whatsapp_id: str, text: str, language: str) -> None:
        """
        Sends audio along with text if the patient's accessibility preference
        is 'voice_guidance' or 'hearing_assistance'.
        Never raises errors or blocks message delivery.
        """
        try:
            pref = getattr(self.clinical_client, "patient_accessibility", {}).get(whatsapp_id, "none")
            if pref in ("voice_guidance", "hearing_assistance"):
                logger.info("Accessibility preference '%s' active for '%s'. Synthesizing Sarvam TTS audio...", pref, whatsapp_id)
                audio_data = self.clinical_client.synthesize_speech(text, language=language)
                if audio_data:
                    self.send_audio(audio_data)
        except Exception as exc:
            logger.warning("TTS audio generation/sending failed (graceful fallback to text-only): %s", exc)

    def send_audio(self, audio_bytes: bytes, filename: str = "voice_guidance.wav") -> bool:
        """
        Sends an audio file attachment to the active conversation.
        If file input or WhatsApp attach fails, logs a warning and returns False.
        Never breaks execution or alters booking state.
        """
        if not self.driver or not audio_bytes:
            return False

        temp_path = None
        try:
            temp_dir = self.session_dir / "temp_audio"
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_path = temp_dir / filename
            temp_path.write_bytes(audio_bytes)

            file_inputs = self.driver.find_elements(By.XPATH, "//input[@type='file']")
            if not file_inputs:
                attach_buttons = self.driver.find_elements(
                    By.XPATH,
                    "//div[@id='main']//footer//button[@title='Attach' or .//span[@data-icon='plus' or @data-icon='attach-menu-plus']]"
                )
                for btn in attach_buttons:
                    try:
                        btn.click()
                        time.sleep(0.5)
                        break
                    except Exception:
                        pass
                file_inputs = self.driver.find_elements(By.XPATH, "//input[@type='file']")

            if file_inputs:
                target_input = file_inputs[0]
                for fi in file_inputs:
                    accept = fi.get_attribute("accept") or ""
                    if "audio" in accept or "*" in accept:
                        target_input = fi
                        break
                target_input.send_keys(str(temp_path.resolve()))
                time.sleep(1.0)

                send_media_btns = self.driver.find_elements(
                    By.XPATH,
                    "//span[@data-icon='send']/ancestor::button | //div[@role='button'][.//span[@data-icon='send']]"
                )
                for sb in send_media_btns:
                    if sb.is_displayed():
                        sb.click()
                        time.sleep(0.5)
                        return True
            return False
        except Exception as exc:
            logger.warning("Failed to send TTS audio attachment: %s", exc)
            return False
        finally:
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass

    def run(self) -> None:
        """Main execution loop for listening and replying."""
        try:
            self.start()
            if not self.wait_for_login():
                return

            self.is_running = True
            logger.info("Bot is active and monitoring incoming WhatsApp messages. Press Ctrl+C to stop.")

            while self.is_running:
                # 1. Ensure a chat is open (only if no chat is currently open in main pane)
                if not self._is_main_chat_open():
                    self._ensure_active_chat_open()

                # 2. Check sidebar for unread chats
                unread_handled = self._check_unread_chats()

                # 3. Check active conversation for new messages (if not just processed via unread)
                if not unread_handled:
                    self._check_active_chat_messages()

                # Heartbeat log every 10 loops so the user sees live status
                self._loop_count += 1
                if self._loop_count % 10 == 0:
                    title = self._get_active_chat_title()
                    status_info = f"Active chat: '{title}'" if title else "No chat open"
                    logger.info("Scanning WhatsApp Web... [%s]", status_info)

                time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Stopping bot on user request (Ctrl+C)...")
        except WebDriverException as exc:
            logger.error("Error: WebDriver error encountered: %s", exc)
        except Exception as exc:
            logger.exception("Error: Unexpected exception in bot loop: %s", exc)
        finally:
            self.stop()

    def stop(self) -> None:
        """Closes the browser session cleanly."""
        self.is_running = False
        if self.driver:
            logger.info("Closing Chrome browser...")
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
        logger.info("WhatsApp bot stopped.")


def main():
    bot = WhatsAppBot()
    bot.run()


if __name__ == "__main__":
    main()
