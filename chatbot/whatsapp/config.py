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
WHATSAPP_CLINICAL_RECOMMENDATIONS_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/recommendations"
WHATSAPP_CLINICAL_SLOTS_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/doctors/{{doctor_id}}/slots"
WHATSAPP_CLINICAL_BOOK_URL: str = f"{BACKEND_API_URL}/api/whatsapp/clinical/book"

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
    SELECTING_LANGUAGE = "SELECTING_LANGUAGE"
    WAITING_FOR_TOKEN = "WAITING_FOR_TOKEN"
    MENU = "MENU"
    CLINICAL_SESSION = "CLINICAL_SESSION"
    WAITING_FOR_DOCTOR_SELECTION = "WAITING_FOR_DOCTOR_SELECTION"
    WAITING_FOR_APPOINTMENT_SELECTION = "WAITING_FOR_APPOINTMENT_SELECTION"


# Supported Languages for WhatsApp Menu & Intake
LANGUAGE_MAP: dict = {
    "1": "en",
    "2": "hi",
    "3": "mr",
    "4": "gu",
}

# Single WhatsApp message for Language Selection
LANGUAGE_SELECTION_MESSAGE: str = (
    "━━━━━━━━━━━━━━━━━━\n"
    "🌐 *Select Language*\n"
    "━━━━━━━━━━━━━━━━━━\n\n"
    "Please select your preferred language:\n\n"
    "1️⃣ *English*\n"
    "2️⃣ *हिंदी*\n"
    "3️⃣ *मराठी*\n"
    "4️⃣ *ગુજરાતી*\n\n"
    "━━━━━━━━━━━━━━━━━━\n"
    "💬 *Reply with 1, 2, 3, or 4*\n"
    "━━━━━━━━━━━━━━━━━━"
)

# Authentication & Linking Messages (Single WhatsApp Messages)
LOCALIZED_LINKING_INSTRUCTIONS: dict = {
    "en": (
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
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *मेडीकियोस्क*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 मेडीकियोस्क में आपका स्वागत है!\n\n"
        "🔐 *आपका व्हाट्सएप अकाउंट अभी लिंक नहीं है।*\n\n"
        "आगे बढ़ने के लिए अपने व्हाट्सएप नंबर को अपने मेडीकियोस्क अकाउंट से लिंक करें।\n\n"
        "🌐 *लिंक कैसे करें:*\n\n"
        "1️⃣ मेडीकियोस्क वेबसाइट खोलें।\n"
        "2️⃣ अपने मेडीकियोस्क अकाउंट में लॉग इन करें।\n"
        "3️⃣ *व्हाट्सएप लिंक करें* पर जाएं।\n"
        "4️⃣ *व्हाट्सएप टोकन जेनरेट करें* पर क्लिक करें।\n"
        "5️⃣ जेनरेट किया गया टोकन कॉपी करें।\n"
        "6️⃣ वह टोकन यहाँ भेजें।\n\n"
        "🔑 *टोकन कहाँ मिलेगा?*\n"
        "वेबसाइट पर: *अकाउंट → व्हाट्सएप लिंक करें*\n\n"
        "⚠️ यह टोकन किसी के साथ साझा न करें।\n\n"
        "💬 टोकन भेजते ही आपका अकाउंट लिंक हो जाएगा।\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *मेडीकियोस्क*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 मेडीकियोस्क मध्ये आपले स्वागत आहे!\n\n"
        "🔐 *तुमचे व्हॉट्सॲप खाते अद्याप लिंक केलेले नाही.*\n\n"
        "पुढे जाण्यासाठी तुमचा व्हॉट्सॲप नंबर तुमच्या मेडीकियोस्क खात्याशी लिंक करा.\n\n"
        "🌐 *लिंक कसे करावे:*\n\n"
        "1️⃣ मेडीकियोस्क वेबसाइट उघडा.\n"
        "2️⃣ तुमच्या मेडीकियोस्क खात्यामध्ये लॉग इन करा.\n"
        "3️⃣ *व्हॉट्सॲप लिंक करा* वर जा.\n"
        "4️⃣ *व्हॉट्सॲप टोकन तयार करा* वर क्लिक करा.\n"
        "5️⃣ मिळालेला टोकन कॉपी करा.\n"
        "6️⃣ तो टोकन येथे पाठवा.\n\n"
        "🔑 *टोकन कुठे मिळेल?*\n"
        "वेबसाइटवर: *खाते → व्हॉट्सॲप लिंक करा*\n\n"
        "⚠️ हा टोकन कोणाशीही शेअर करू नका.\n\n"
        "💬 टोकन पाठवताच तुमचे खाते लिंक होईल.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *મેડીકિયોસ્ક*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 મેડીકિયોસ્કમાં આપનું સ્વાગત છે!\n\n"
        "🔐 *તમારું વ્હોટ્સએપ ખાતું હજી લિંક થયેલ નથી.*\n\n"
        "આગળ વધવા માટે તમારો વ્હોટ્સએપ નંબર મેડીકિયોસ્ક ખાતા સાથે લિંક કરો.\n\n"
        "🌐 *કેવી રીતે લિંક કરવું:*\n\n"
        "1️⃣ મેડીકિયોસ્ક વેબસાઇટ ખોલો.\n"
        "2️⃣ તમારા મેડીકિયોસ્ક એકાઉન્ટમાં લૉગ ઇન કરો.\n"
        "3️⃣ *લિંક વ્હોટ્સએપ* પર જાઓ.\n"
        "4️⃣ *વ્હોટ્સએપ ટોકન બનાવો* પર ક્લિક કરો.\n"
        "5️⃣ બનાવેલ ટોકન કૉપી કરો.\n"
        "6️⃣ તે ટોકન અહીં મોકલો.\n\n"
        "🔑 *ટોકન ક્યાં મળશે?*\n"
        "વેબસાઇટ પર: *એકાઉન્ટ → લિંક વ્હોટ્સએપ*\n\n"
        "⚠️ આ ટોકન કોઈની સાથે શેર કરશો નહીં.\n\n"
        "💬 ટોકન મોકલતા જ તમારું એકાઉન્ટ લિંક થઈ જશે.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
}
LINKING_INSTRUCTIONS_MESSAGE = LOCALIZED_LINKING_INSTRUCTIONS["en"]

LOCALIZED_INVALID_TOKEN: dict = {
    "en": (
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
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "❌ *टोकन अमान्य है*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "दर्ज किया गया टोकन सत्यापित नहीं हो सका।\n\n"
        "कृपया:\n\n"
        "1️⃣ मेडीकियोस्क वेबसाइट पर लॉग इन करें।\n"
        "2️⃣ *अकाउंट → व्हाट्सएप लिंक करें* खोलें।\n"
        "3️⃣ वैध टोकन कॉपी करके यहाँ भेजें।\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "❌ *टोकन अमान्य आहे*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "दाखल केलेला टोकन पडताळला गेला नाही.\n\n"
        "कृपया:\n\n"
        "1️⃣ मेडीकियोस्क वेबसाइटवर लॉग इन करा.\n"
        "2️⃣ *खाते → व्हॉट्सॲप लिंक करा* उघडा.\n"
        "3️⃣ वैध टोकन कॉपी करून येथे पाठवा.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "❌ *ટોકન અમાન્ય છે*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "દાખલ કરેલ ટોકન ચકાસી શકાયું નથી.\n\n"
        "કૃપા કરીને:\n\n"
        "1️⃣ મેડીકિયોસ્ક વેબસાઇટ પર લૉગ ઇન કરો.\n"
        "2️⃣ *એકાઉન્ટ → લિંક વ્હોટ્સએપ* ખોલો.\n"
        "3️⃣ માન્ય ટોકન કૉપી કરીને અહીં મોકલો.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
}
INVALID_TOKEN_MESSAGE = LOCALIZED_INVALID_TOKEN["en"]

def format_link_success_message(user_name: str = "", language: str = "en") -> str:
    """Formats the single WhatsApp confirmation message upon successful account linking."""
    name_clean = user_name.strip() if user_name else ""
    lang = (language or "en").lower()
    if lang == "hi":
        greeting = f"मेडीकियोस्क में आपका स्वागत है, *{name_clean}* 👋" if name_clean else "मेडीकियोस्क में आपका स्वागत है 👋"
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *व्हाट्सएप सफलतापूर्वक लिंक हो गया!*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"{greeting}\n\n"
            "आपका व्हाट्सएप अकाउंट अब आपके मेडीकियोस्क खाते से जुड़ गया है।\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    elif lang == "mr":
        greeting = f"मेडीकियोस्क मध्ये आपले स्वागत आहे, *{name_clean}* 👋" if name_clean else "मेडीकियोस्क मध्ये आपले स्वागत आहे 👋"
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *व्हॉट्सॲप यशस्वीरित्या लिंक झाले!*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"{greeting}\n\n"
            "तुमचे व्हॉट्सॲप खाते आता तुमच्या मेडीकियोस्क खात्याशी जोडले गेले आहे.\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    elif lang == "gu":
        greeting = f"મેડીકિયોસ્કમાં આપનું સ્વાગત છે, *{name_clean}* 👋" if name_clean else "મેડીકિયોસ્કમાં આપનું સ્વાગત છે 👋"
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *વ્હોટ્સએપ સફળતાપૂર્વક લિંક થયું!*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"{greeting}\n\n"
            "તમારું વ્હોટ્સએપ ખાતું હવે તમારા મેડીકિયોસ્ક ખાતા સાથે જોડાઈ ગયું છે.\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    greeting = f"Welcome to MediKiosk, *{name_clean}* 👋" if name_clean else "Welcome to MediKiosk 👋"
    return (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *WhatsApp Linked Successfully!*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"{greeting}\n\n"
        "Your WhatsApp account is now linked to your MediKiosk account.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    )

# Localized standard main menus
LOCALIZED_MENUS: dict = {
    "en": (
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
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *मेडीकियोस्क*\n"
        "🩺 *एआई स्वास्थ्य सहायक*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 *मेडीकियोस्क में आपका स्वागत है!*\n\n"
        "आज मैं आपकी क्या सहायता कर सकता हूँ?\n\n"
        "1️⃣ 🩺 *परामर्श शुरू करें*\n"
        "   अपना एआई-निर्देशित स्वास्थ्य परामर्श शुरू करें।\n\n"
        "2️⃣ 📄 *मेडिकल रिपोर्ट अपलोड करें*\n"
        "   अपने मेडिकल दस्तावेज़ जांचें और डिजिटल करें।\n\n"
        "3️⃣ 🚪 *बाहर निकलें*\n"
        "   बातचीत समाप्त करें।\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "💬 *1, 2 या 3 लिखकर उत्तर दें*\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *मेडीकियोस्क*\n"
        "🩺 *एआय आरोग्य सहाय्यक*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 *मेडीकियोस्क मध्ये आपले स्वागत आहे!*\n\n"
        "मी आज आपली काय मदत करू शकतो?\n\n"
        "1️⃣ 🩺 *सल्लामसलत सुरू करा*\n"
        "   तुमची एआय-मार्गदर्शित आरोग्य तपासणी सुरू करा।\n\n"
        "2️⃣ 📄 *वैद्यकीय अहवाल अपलोड करा*\n"
        "   तुमचे वैद्यकीय अहवाल तपासा आणि जतन करा।\n\n"
        "3️⃣ 🚪 *बाहेर पडा*\n"
        "   सत्र समाप्त करा।\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "💬 *1, 2 किंवा 3 पाठवून उत्तर द्या*\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "🏥 *મેડીકિયોસ્ક*\n"
        "🩺 *એઆઈ આરોગ્ય સહાયક*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "👋 *મેડીકિયોસ્કમાં આપનું સ્વાગત છે!*\n\n"
        "હું આજે આપની શું મદદ કરી શકું?\n\n"
        "1️⃣ 🩺 *પરામર્શ શરૂ કરો*\n"
        "   તમારી એઆઈ-માર્ગદર્શિત આરોગ્ય તપાસ શરૂ કરો.\n\n"
        "2️⃣ 📄 *મેડિકલ રિપોર્ટ અપલોડ કરો*\n"
        "   તમારા મેડિકલ દસ્તાવેજો ચકાસો અને ડિજિટાઈઝ કરો.\n\n"
        "3️⃣ 🚪 *બહાર નીકળો*\n"
        "   સત્ર પૂર્ણ કરો.\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "💬 *1, 2 અથવા 3 મોકલીને જવાબ આપો*\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
}
MENU_MESSAGE: str = LOCALIZED_MENUS["en"]
MENU_TEXT: str = MENU_MESSAGE

# Localized Chief Complaint Prompts
LOCALIZED_CHIEF_COMPLAINT_PROMPT: dict = {
    "en": (
        "🩺 *Let's begin your clinical assessment.*\n\n"
        "Please describe your main health concern or symptom.\n\n"
        '_Example: "I have had chest pain since this morning."_'
    ),
    "hi": (
        "🩺 *आइए आपका नैदानिक मूल्यांकन शुरू करें।*\n\n"
        "कृपया अपने मुख्य लक्षण या स्वास्थ्य समस्या का संक्षेप में वर्णन करें।\n\n"
        '_उदाहरण: "मुझे आज सुबह से सीने में दर्द हो रहा है।"_'
    ),
    "mr": (
        "🩺 *चला तुमची आरोग्य तपासणी सुरू करूया.*\n\n"
        "कृपया तुमच्या मुख्य त्रासाचे किंवा लक्षणांचे थोडक्यात वर्णन करा.\n\n"
        '_उदाहरण: "मला आज सकाळपासून छातीत दुखत आहे."_'
    ),
    "gu": (
        "🩺 *ચાલો તમારું આરોગ્ય મૂલ્યાંકન શરૂ કરીએ.*\n\n"
        "કૃપા કરીને તમારી મુખ્ય તકલીફ અથવા લક્ષણોનું ટૂંકમાં વર્ણન કરો.\n\n"
        '_ઉદાહરણ: "મને સવારથી છાતીમાં દુખાવો થાય છે."_'
    ),
}
CHIEF_COMPLAINT_PROMPT = LOCALIZED_CHIEF_COMPLAINT_PROMPT["en"]

# Localized Completion Messages
LOCALIZED_COMPLETION_MESSAGE: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *Clinical Assessment Complete*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Your assessment has been recorded successfully.\n\n"
        "🩺 Your physician-ready summary is now available in your MediKiosk account."
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *नैदानिक मूल्यांकन पूर्ण हुआ*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "आपका मूल्यांकन सफलतापूर्वक दर्ज कर लिया गया है।\n\n"
        "🩺 आपका डॉक्टर-तैयार सारांश अब आपके मेडीकियोस्क खाते में उपलब्ध है।"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *आरोग्य तपासणी पूर्ण झाली*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "तुमची तपासणी यशस्वीरित्या नोंदवली गेली आहे.\n\n"
        "🩺 तुमचा वैद्यकीय सारांश आता तुमच्या मेडीकियोस्क खात्यात उपलब्ध आहे."
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *આરોગ્ય મૂલ્યાંકન પૂર્ણ થયું*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "તમારું મૂલ્યાંકન સફળતાપૂર્વક રેકોર્ડ કરવામાં આવ્યું છે.\n\n"
        "🩺 તમારો મેડિકલ સારાંશ હવે તમારા મેડીકિયોસ્ક ખાતામાં ઉપલબ્ધ છે."
    ),
}
COMPLETION_MESSAGE = LOCALIZED_COMPLETION_MESSAGE["en"]

# Localized Exit Messages
LOCALIZED_EXIT_TEXT: dict = {
    "en": (
        "Thank you for using MediKiosk. 👋\n\n"
        'Send "hello medikiosk" anytime to start again.'
    ),
    "hi": (
        "मेडीकियोस्क का उपयोग करने के लिए धन्यवाद। 👋\n\n"
        'पुनः शुरू करने के लिए कभी भी "hello medikiosk" भेजें।'
    ),
    "mr": (
        "मेडीकियोस्क वापरल्याबद्दल धन्यवाद. 👋\n\n"
        'पुन्हा सुरू करण्यासाठी कधीही "hello medikiosk" पाठवा.'
    ),
    "gu": (
        "મેડીકિયોસ્કનો ઉપયોગ કરવા બદલ આભાર. 👋\n\n"
        'ફરી શરૂ કરવા માટે ગમે ત્યારે "hello medikiosk" મોકલો.'
    ),
}
EXIT_TEXT = LOCALIZED_EXIT_TEXT["en"]

# Localized Invalid Menu Messages
LOCALIZED_INVALID_MENU: dict = {
    "en": (
        "Please select a valid option:\n\n"
        "1️⃣ Start Consultation\n"
        "2️⃣ Upload Medical Report\n"
        "3️⃣ Exit"
    ),
    "hi": (
        "कृपया एक मान्य विकल्प चुनें:\n\n"
        "1️⃣ परामर्श शुरू करें\n"
        "2️⃣ मेडिकल रिपोर्ट अपलोड करें\n"
        "3️⃣ बाहर निकलें"
    ),
    "mr": (
        "कृपया एक योग्य पर्याय निवडा:\n\n"
        "1️⃣ सल्लामसलत सुरू करा\n"
        "2️⃣ वैद्यकीय अहवाल अपलोड करा\n"
        "3️⃣ बाहेर पडा"
    ),
    "gu": (
        "કૃપા કરીને માન્ય વિકલ્પ પસંદ કરો:\n\n"
        "1️⃣ પરામર્શ શરૂ કરો\n"
        "2️⃣ મેડિકલ રિપોર્ટ અપલોડ કરો\n"
        "3️⃣ બહાર નીકળો"
    ),
}
INVALID_MENU_TEXT = LOCALIZED_INVALID_MENU["en"]

# Localized Upload Report Messages
LOCALIZED_UPLOAD_REPORT: dict = {
    "en": (
        "📄 Medical report upload will be available soon.\n\n"
        "Please choose:\n"
        "1️⃣ Start Consultation\n"
        "2️⃣ Upload Medical Report\n"
        "3️⃣ Exit"
    ),
    "hi": (
        "📄 मेडिकल रिपोर्ट अपलोड जल्द ही उपलब्ध होगा।\n\n"
        "कृपया चुनें:\n"
        "1️⃣ परामर्श शुरू करें\n"
        "2️⃣ मेडिकल रिपोर्ट अपलोड करें\n"
        "3️⃣ बाहर निकलें"
    ),
    "mr": (
        "📄 वैद्यकीय अहवाल अपलोड लवकरच उपलब्ध होईल.\n\n"
        "कृपया निवडा:\n"
        "1️⃣ सल्लामसलत सुरू करा\n"
        "2️⃣ वैद्यकीय अहवाल अपलोड करा\n"
        "3️⃣ बाहेर पडा"
    ),
    "gu": (
        "📄 મેડિકલ રિપોર્ટ અપલોડ ટૂંક સમયમાં ઉપલબ્ધ થશે.\n\n"
        "કૃપા કરીને પસંદ કરો:\n"
        "1️⃣ પરામર્શ શરૂ કરો\n"
        "2️⃣ મેડિકલ રિપોર્ટ અપલોડ કરો\n"
        "3️⃣ બહાર નીકળો"
    ),
}
UPLOAD_REPORT_TEXT = LOCALIZED_UPLOAD_REPORT["en"]

# Localized Reset Messages
LOCALIZED_RESET_MESSAGE: dict = {
    "en": 'Session reset. Send "hello medikiosk" to begin a consultation.',
    "hi": 'सत्र रीसेट किया गया। परामर्श शुरू करने के लिए "hello medikiosk" भेजें।',
    "mr": 'सत्र रीसेट केले. सल्लामसलत सुरू करण्यासाठी "hello medikiosk" पाठवा.',
    "gu": 'સત્ર રીસેટ થયું. પરામર્શ શરૂ કરવા માટે "hello medikiosk" મોકલો.',
}

NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

LOCALIZED_RECOMMENDED_DOCTORS_HEADER: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *Recommended Doctors*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Based on your assessment, these doctors may be suitable for your case:\n\n"
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *अनुशंसित डॉक्टर*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "आपके मूल्यांकन के आधार पर, ये डॉक्टर आपके मामले के लिए उपयुक्त हो सकते हैं:\n\n"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *शिफारस केलेले डॉक्टर*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "तुमच्या तपासणीच्या आधारे, हे डॉक्टर तुमच्या उपचारासाठी योग्य असू शकतात:\n\n"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *ભલામણ કરેલ ડૉક્ટર્સ*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "તમારા મૂલ્યાંકનના આધારે, આ ડૉક્ટર્સ તમારા કેસ માટે યોગ્ય હોઈ શકે છે:\n\n"
    ),
}

LOCALIZED_NO_DOCTORS_FOUND: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *Doctor Recommendation*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "We couldn't find a suitable doctor for your assessment at the moment.\n\n"
        "Please try again later or use the MediKiosk doctor directory.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *डॉक्टर सिफारिश*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "फिलहाल आपके मूल्यांकन के लिए उपयुक्त डॉक्टर नहीं मिल सके।\n\n"
        "कृपया बाद में पुनः प्रयास करें या मेडीकियोस्क डॉक्टर डायरेक्टरी का उपयोग करें।\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *डॉक्टर शिफारस*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "सध्या तुमच्या तपासणीसाठी योग्य डॉक्टर सापडले नाहीत.\n\n"
        "कृपया नंतर पुन्हा प्रयत्न करा किंवा मेडीकियोस्क डॉक्टर डिरेक्टरी वापरा.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "👨‍⚕️ *ડૉક્ટર ભલામણ*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "હાલમાં તમારા મૂલ્યાંકન માટે યોગ્ય ડૉક્ટર મળી શક્યા નથી.\n\n"
        "કૃપા કરીને પછીથી ફરી પ્રયાસ કરો અથવા મેડીકિયોસ્ક ડૉક્ટર ડિરેક્ટરીનો ઉપયોગ કરો.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
}

LOCALIZED_AVAILABLE_APPOINTMENTS_HEADER: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *Available Appointments*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *उपलब्ध अपॉइंटमेंट्स*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *उपलब्ध अपॉइंटमेंट्स*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *ઉપલબ્ધ એપોઇન્ટમેન્ટ્સ*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
    ),
}

LOCALIZED_NO_SLOTS_AVAILABLE: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *No Slots Available*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "There are no appointment slots currently available for this doctor.\n\n"
        "Please select another doctor or check back later.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *कोई स्लॉट उपलब्ध नहीं है*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "इस डॉक्टर के लिए वर्तमान में कोई अपॉइंटमेंट स्लॉट उपलब्ध नहीं है।\n\n"
        "कृपया किसी अन्य डॉक्टर को चुनें या बाद में पुनः प्रयास करें।\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *कोणताही स्लॉट उपलब्ध नाही*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "या डॉक्टरांसाठी सध्या कोणताही स्लॉट उपलब्ध नाही.\n\n"
        "कृपया दुसरा डॉक्टर निवडा किंवा नंतर तपासा.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "📅 *કોઈ સ્લોટ ઉપલબ્ધ નથી*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "આ ડૉક્ટર માટે હાલમાં કોઈ એપોઇન્ટમેન્ટ સ્લોટ ઉપલબ્ધ નથી.\n\n"
        "કૃપા કરીને અન્ય ડૉક્ટર પસંદ કરો અથવા પછીથી તપાસો.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    ),
}

LOCALIZED_SLOT_CONFLICT: dict = {
    "en": (
        "━━━━━━━━━━━━━━━━━━\n"
        "⚠️ *Slot No Longer Available*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "That appointment slot is no longer available. Here are the latest available slots:\n\n"
    ),
    "hi": (
        "━━━━━━━━━━━━━━━━━━\n"
        "⚠️ *स्लॉट अब उपलब्ध नहीं है*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "वह अपॉइंटमेंट स्लॉट अब उपलब्ध नहीं है। यहाँ नवीनतम उपलब्ध स्लॉट हैं:\n\n"
    ),
    "mr": (
        "━━━━━━━━━━━━━━━━━━\n"
        "⚠️ *स्लॉट आता उपलब्ध नाही*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "तो अपॉइंटमेंट स्लॉट आता उपलब्ध नाही. येथे नवीनतम उपलब्ध स्लॉट आहेत:\n\n"
    ),
    "gu": (
        "━━━━━━━━━━━━━━━━━━\n"
        "⚠️ *સ્લોટ હવે ઉપલબ્ધ નથી*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "તે એપોઇન્ટમેન્ટ સ્લોટ હવે ઉપલબ્ધ નથી. અહીં નવીનતમ ઉપલબ્ધ સ્લોટ છે:\n\n"
    ),
}

def format_doctor_recommendations(doctors: list, language: str = "en") -> str:
    """Formats the single combined WhatsApp recommendation message with up to 5 doctors."""
    lang = (language or "en").lower().strip()
    if not doctors:
        return LOCALIZED_NO_DOCTORS_FOUND.get(lang, LOCALIZED_NO_DOCTORS_FOUND["en"])

    msg = LOCALIZED_RECOMMENDED_DOCTORS_HEADER.get(lang, LOCALIZED_RECOMMENDED_DOCTORS_HEADER["en"])
    for i, doc in enumerate(doctors):
        emoji = NUMBER_EMOJIS[i] if i < len(NUMBER_EMOJIS) else f"{i+1}️⃣"
        doc_name = doc.get("name") or f"Dr. {doc.get('firstName', '')} {doc.get('lastName', '')}".strip()
        spec = doc.get("specialization") or "General Medicine"
        msg += f"{emoji} *{doc_name}*\n   🩺 {spec}\n\n"

    count = len(doctors)
    if lang == "hi":
        msg += f"━━━━━━━━━━━━━━━━━━\n💬 *डॉक्टर चुनने के लिए 1–{count} लिखकर उत्तर दें।*\n━━━━━━━━━━━━━━━━━━"
    elif lang == "mr":
        msg += f"━━━━━━━━━━━━━━━━━━\n💬 *डॉक्टर निवडण्यासाठी 1–{count} पाठवून उत्तर द्या.*\n━━━━━━━━━━━━━━━━━━"
    elif lang == "gu":
        msg += f"━━━━━━━━━━━━━━━━━━\n💬 *ડૉક્ટર પસંદ કરવા માટે 1–{count} મોકલીને જવાબ આપો.*\n━━━━━━━━━━━━━━━━━━"
    else:
        msg += f"━━━━━━━━━━━━━━━━━━\n💬 *Reply with 1–{count} to select a doctor.*\n━━━━━━━━━━━━━━━━━━"

    return msg

def format_doctor_slots(doctor_name: str, slots: list, date_str: str = "", language: str = "en") -> str:
    """Formats the single WhatsApp message showing available slots for the selected doctor."""
    lang = (language or "en").lower().strip()
    if not slots:
        return LOCALIZED_NO_SLOTS_AVAILABLE.get(lang, LOCALIZED_NO_SLOTS_AVAILABLE["en"])

    header = LOCALIZED_AVAILABLE_APPOINTMENTS_HEADER.get(lang, LOCALIZED_AVAILABLE_APPOINTMENTS_HEADER["en"])
    msg = f"{header}*{doctor_name}*\n"
    if date_str:
        date_label = "दिनांक" if lang == "hi" else ("तारीख" if lang in ("mr", "gu") else "Date")
        msg += f"📅 {date_label}: {date_str}\n\n"
    else:
        msg += "\n"

    for i, slot in enumerate(slots):
        emoji = NUMBER_EMOJIS[i] if i < len(NUMBER_EMOJIS) else f"{i+1}️⃣"
        time_display = slot.get("time12") or slot.get("time") or "Available"
        msg += f"{emoji} {time_display}\n"

    count = len(slots)
    if lang == "hi":
        msg += f"\n━━━━━━━━━━━━━━━━━━\n💬 *स्लॉट चुनने के लिए 1–{count} लिखकर उत्तर दें।*\n━━━━━━━━━━━━━━━━━━"
    elif lang == "mr":
        msg += f"\n━━━━━━━━━━━━━━━━━━\n💬 *स्लॉट निवडण्यासाठी 1–{count} पाठवून उत्तर द्या.*\n━━━━━━━━━━━━━━━━━━"
    elif lang == "gu":
        msg += f"\n━━━━━━━━━━━━━━━━━━\n💬 *સ્લોટ પસંદ કરવા માટે 1–{count} મોકલીને જવાબ આપો.*\n━━━━━━━━━━━━━━━━━━"
    else:
        msg += f"\n━━━━━━━━━━━━━━━━━━\n💬 *Reply with 1–{count} to select a slot.*\n━━━━━━━━━━━━━━━━━━"

    return msg

def format_confirmation_message(doctor_name: str, specialization: str, date_str: str, time_str: str, language: str = "en") -> str:
    """Formats the final confirmed appointment message in user's language."""
    lang = (language or "en").lower().strip()
    if lang == "hi":
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *अपॉइंटमेंट की पुष्टि हो गई*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"👨‍⚕️ *डॉक्टर:*\n{doctor_name}\n\n"
            f"🩺 *विशेषज्ञता:*\n{specialization}\n\n"
            f"📅 *दिनांक:*\n{date_str}\n\n"
            f"🕐 *समय:*\n{time_str}\n\n"
            "आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है।\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    elif lang == "mr":
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *अपॉइंटमेंट निश्चित झाली*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"👨‍⚕️ *डॉक्टर:*\n{doctor_name}\n\n"
            f"🩺 *विशेषज्ञता:*\n{specialization}\n\n"
            f"📅 *तारीख:*\n{date_str}\n\n"
            f"🕐 *वेळ:*\n{time_str}\n\n"
            "तुमची अपॉइंटमेंट यशस्वीरित्या बुक झाली आहे.\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    elif lang == "gu":
        return (
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ *એપોઇન્ટમેન્ટ કન્ફર્મ થઈ*\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            f"👨‍⚕️ *ડૉક્ટર:*\n{doctor_name}\n\n"
            f"🩺 *વિશેષતા:*\n{specialization}\n\n"
            f"📅 *તારીખ:*\n{date_str}\n\n"
            f"🕐 *સમય:*\n{time_str}\n\n"
            "તમારી એપોઇન્ટમેન્ટ સફળતાપૂર્વક બુક થઈ ગઈ છે.\n\n"
            "━━━━━━━━━━━━━━━━━━"
        )
    return (
        "━━━━━━━━━━━━━━━━━━\n"
        "✅ *Appointment Confirmed*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"👨‍⚕️ *Doctor:*\n{doctor_name}\n\n"
        f"🩺 *Specialization:*\n{specialization}\n\n"
        f"📅 *Date:*\n{date_str}\n\n"
        f"🕐 *Time:*\n{time_str}\n\n"
        "Your appointment has been booked successfully.\n\n"
        "━━━━━━━━━━━━━━━━━━"
    )

def format_invalid_doctor_choice(count: int, language: str = "en") -> str:
    lang = (language or "en").lower().strip()
    if lang == "hi":
        return f"कृपया एक मान्य डॉक्टर संख्या (1–{count}) दर्ज करें।"
    elif lang == "mr":
        return f"कृपया योग्य डॉक्टर क्रमांक (1–{count}) पाठवा."
    elif lang == "gu":
        return f"કૃપા કરીને માન્ય ડૉક્ટર નંબર (1–{count}) મોકલો."
    return f"Please reply with a valid doctor number (1–{count})."

def format_invalid_slot_choice(count: int, language: str = "en") -> str:
    lang = (language or "en").lower().strip()
    if lang == "hi":
        return f"कृपया एक मान्य स्लॉट संख्या (1–{count}) दर्ज करें।"
    elif lang == "mr":
        return f"कृपया योग्य स्लॉट क्रमांक (1–{count}) पाठवा."
    elif lang == "gu":
        return f"કૃપા કરીને માન્ય સ્લોટ નંબર (1–{count}) મોકલો."
    return f"Please reply with a valid slot number (1–{count})."

def get_localized_message(catalog: dict, language: str = "en", default: str = "") -> str:
    """Retrieves a message from a dictionary by language with English fallback."""
    lang = (language or "en").lower().strip()
    return catalog.get(lang, catalog.get("en", default))


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

