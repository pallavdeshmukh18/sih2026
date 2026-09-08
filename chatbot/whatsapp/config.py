import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Target URL
WHATSAPP_WEB_URL: str = "https://web.whatsapp.com/"

# Session storage for persistent WhatsApp Web login across restarts
SESSION_DIR: Path = Path(__file__).resolve().parent / ".session"

# Timeouts & Intervals (in seconds)
LOGIN_TIMEOUT: int = 120
POLL_INTERVAL: float = 2.0
PAGE_LOAD_TIMEOUT: int = 60

# Param's Clinical AI Service Configuration
CLINICAL_API_URL: str = os.environ.get("CLINICAL_API_URL", "http://localhost:8000").rstrip("/")
CLINICAL_API_TIMEOUT: int = int(os.environ.get("CLINICAL_API_TIMEOUT", "30"))

# Default Clinical Intake Parameters
DEFAULT_LANGUAGE: str = os.environ.get("CLINICAL_LANGUAGE", "en")
DEFAULT_CONSULTATION_TYPE: str = os.environ.get("CLINICAL_CONSULTATION_TYPE", "allopathic")
DEFAULT_CHIEF_COMPLAINT: str = os.environ.get("CLINICAL_CHIEF_COMPLAINT", "generic")

# Backend API URL for MediKiosk Authentication & Services
BACKEND_API_URL: str = os.environ.get("BACKEND_API_URL", "http://localhost:5001").rstrip("/")
BACKEND_API_TIMEOUT: int = int(os.environ.get("BACKEND_API_TIMEOUT", "10"))
WHATSAPP_SERVICE_KEY: str = os.environ.get("WHATSAPP_SERVICE_KEY", "medikiosk_whatsapp_service_secret_2026_x89f2")

# Backend WhatsApp Clinical Endpoints
WHATSAPP_CLINICAL_START_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/session/start"
WHATSAPP_CLINICAL_TURN_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/session/{{session_id}}/text-turn"
WHATSAPP_CLINICAL_FINALIZE_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/session/{{session_id}}/finalize"

# User-facing standard bot messages
CHIEF_COMPLAINT_PROMPT: str = (
    "🩺 *Let's begin your clinical assessment.*\n\n"
    "Please describe your main health concern or symptom.\n\n"
    '_Example: "I have had chest pain since this morning."_'
)
COMPLETION_MESSAGE: str = (
    "━━━━━━━━━━━━━━━━━━\n"
    "✅ *Clinical Assessment Complete*\n"
    "━━━━━━━━━━━━━━━━━━\n\n"
    "Your assessment has been recorded successfully.\n\n"
    "🩺 Your physician-ready summary is now available in your MediKiosk account."
)
ERROR_MESSAGE: str = "Sorry, I'm temporarily unable to process your response. Please try again."

# Activation Phrase for starting a new interaction
ACTIVATION_PHRASE: str = "hello medikiosk"

# WhatsApp Menu & Authentication States
class WhatsAppState:
    IDLE = "IDLE"
    WAITING_FOR_TOKEN = "WAITING_FOR_TOKEN"
    MENU = "MENU"
    CLINICAL_SESSION = "CLINICAL_SESSION"

# Authentication & Linking Messages (Single WhatsApp Messages)
LINKING_INSTRUCTIONS_MESSAGE: str = (
    "━━━━━━━━━━━━━━━━━━\n"
    "🏥 *MediKiosk*\n"
    "━━━━━━━━━━━━━━━━━━\n\n"
    "👋 Welcome to MediKiosk!\n\n"
    "🔐 *Your WhatsApp account is not linked yet.*\n\n"
    "To continue, link your WhatsApp number to your MediKiosk account.\n\n"
    "🌐 *How to link:*\n\n"
    "1️⃣ Open the MediKiosk website.\n"
    "2️⃣ Log in to your MediKiosk account.\n"
    "3️⃣ Go to *Link WhatsApp*.\n"
    "4️⃣ Click *Generate WhatsApp Token*.\n"
    "5️⃣ Copy the generated token.\n"
    "6️⃣ Send that token here.\n\n"
    "🔑 *Where do I find the token?*\n"
    "You can find it on the MediKiosk website under:\n\n"
    "*Account → Link WhatsApp*\n\n"
    "⚠️ Do not share this token with anyone.\n\n"
    "💬 Once you send the token here, your WhatsApp account will be linked.\n\n"
    "━━━━━━━━━━━━━━━━━━"
)

INVALID_TOKEN_MESSAGE: str = (
    "━━━━━━━━━━━━━━━━━━\n"
    "❌ *Token Not Valid*\n"
    "━━━━━━━━━━━━━━━━━━\n\n"
    "The token you entered could not be verified.\n\n"
    "Please:\n\n"
    "1️⃣ Log in to the MediKiosk website.\n"
    "2️⃣ Open *Account → Link WhatsApp*.\n"
    "3️⃣ Generate/copy a valid WhatsApp token.\n"
    "4️⃣ Send the token here.\n\n"
    "💡 Make sure you copied the complete token without extra spaces.\n\n"
    "━━━━━━━━━━━━━━━━━━"
)

def format_link_success_message(user_name: str = "") -> str:
    """Formats the single WhatsApp confirmation message upon successful account linking."""
    greeting = f"Welcome to MediKiosk, *{user_name.strip()}* 👋" if user_name and user_name.strip() else "Welcome to MediKiosk 👋"
    return (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *WhatsApp Linked Successfully!*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"{greeting}\n\n"
        "Your WhatsApp account is now linked to your MediKiosk account.\n\n"
        "You can now use MediKiosk directly from WhatsApp.\n\n"
        "💬 Send *hello medikiosk* to begin.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    )


# User-facing standard menu messages
# Complete single-message menu string sent as EXACTLY ONE WhatsApp message
MENU_MESSAGE: str = (
    "━━━━━━━━━━━━━━━━━━\n"
    "🏥 *MediKiosk*\n"
    "🩺 *AI Patient Assistant*\n"
    "━━━━━━━━━━━━━━━━━━\n\n"
    "👋 *Welcome to MediKiosk!*\n\n"
    "How can I help you today?\n\n"
    "1️⃣ 🩺 *Start Consultation*\n"
    "   Begin your AI-guided health consultation.\n\n"
    "2️⃣ 📄 *Upload Medical Report*\n"
    "   Digitize and analyze your medical documents.\n\n"
    "3️⃣ 🚪 *Exit*\n"
    "   End the current interaction.\n\n"
    "━━━━━━━━━━━━━━━━━━\n"
    "💬 *Reply with 1, 2, or 3*\n"
    "━━━━━━━━━━━━━━━━━━"
)
# Alias for backwards compatibility
MENU_TEXT: str = MENU_MESSAGE

UPLOAD_REPORT_TEXT: str = (
    "📄 Medical report upload will be available soon.\n\n"
    "Please choose:\n"
    "1️⃣ Start Consultation\n"
    "2️⃣ Upload Medical Report\n"
    "3️⃣ Exit"
)

EXIT_TEXT: str = (
    "Thank you for using MediKiosk. 👋\n\n"
    'Send "hello medikiosk" anytime to start again.'
)

INVALID_MENU_TEXT: str = (
    "Please select a valid option:\n\n"
    "1️⃣ Start Consultation\n"
    "2️⃣ Upload Medical Report\n"
    "3️⃣ Exit"
)

# Bot Default Trigger & Response (legacy fallback)
TRIGGER_KEYWORD: str = "hello"
DEFAULT_REPLY: str = "Hello! Welcome to MediKiosk."

# WhatsApp Web DOM Selectors (XPath with multiple fallback strategies)
SELECTORS = {
    # Elements indicating successful login
    "login_indicators": [
        "//div[@id='pane-side']",
        "//div[@contenteditable='true'][@data-tab='3']",
        "//header//div[@role='button']",
        "//div[@id='app']//div[contains(@class, 'two')]",
    ],
    # Unread badge indicator in chat sidebar (fast, specific selectors scoped to conversation rows)
    "unread_badges": [
        "//div[@id='pane-side']//div[contains(@class, '_ak8l')]//span[text() or contains(@aria-label, 'unread')]",
        "//div[@id='pane-side']//div[@role='row' or @role='listitem' or @tabindex='-1']//span[contains(@aria-label, 'unread') or contains(@aria-label, 'Unread')]",
        "//div[@id='pane-side']//div[@role='row' or @role='listitem' or @tabindex='-1']//span[@data-icon='unread-count']",
        "//div[@id='pane-side']//span[contains(@class, 'l70w8e0a')]",
    ],
    # Group chat structural indicators in #main
    "group_header_icons": [
        ".//*[@data-icon='default-group']",
        ".//*[@data-icon='group']",
        ".//*[@data-testid='default-group']",
        ".//*[@data-testid='group']",
    ],
    # Community & Announcement channel structural indicators in #main
    "community_header_icons": [
        ".//*[@data-icon='community']",
        ".//*[@data-icon='community-outline']",
        ".//*[@data-icon='round-community']",
        ".//*[@data-icon='community-home']",
        ".//*[@data-icon='announcement']",
        ".//*[@data-icon='announcement-outline']",
        ".//*[@data-icon='channel']",
        ".//*[@data-icon='newsletter']",
        ".//*[@data-testid='community']",
        ".//*[@data-testid='community-outline']",
        ".//*[@data-testid='announcement']",
        ".//*[@data-testid='announcement-outline']",
        ".//*[@data-testid='channel-outline']",
        ".//*[@data-testid='newsletter-outline']",
    ],
    # Sidebar group/community icons
    "sidebar_group_icons": [
        ".//*[@data-icon='default-group']",
        ".//*[@data-icon='community']",
        ".//*[@data-icon='community-outline']",
        ".//*[@data-icon='announcement']",
        ".//*[@data-icon='announcement-outline']",
        ".//*[@data-icon='channel']",
        ".//*[@data-icon='newsletter']",
        ".//*[@data-testid='default-group']",
        ".//*[@data-testid='community']",
        ".//*[@data-testid='community-outline']",
        ".//*[@data-testid='announcement']",
    ],
    # Group/community incoming message author tags
    "group_author_tags": [
        "//div[@id='main']//div[contains(@class, 'message-in')]//span[contains(@class, 'color-')]",
        "//div[@id='main']//div[@role='row']//span[contains(@class, 'color-') and @dir='auto']",
        "//div[@id='main']//div[contains(@class, 'message-in')]//*[@data-testid='author']",
    ],
    # Announcement channel admin-only message bar in footer
    "announcement_footer_indicators": [
        "//div[@id='main']//footer//*[contains(text(), 'Only community admins') or contains(text(), 'only community admins')]",
        "//div[@id='main']//footer//*[contains(text(), 'Only admins') or contains(text(), 'only admins')]",
        "//div[@id='main']//footer//*[contains(text(), 'Only group admins') or contains(text(), 'only group admins')]",
        "//div[@id='main']//div[contains(@class, 'copyable-area')]//*[contains(text(), 'Only admins can send messages')]",
    ],
    # Chat rows in the side pane
    "chat_rows": [
        "//div[@id='pane-side']//div[@role='listitem']",
        "//div[@id='pane-side']//div[@tabindex='-1']",
        "//div[@id='pane-side']//div[@role='row']",
    ],
    # Active conversation window
    "main_chat": "//div[@id='main']",
    # Active chat title / header contact name
    "chat_header_title": "//div[@id='main']//header//span[@dir='auto']",
    # All message rows in the active chat pane
    "message_rows": "//div[@id='main']//div[@role='row']",
    # Specific incoming message bubbles (white/left aligned)
    "incoming_bubbles": [
        "//div[@id='main']//div[contains(@class, 'message-in')]",
        "//div[@id='main']//div[@role='row'][.//div[contains(@class, 'message-in')]]",
        "//div[@id='main']//div[@data-id and contains(@class, 'message-in')]",
    ],
    # Specific outgoing message bubbles (green/right aligned)
    "outgoing_bubbles": [
        "//div[@id='main']//div[contains(@class, 'message-out')]",
        "//div[@id='main']//div[@role='row'][.//div[contains(@class, 'message-out')]]",
    ],
    # Text selectors inside a message bubble
    "text_selectors": [
        ".//span[contains(@class, 'selectable-text')]",
        ".//span[contains(@class, '_ao3e')]",
        ".//div[contains(@class, 'copyable-text')]",
        ".//span[@dir='ltr']",
    ],
    # Text input box in the footer
    "chat_input_candidates": [
        "//div[@id='main']//footer//div[@contenteditable='true'][@data-tab='10']",
        "//div[@id='main']//footer//div[@contenteditable='true']",
        "//footer//div[@contenteditable='true']",
        "//footer//p[contains(@class, 'selectable-text')]",
    ],
    # Send button candidates
    "send_button_candidates": [
        "//div[@id='main']//footer//button[@aria-label='Send']",
        "//div[@id='main']//footer//button[.//span[@data-icon='send']]",
        "//div[@id='main']//footer//span[@data-icon='send']/ancestor::button",
        "//footer//button[@aria-label='Send']",
        "//footer//span[@data-icon='send']/ancestor::button",
        "//footer//button[contains(@class, 'x1c4vz4f')]",
    ],
}

