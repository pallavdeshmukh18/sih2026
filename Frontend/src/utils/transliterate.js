// Indic phonetic transliteration and doctor name localization utility

export const DOCTOR_PREFIX_MAP = {
  en: "Dr.",
  hi: "डॉ.",
  mr: "डॉ.",
  gu: "ડૉ.",
  bn: "ডা.",
  as: "ডা.",
  ta: "டாக்டர்.",
  te: "డా.",
  kn: "ಡಾ.",
  ml: "ഡോ.",
  pa: "ਡਾ.",
  or: "ଡା.",
};

// Curated high-accuracy dictionary for common names, surnames, and test profiles
export const NAME_DICTIONARY = {
  // First names
  anuj: { hi: "अनुज", mr: "अनुज", gu: "અનુજ", bn: "অনুজ", as: "অনুজ", ta: "அனுஜ்", te: "అనుజ్", kn: "ಅನುಜ್", ml: "അനുജ്", pa: "ਅਨੁਜ", or: "ଅନୁଜ" },
  anil: { hi: "अनिल", mr: "अनिल", gu: "અનિલ", bn: "অনিল", as: "অনিল", ta: "அனில்", te: "అనిల్", kn: "ಅನಿಲ್", ml: "അനിൽ", pa: "ਅਨਿਲ", or: "ଅନିଲ" },
  vikram: { hi: "विक्रम", mr: "विक्रम", gu: "વિક્રમ", bn: "বিক্রম", as: "বিক্ৰম", ta: "விக்ரம்", te: "విక్రమ్", kn: "ವಿಕ್ರಮ್", ml: "വിക്രം", pa: "ਵਿਕਰਮ", or: "ବିକ୍ରମ" },
  nisarg: { hi: "निसर्ग", mr: "निसर्ग", gu: "નિસર્ગ", bn: "নিসর্গ", as: "নিসৰ্গ", ta: "நிசர்க்", te: "నిసర్గ", kn: "ನಿಸರ್ಗ", ml: "നിസർഗ്", pa: "ਨਿਸਰਗ", or: "ନିସର୍ଗ" },
  anand: { hi: "आनंद", mr: "आनंद", gu: "આનંદ", bn: "আনন্দ", as: "আনন্দ", ta: "ஆனந்த்", te: "ఆనంద్", kn: "ಆನಂದ್", ml: "ആനന്ദ്", pa: "ਆਨੰਦ", or: "ଆନନ୍ଦ" },
  rajesh: { hi: "राजेश", mr: "राजेश", gu: "રાજેશ", bn: "রাজেশ", as: "ৰাজেশ", ta: "ராஜேஷ்", te: "రాజేష్", kn: "ರಾಜೇಶ್", ml: "രാജേഷ്", pa: "ਰਾਜੇਸ਼", or: "ରାଜେଶ" },
  ananya: { hi: "अनन्या", mr: "अनन्या", gu: "અનન્યા", bn: "অনন্যা", as: "অনন্যা", ta: "அனன்யா", te: "అనన్య", kn: "ಅನನ್ಯಾ", ml: "അനന്യ", pa: "ਅਨੰਨਿਆ", or: "ଅନନ୍ୟା" },
  rohan: { hi: "रोहन", mr: "रोहन", gu: "રોહન", bn: "রোহন", as: "ৰোহন", ta: "ரோஹன்", te: "రోహన్", kn: "ರೋಹನ್", ml: "രോഹൻ", pa: "ਰੋਹਨ", or: "ରୋਹନ" },
  sneha: { hi: "स्नेहा", mr: "स्नेहा", gu: "સ્નેહા", bn: "স্নেহা", as: "স্નેহা", ta: "சினேகா", te: "స్నేహా", kn: "ಸ್ನೇಹಾ", ml: "സ്നേഹ", pa: "ਸਨੇਹਾ", or: "ସ୍ନେହା" },
  sarah: { hi: "सारा", mr: "सारा", gu: "સારા", bn: "সারা", as: "ছাৰা", ta: "சாரா", te: "సారా", kn: "ಸಾರಾ", ml: "സാറ", pa: "ਸਾਰਾ", or: "ସାରା" },
  robert: { hi: "रॉबर्ट", mr: "रॉबर्ट", gu: "રોબર્ટ", bn: "রবার্ট", as: "ৰবাৰ্ট", ta: "ராபர்ட்", te: "రాబర్ట్", kn: "ರಾಬರ್ಟ್", ml: "റോബർട്ട്", pa: "ਰਾਬਰਟ", or: "ରବର୍ଟ" },
  emily: { hi: "एमिली", mr: "एमिली", gu: "એમિલી", bn: "এমিলি", as: "এমিলি", ta: "எமிலி", te: "ఎమిలీ", kn: "ಎಮಿಲಿ", ml: "എമിലി", pa: "ਐਮਿਲੀ", or: "ଏମିଲି" },
  priya: { hi: "प्रिया", mr: "प्रिया", gu: "પ્રિયા", bn: "প্রিয়া", as: "প্ৰিয়া", ta: "பிரியா", te: "ప్రియా", kn: "ಪ್ರಿಯಾ", ml: "പ്രിയ", pa: "ਪ੍ਰਿਆ", or: "ପ୍ରିୟା" },
  rahul: { hi: "राहुल", mr: "राहुल", gu: "રાહુલ", bn: "রাহুল", as: "ৰাহুল", ta: "ராகுல்", te: "రాహుల్", kn: "ರಾಹುಲ್", ml: "രാഹുൽ", pa: "ਰਾਹੁਲ", or: "ରାਹੁਲ" },
  amit: { hi: "अमित", mr: "अमित", gu: "અમિત", bn: "অমিত", as: "অমিত", ta: "அமித்", te: "అమిத்", kn: "ಅಮಿತ್", ml: "അമിത്", pa: "ਅਮਿਤ", or: "ଅਮਿਤ" },
  pooja: { hi: "पूजा", mr: "पूजा", gu: "પૂજા", bn: "পূজা", as: "পূজা", ta: "பூஜா", te: "పూజా", kn: "ಪೂಜಾ", ml: "പൂജ", pa: "ਪੂਜਾ", or: "ପୂଜା" },
  suresh: { hi: "सुरेश", mr: "सुरेश", gu: "સુરેશ", bn: "সুরেশ", as: "সুৰেশ", ta: "சுரேஷ்", te: "சுரேஷ்", kn: "ಸುರೇಶ್", ml: "സുരേഷ്", pa: "ਸੁਰੇਸ਼", or: "ସୁରେଶ" },
  kavita: { hi: "कविता", mr: "कविता", gu: "કવિતા", bn: "কবিতা", as: "কবিতা", ta: "கவிதா", te: "కవిత", kn: "ಕವಿತಾ", ml: "കവിത", pa: "ਕਵਿਤਾ", or: "କବିତା" },
  deepak: { hi: "दीपक", mr: "दीपक", gu: "દીપક", bn: "দীপক", as: "দীপক", ta: "தீபக்", te: "దీపక్", kn: "ದೀಪಕ್", ml: "ദീപക്", pa: "ਦੀਪਕ", or: "ଦୀପକ" },
  pallav: { hi: "पल्लव", mr: "पल्लव", gu: "પલ્લવ", bn: "পল্লব", as: "পল্লব", ta: "பல்லவ்", te: "பல்லவ்", kn: "ಪಲ್ಲವ್", ml: "പല്ലവ്", pa: "ਪੱਲਵ", or: "ପଲ୍ଲବ" },
  shubh: { hi: "शुभ", mr: "शुभ", gu: "શુભ", bn: "শুভ", as: "শুভ", ta: "சுப்", te: "శుభ్", kn: "ಶುಭ್", ml: "ശുഭ്", pa: "ਸ਼ੁਭ", or: "ଶୁଭ" },
  super: { hi: "सुपर", mr: "सुपर", gu: "સુપર", bn: "সুপার", as: "সুপাৰ", ta: "சூப்பர்", te: "సూపర్", kn: "ಸೂಪರ್", ml: "സൂപ്പർ", pa: "ਸੁਪਰ", or: "ସୁਪର" },
  doctor: { hi: "डॉक्टर", mr: "डॉक्टर", gu: "ડૉક્ટર", bn: "ডাক্তার", as: "ডাক্তাৰ", ta: "டாக்டர்", te: "డాక్టర్", kn: "ಡಾಕ್ಟರ್", ml: "ഡോക്ടർ", pa: "ਡਾਕਟਰ", or: "ଡାക്ടર" },

  // Surnames
  ghugarkar: { hi: "घुगरकर", mr: "घुगरकर", gu: "ઘુગરકર", bn: "ঘুগরকর", as: "ঘুঘৰকৰ", ta: "குகர்கர்", te: "ఘుగర్కర్", kn: "ಘುಗರ್ಕರ್", ml: "ഘുഗർക്കർ", pa: "ਘੁਗਰਕਰ", or: "ଘୁଗରକର" },
  verma: { hi: "वर्मा", mr: "वर्मा", gu: "વર્મા", bn: "বর্মা", as: "বৰ্মা", ta: "வர்மா", te: "వర్మ", kn: "ವರ್ಮಾ", ml: "വർമ്മ", pa: "ਵਰਮਾ", or: "ବର୍ମା" },
  mehta: { hi: "मेहता", mr: "मेहता", gu: "મહેતા", bn: "মেহতা", as: "মেহতা", ta: "மேத்தா", te: "మెహతా", kn: "ಮೆಹ್ತಾ", ml: "മേത്ത", pa: "ਮਹਿਤਾ", or: "ମେହେତା" },
  sharma: { hi: "शर्मा", mr: "शर्मा", gu: "શર્મા", bn: "શર્মা", as: "শৰ্মা", ta: "சர்மா", te: "శర్మ", kn: "ಶರ್ಮಾ", ml: "ശർമ്മ", pa: "ਸ਼ਰਮਾ", or: "ଶର୍ମା" },
  kulkarni: { hi: "कुलकर्णी", mr: "कुलकर्णी", gu: "કુલકર્ણી", bn: "কুলকার্নি", as: "কুলকাৰ্ণী", ta: "குல்கர்னி", te: "కులకర్ణి", kn: "ಕುಲಕರ್ಣಿ", ml: "കുൽക്കർണി", pa: "ਕੁਲਕਰਨੀ", or: "କୁଲକର୍ଣ୍ଣୀ" },
  jenkins: { hi: "जेनकिन्स", mr: "जेनकिन्स", gu: "જેનકિન્સ", bn: "জেনকিন্স", as: "জেনকিন্স", ta: "ஜென்கின்ஸ்", te: "జెంకిన్స్", kn: "ಜೆನ್ಕಿನ್ಸ್", ml: "ജൻകിൻസ്", pa: "ਜੇਨਕਿਨਸ", or: "ଜେନକିନ୍ସ" },
  miles: { hi: "माइल्स", mr: "माइल्स", gu: "માઇલ્સ", bn: "মাইলস", as: "মাইলছ", ta: "மைல்ஸ்", te: "మైల్స్", kn: "ಮೈಲ್ಸ್", ml: "മൈൽസ്", pa: "ਮਾਈਲਸ", or: "ମାଇଲ୍ସ" },
  chen: { hi: "चेन", mr: "चेन", gu: "ચેન", bn: "চেন", as: "চেন", ta: "சென்", te: "చెన్", kn: "ಚೆನ್", ml: "ചെൻ", pa: "ਚੇਨ", or: "ਚੇਨ" },
  patel: { hi: "पटेल", mr: "पटेल", gu: "પટેલ", bn: "প্যাটেল", as: "পেটেল", ta: "படேல்", te: "పటేಲ್", kn: "ಪಟೇಲ್", ml: "പട്ടേൽ", pa: "ਪਟੇਲ", or: "ପଟେਲ" },
  joshi: { hi: "जोशी", mr: "जोशी", gu: "જોશી", bn: "যোশী", as: "যোশী", ta: "ஜோஷி", te: "జోషి", kn: "ಜೋಶಿ", ml: "ജോഷി", pa: "ਜੋਸ਼ੀ", or: "ଯୋଶୀ" },
  gupta: { hi: "गुप्ता", mr: "गुप्ता", gu: "ગુપ્તા", bn: "গুপ্তা", as: "গুপ্তা", ta: "குப்தா", te: "గుప్తా", kn: "ಗುಪ್ತಾ", ml: "ഗുപ്ത", pa: "ਗੁਪਤਾ", or: "ଗୁପ୍ତା" },
  shah: { hi: "शाह", mr: "शाह", gu: "શાહ", bn: "শাহ", as: "শ্বাহ", ta: "ஷா", te: "షా", kn: "ಶಾ", ml: "ഷാ", pa: "ਸ਼ਾਹ", or: "ଶାਹ" },
  deshmukh: { hi: "देशमुख", mr: "देशमुख", gu: "દેશમુખ", bn: "দেশমুখ", as: "দেশমুখ", ta: "தேஷ்முக்", te: "దేశ్‌ముఖ్", kn: "ದೇಶ್‌ಮುಖ್", ml: "ദേശ്മുഖ്", pa: "ਦੇਸ਼ਮੁਖ", or: "ଦେଶମୁଖ" },
  kumar: { hi: "कुमार", mr: "कुमार", gu: "કુમાર", bn: "কুমার", as: "কুমাৰ", ta: "குமார்", te: "కుమార్", kn: "ಕುಮಾರ್", ml: "കുമാർ", pa: "ਕੁਮਾਰ", or: "କୁମାର" },
  singh: { hi: "सिंह", mr: "सिंह", gu: "સિંહ", bn: "সিংহ", as: "সিংহ", ta: "சிங்", te: "సింగ్", kn: "ಸಿಂಗ್", ml: "സിംഗ്", pa: "ਸਿੰਘ", or: "ସିଂହ" },
  nair: { hi: "नायर", mr: "नायर", gu: "નાયર", bn: "নায়ার", as: "নায়াৰ", ta: "நாயர்", te: "నాయర్", kn: "ನಾಯರ್", ml: "നായർ", pa: "ਨਾਇਰ", or: "ନାୟାର" },
  rao: { hi: "राव", mr: "राव", gu: "રાવ", bn: "রাও", as: "ৰাও", ta: "ராவ்", te: "రావు", kn: "ರಾವ್", ml: "റാവു", pa: "ਰਾਓ", or: "ରାଓ" },
  reddy: { hi: "रेड्डी", mr: "रेड्डी", gu: "રેડ્ડી", bn: "রেড্ডি", as: "ৰেড্ডী", ta: "ரெட்டி", te: "రెడ్డి", kn: "ರೆಡ್ಡಿ", ml: "റെഡ്ഡി", pa: "ਰੇੱਡੀ", or: "ରେଡ୍ଡୀ" },
  iyer: { hi: "अय्यर", mr: "अय्यर", gu: "ઐય્યર", bn: "আইয়ার", as: "আয়াৰ", ta: "ஐயர்", te: "அய்யర్", kn: "ಅಯ್ಯರ್", ml: "അയ്യർ", pa: "ਅਈਅਰ", or: "ଆୟାର" },
};

// Character mappings for generic transliteration to Devanagari (Hindi, Marathi)
const DEV_CONSONANTS = {
  k: "क", kh: "ख", g: "ग", gh: "घ",
  ch: "च", chh: "छ", j: "ज", jh: "झ",
  t: "त", th: "थ", d: "द", dh: "ध", n: "न",
  p: "प", ph: "फ", f: "फ", b: "ब", bh: "भ", m: "म",
  y: "य", r: "र", l: "ल", v: "व", w: "व",
  sh: "श", s: "स", h: "ह",
};

const DEV_VOWELS = {
  a: "", aa: "ा", i: "ि", ee: "ी", u: "ु", oo: "ू", e: "े", ai: "ै", o: "ो", au: "ौ",
};

const DEV_INITIAL_VOWELS = {
  a: "अ", aa: "आ", i: "इ", ee: "ई", u: "उ", oo: "ऊ", e: "ए", ai: "ऐ", o: "ओ", au: "औ",
};

// Simple rule-based transliteration to Devanagari for unlisted words
function toDevanagari(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return word;

  let result = "";
  let i = 0;

  // Check initial vowel
  if (/^[aeiou]/.test(clean[0])) {
    if (clean.startsWith("aa")) { result += DEV_INITIAL_VOWELS.aa; i += 2; }
    else if (clean.startsWith("ee")) { result += DEV_INITIAL_VOWELS.ee; i += 2; }
    else if (clean.startsWith("oo")) { result += DEV_INITIAL_VOWELS.oo; i += 2; }
    else if (clean.startsWith("ai")) { result += DEV_INITIAL_VOWELS.ai; i += 2; }
    else if (clean.startsWith("au")) { result += DEV_INITIAL_VOWELS.au; i += 2; }
    else { result += DEV_INITIAL_VOWELS[clean[0]] || ""; i += 1; }
  }

  while (i < clean.length) {
    // Try 3-char consonant
    const c3 = clean.substring(i, i + 3);
    const c2 = clean.substring(i, i + 2);
    const c1 = clean.substring(i, i + 1);

    let cons = "";
    let skip = 0;

    if (DEV_CONSONANTS[c3]) {
      cons = DEV_CONSONANTS[c3];
      skip = 3;
    } else if (DEV_CONSONANTS[c2]) {
      cons = DEV_CONSONANTS[c2];
      skip = 2;
    } else if (DEV_CONSONANTS[c1]) {
      cons = DEV_CONSONANTS[c1];
      skip = 1;
    }

    if (cons) {
      result += cons;
      i += skip;

      // Check following vowel
      const v2 = clean.substring(i, i + 2);
      const v1 = clean.substring(i, i + 1);

      if (DEV_VOWELS[v2] !== undefined) {
        result += DEV_VOWELS[v2];
        i += 2;
      } else if (DEV_VOWELS[v1] !== undefined) {
        result += DEV_VOWELS[v1];
        i += 1;
      } else if (i < clean.length && DEV_CONSONANTS[clean[i]]) {
        // Consonant cluster -> halant
        result += "्";
      }
    } else {
      // Vowel without consonant
      if (clean.startsWith("aa", i)) { result += DEV_VOWELS.aa; i += 2; }
      else if (clean.startsWith("ee", i)) { result += DEV_VOWELS.ee; i += 2; }
      else if (clean.startsWith("oo", i)) { result += DEV_VOWELS.oo; i += 2; }
      else if (clean.startsWith("ai", i)) { result += DEV_VOWELS.ai; i += 2; }
      else if (clean.startsWith("au", i)) { result += DEV_VOWELS.au; i += 2; }
      else if (clean[i] === "a") { i += 1; }
      else if (clean[i] === "i") { result += DEV_VOWELS.i; i += 1; }
      else if (clean[i] === "u") { result += DEV_VOWELS.u; i += 1; }
      else if (clean[i] === "e") { result += DEV_VOWELS.e; i += 1; }
      else if (clean[i] === "o") { result += DEV_VOWELS.o; i += 1; }
      else { i += 1; }
    }
  }

  return result || word;
}

/**
 * Transliterate a single word (first name or surname)
 */
export function transliterateWord(word, lang = "en") {
  if (!word || !lang || lang === "en") return word;

  const key = word.trim().toLowerCase();
  const dictEntry = NAME_DICTIONARY[key];
  if (dictEntry && dictEntry[lang]) {
    return dictEntry[lang];
  }

  // If Devanagari-based language (hi, mr)
  if (lang === "hi" || lang === "mr") {
    return toDevanagari(word);
  }

  // Fallback to Hindi dictionary entry if available for Indic similarity
  if (dictEntry && dictEntry.hi) {
    return dictEntry.hi;
  }

  return word;
}

/**
 * Transliterate a full name (e.g. "Anuj", "Anil Verma", "Dr. Vikram Mehta")
 */
export function transliterateName(fullName, lang = "en") {
  if (!fullName || !lang || lang === "en") return fullName || "";

  const trimmed = fullName.trim();
  const hasDoctorTitle = /^(?:dr\.?\s*)+/i.test(trimmed);
  const cleanName = trimmed.replace(/^(?:dr\.?\s*)+/i, "").trim();

  const words = cleanName.split(/\s+/);
  const transliteratedWords = words.map((w) => transliterateWord(w, lang));
  const localizedName = transliteratedWords.join(" ");

  if (hasDoctorTitle) {
    const prefix = DOCTOR_PREFIX_MAP[lang] || "Dr.";
    return `${prefix} ${localizedName}`;
  }

  return localizedName;
}

/**
 * Format a doctor's name from either an object ({ firstName, lastName, name })
 * or string, localized to the target language.
 */
export function formatDoctorName(doctor, lang = "en") {
  if (!doctor) return lang === "en" ? "Dr. Doctor" : `${DOCTOR_PREFIX_MAP[lang] || "Dr."} डॉक्टर`;

  let rawName = "";
  if (typeof doctor === "string") {
    rawName = doctor;
  } else {
    rawName = doctor.name || [doctor.firstName, doctor.lastName].filter(Boolean).join(" ");
  }

  const nameWithoutTitle = (rawName || "").replace(/^(?:dr\.?\s*)+/i, "").trim() || "Doctor";
  const prefix = DOCTOR_PREFIX_MAP[lang] || "Dr.";

  if (!lang || lang === "en") {
    return `Dr. ${nameWithoutTitle}`;
  }

  const localizedName = transliterateName(nameWithoutTitle, lang);
  return `${prefix} ${localizedName}`;
}

export const CLINICAL_TRANSLATIONS = {
  specializations: {
    "cardiology": {
      hi: "हृदय रोग विज्ञान", mr: "हृदयविकार शास्त्र", kn: "ಕಾರ್ಡಿಯಾಲಜಿ", gu: "કાર્ડિયોલોજી", ta: "இதயவியல்", te: "కార్డియాలజీ", bn: "কার্ডিওলজি", ml: "കാർഡിയോളജി", pa: "ਕਾਰਡੀਓਲੌਜੀ", or: "କାର୍ଡିଓଲୋଜି", as: "কাৰ্ডিঅ'লজি"
    },
    "cardiology follow-up": {
      hi: "हृदय रोग फॉलो-अप", mr: "हृदयविकार फॉलो-अप", kn: "ಕಾರ್ಡಿಯಾಲಜಿ ಫಾಲೋ-ಅಪ್", gu: "કાર્ડિયોલોજી ફોલો-અપ", ta: "இதயவியல் பின்தொடர்தல்", te: "కార్డియాలజీ ఫాలో-అప్", bn: "কার্ডিওলজি ফলো-আপ", ml: "കാർഡിയോളജി ഫോളോ-അപ്പ്", pa: "ਕਾਰਡੀਓਲੋਜੀ ਫਾਲੋ-ਅੱਪ", or: "କାର୍ଡିଓଲୋଜି ଫଲୋ-ଅପ୍", as: "কাৰ্ডিঅ'লজি ফলো-আপ"
    },
        "dental": {
      hi: "दंत चिकित्सा", mr: "दंत चिकित्सा", kn: "ದಂತ ಚಿಕಿತ್ಸೆ", gu: "દાંતની સારવાર", ta: "பல் மருத்துவம்", te: "దంత వైద్యం", bn: "দন্ত চিকিৎসা", ml: "ദന്തചികിത്സ", pa: "ਦੰਦਾਂ ਦਾ ਇਲਾਜ", or: "ଦନ୍ତ ଚିକିତ୍ସା", as: "দন্ত চিকিৎসা"
    },
    "dental consultation": {
      hi: "दंत चिकित्सा परामर्श", mr: "दंत चिकित्सा सल्ला", kn: "ದಂತ ಸಮಾಲೋಚನೆ", gu: "દાંતની તપાસ", ta: "பல் மருத்துவ ஆலோசனை", te: "దంత సంప్రదింపులు", bn: "দাঁতের পরামর্শ", ml: "ദന്ത പരിശോധന", pa: "ਦੰਦਾਂ ਦੀ ਜਾਂਚ", or: "ଦନ୍ତ ପରାମର୍ଶ", as: "দন্ত পৰামৰ্শ"
    },
    "general consultation": {
      hi: "सामान्य परामर्श", mr: "सामान्य सल्ला", kn: "ಸಾಮಾನ್ಯ ಸಮಾಲೋಚನೆ", gu: "સામાન્ય પરામર્શ", ta: "பொது ஆலோசனை", te: "సాధారణ సంప్రదింపులు", bn: "সাধারণ পরামর্শ", ml: "പൊതു പരിശോധന", pa: "ਆਮ ਸਲਾਹ", or: "ସାଧାରଣ ପରାମର୍ଶ", as: "সাধাৰণ পৰামৰ্শ"
    },
    "general physician": {
      hi: "सामान्य चिकित्सक", mr: "जनरल फिजिशियन", kn: "ಜನರಲ್ ಫಿಜಿಶಿಯನ್", gu: "જનરલ ફિઝિશિયન", ta: "பொது மருத்துவர்", te: "జనరల్ ఫిజీషియన్", bn: "জেনারেল ফিজিশিয়ান", ml: "ജനറൽ ഫിസിഷ്യൻ", pa: "ਜਨਰਲ ਫਿਜ਼ੀਸ਼ੀਅਨ", or: "ଜେନେରାଲ ଫିଜିସିଆନ୍", as: "সাধাৰণ চিকিৎসক"
    },
    "general medicine": {
      hi: "जनरल मेडिसिन", mr: "जनरल मेडिसिन", kn: "ಜನರಲ್ ಮೆಡಿಸಿನ್", gu: "જનરલ મેડિસિન", ta: "பொது மருத்துவம்", te: "జనరల్ మెడిసిన్", bn: "জেনারেল মেডিসিন", ml: "ജനറൽ മെഡിസിൻ", pa: "ਜਨਰਲ ਮੈਡੀਸਨ", or: "ଜେନେରାଲ ମେଡିସିନ୍", as: "সাধাৰণ ঔষধ"
    },
    "dermatology": {
      hi: "त्वचा रोग विज्ञान", mr: "त्वचारोग शास्त्र", kn: "ಡರ್ಮಟಾಲಜಿ", gu: "ડર્માટોલોજી", ta: "தோல் மருத்துவம்", te: "డెర్మటాలజీ", bn: "ডার্মাটোলজি", ml: "ഡെർമറ്റോളജി", pa: "ਚਮੜੀ ਰੋਗ", or: "ଚର୍ମରୋଗ", as: "চৰ্মৰোগ"
    },
    "pediatrics": {
      hi: "बाल रोग विज्ञान", mr: "बालरोग शास्त्र", kn: "ಪೀಡಿಯಾಟ್ರಿಕ್ಸ್", gu: "પીડિયાટ્રિક્સ", ta: "குழந்தை நலம்", te: "పీడియాట్రిక్స్", bn: "পেডিয়াট্রিক্স", ml: "പീഡിയാട്രിക്സ്", pa: "ਬਾਲ ਰੋਗ", or: "ଶିଶୁରୋଗ", as: "শিশুৰোগ"
    },
    "gynecology": {
      hi: "स्त्री रोग विज्ञान", mr: "स्त्रीरोग शास्त्र", kn: "ಸ್ತ್ರೀರೋಗ ಶಾಸ್ತ್ರ", gu: "સ્ત્રીરોગ વિજ્ઞાન", ta: "மகளிர் மருத்துவம்", te: "గైనకాలజీ", bn: "গাইনোকোলজি", ml: "ഗൈനക്കോളജി", pa: "ਇਸਤਰੀ ਰੋਗ", or: "ସ୍ତ୍ରୀରୋଗ", as: "স্ত্ৰীৰোগ"
    },
    "orthopedics": {
      hi: "हड्डी रोग विज्ञान", mr: "अस्थिरोग शास्त्र", kn: "ಆರ್ಥೋಪೆಡಿಕ್ಸ್", gu: "ઓર્થોપેડિક્સ", ta: "எலும்பியல்", te: "ఆర్థోపెడిక్స్", bn: "অর্থোপেডিকস", ml: "ഓർത്തോപീഡിക്സ്", pa: "ਹੱਡੀ ਰੋਗ", or: "ଅସ୍ଥିରୋଗ", as: "অস্থিৰোগ"
    },
    "neurology": {
      hi: "तंत्रिका विज्ञान", mr: "न्यूरोलॉजी", kn: "ನರವಿಜ್ಞಾನ", gu: "ન્યુરોલોજી", ta: "நரம்பியல்", te: "న్యూరాలజీ", bn: "নিউরোলজি", ml: "ന്യൂറോളജി", pa: "ਨਿਊਰੋਲੋਜੀ", or: "ସ୍ନାୟୁରୋଗ", as: "স্নায়ুৰোগ"
    },
    "horn": {
      hi: "ईएनटी विशेषज्ञ (ENT)", mr: "ईएनटी तज्ज्ञ (ENT)", kn: "ಇಎನ್‌ಟಿ ತಜ್ಞರು (ENT)", gu: "ઇએનટી નિષ્ણાત", ta: "காது மூக்கு தொண்டை நிபுணர்", te: "ఇఎన్‌టి స్పెషలిస్ట్", bn: "ইএনটি বিশেষজ্ঞ", ml: "ഇ.എൻ.ടി സ്പെഷ്യലിസ്റ്റ്", pa: "ਈਐਨਟੀ ਮਾਹਿਰ", or: "ଇଏନଟି ବିଶେଷଜ୍ଞ", as: "ইএনটি বিশেষজ্ঞ"
    },
    "ent": {
      hi: "ईएनटी विशेषज्ञ (ENT)", mr: "ईएनटी तज्ज्ञ (ENT)", kn: "ಇಎನ್‌ಟಿ ತಜ್ಞರು (ENT)", gu: "ઇએનટી નિષ્ણાત", ta: "காது மூக்கு தொண்டை நிபுணர்", te: "ఇఎన్‌టి స్పెషలిస్ట్", bn: "ইএনটি বিশেষজ্ঞ", ml: "ഇ.എൻ.ടി സ്പെഷ്യലിസ്റ്റ്", pa: "ਈਐਨਟੀ ਮਾਹਿਰ", or: "ଇଏନଟି ବିଶେଷଜ୍ଞ", as: "ইএনটি বিশেষজ্ঞ"
    }
  },
  departments: {
    "cardiovascular care": {
      hi: "हृदय रोग केंद्र", mr: "हृदयविकार केंद्र", kn: "ಕಾರ್ಡಿಯೋವ್ಯಾಸ್ಕುಲರ್ ಕೇರ್", gu: "કાર્ડિયોવાસ્ક્યુલર કેર", ta: "இருதய சிகிச்சை மையம்", te: "కార్డియోవాస్కులర్ కేర్", bn: "কার্ডিওভাসকুলার কেয়ার", ml: "കാർഡിയോവാസ്കുലർ കെയർ", pa: "ਕਾਰਡੀਓਵੈਸਕੁਲਰ ਕੇਅਰ", or: "କାର୍ଡିଓଭାସ୍କୁଲାର କେୟାର", as: "কাৰ্ডিঅ'ভাস্কুলাৰ কেয়াৰ"
    },
    "opd clinic": {
      hi: "ओपीडी क्लिनिक", mr: "ओपीडी क्लिनिक", kn: "ಒಪಿಡಿ ಕ್ಲಿನಿಕ್", gu: "ઓપીડી ક્લિનિક", ta: "வெளிநோயாளி பிரிவு (OPD)", te: "ఓపీడీ క్లినిక్", bn: "ওপিডি ক্লিনিক", ml: "ഒ.പി.ഡി ക്ലിനിക്", pa: "ਓਪੀਡੀ ਕਲੀਨਿਕ", or: "ଓପିଡି କ୍ଲିନିକ", as: "অ'পিডি ক্লিনিক"
    },
    "cardiology": {
      hi: "हृदय रोग विभाग", mr: "हृदयविकार विभाग", kn: "ಕಾರ್ಡಿಯಾಲಜಿ ವಿಭಾಗ", gu: "કાર્ડિયોલોજી વિભાગ", ta: "இதயவியல் துறை", te: "కార్డియాలజీ విభాగం", bn: "কার্ডিওলজি বিভাগ", ml: "കാർഡിയോളജി വിഭാഗം", pa: "ਕਾਰਡੀਓਲੋਜੀ ਵਿਭਾਗ", or: "କାର୍ଡିଓଲୋଜି ବିଭାଗ", as: "কাৰ্ডিঅ'লজি বিভাগ"
    },
    "opd": {
      hi: "ओपीडी", mr: "ओपीडी", kn: "ಒಪಿಡಿ", gu: "ઓપીડી", ta: "ஓபிடி", te: "ఓపీడీ", bn: "ওপিডি", ml: "ഒ.പി.ഡി", pa: "ਓਪੀਡੀ", or: "ଓପିଡି", as: "অ'পিডি"
    },
        "panel": {
      hi: "विशेषज्ञ क्लिनिक", mr: "विशेषज्ञ क्लिनिक", kn: "ತಜ್ಞರ ಕ್ಲಿನಿಕ್", gu: "નિષ્ણાત ક્લિનિક", ta: "நிபுணர் மருத்துவமனை", te: "స్పెషలిస్ట్ క్లినిక్", bn: "বিশেষজ্ঞ ক্লিনিক", ml: "സ്പെഷ്യലിസ്റ്റ് ക്ലിനിക്", pa: "ਮਾਹਿਰ ਕਲੀਨਿਕ", or: "ବିଶେଷଜ୍ଞ କ୍ଲିନିକ", as: "বিশেষজ্ঞ ক্লিনিক"
    },
    "penal": {
      hi: "विशेषज्ञ क्लिनिक", mr: "विशेषज्ञ क्लिनिक", kn: "ತಜ್ಞರ ಕ್ಲಿನಿಕ್", gu: "નિષ્ણાત ક્લિનિક", ta: "நிபுணர் மருத்துவமனை", te: "స్పెషలిస్ట్ క్లినిక్", bn: "বিশেষজ্ঞ ক্লিনিক", ml: "സ്പെഷ്യലിസ്റ്റ് ക്ലിനിക്", pa: "ਮਾਹਿਰ ਕਲੀਨਿਕ", or: "ବିଶେଷଜ୍ଞ କ୍ଲିନିକ", as: "বিশেষজ্ঞ ক্লিনিক"
    }
  },
  locations: {
    "medikiosk clinic, mumbai": {
      hi: "मेडीकियोस्क क्लिनिक, मुंबई", mr: "मेडीकियोस्क क्लिनिक, मुंबई", kn: "ಮೆಡಿಕಿಯೋಸ್ಕ್ ಕ್ಲಿನಿಕ್, ಮುಂಬೈ", gu: "મેડીકિયોસ્ક ક્લિનિક, મુંબઈ", ta: "மெடிகியோஸ்க் கிளினிக், மும்பை", te: "మెడికియోస్క్ క్లినిక్, ముంబై", bn: "মেডিকিয়স্ক ক্লিনিক, মুম্বাই", ml: "മെഡികിയോസ്ക് ക്ലിനിക്, മുംബൈ", pa: "ਮੇਡੀਕਿਓਸਕ ਕਲੀਨਿਕ, ਮੁੰਬਈ", or: "ମେଡିକିଓସ୍କ କ୍ଲିନିକ, ମୁମ୍ବାଇ", as: "মেডিকিয়স্ক ক্লিনিক, মুম্বাই"
    },
    "apollo hospitals, navi mumbai": {
      hi: "अपोलो हॉस्पिटल्स, नवी मुंबई", mr: "अपोलो हॉस्पिटल्स, नवी मुंबई", kn: "ಅಪೊಲೊ ಆಸ್ಪತ್ರೆ, ನವಿ ಮುಂಬೈ", gu: "એપોલો હોસ્પિટલ્સ, નવી મુંબઈ", ta: "அப்பல்லோ மருத்துவமனை, நவி மும்பை", te: "అపోలో హాస్పిటల్స్, నవీ ముంబై", bn: "অ্যাপোলো হাসপাতাল, নভি মুম্বাই", ml: "അപ്പോളോ ഹോസ്പിറ്റൽസ്, നവി മുംബൈ", pa: "ਅਪੋਲੋ ਹਸਪਤਾਲ, ਨਵੀਂ ਮੁੰਬਈ", or: "ଅପୋଲୋ ହସ୍ପିଟାଲ୍, ନଭି ମୁମ୍ବାଇ", as: "এপ'ল' চিকিৎসালয়, নভি মুম্বাই"
    },
    "apollo hospital, navi mumbai": {
      hi: "अपोलो हॉस्पिटल्स, नवी मुंबई", mr: "अपोलो हॉस्पिटल्स, नवी मुंबई", kn: "ಅಪೊಲೊ ಆಸ್ಪತ್ರೆ, ನವಿ ಮುಂಬೈ", gu: "એપોલો હોસ્પિટલ્સ, નવી મુંબઈ", ta: "அப்பல்லோ மருத்துவமனை, நவி மும்பை", te: "అపోలో హాస్పిటల్స్, నవీ ముంబై", bn: "অ্যাপোলো হাসপাতাল, নভি মুম্বাই", ml: "അപ്പോളോ ഹോസ്പിറ്റൽസ്, നവി മുംബൈ", pa: "ਅਪੋਲੋ ਹਸਪਤਾਲ, ਨਵੀਂ ਮੁੰਬਈ", or: "ଅପୋଲୋ ହସ୍ପିଟାଲ୍, ନଭି ମୁମ୍ବାଇ", as: "এপ'ল' চিকিৎসালয়, নভি মুম্বাই"
    },
    "online consultation": {
      hi: "ऑनलाइन परामर्श", mr: "ऑनलाइन सल्ला", kn: "ಆನ್‌ಲೈನ್ ಸಮಾಲೋಚನೆ", gu: "ઓનલાઈન પરામર્શ", ta: "ஆன்லைன் ஆலோசனை", te: "ఆన్‌లైన్ సంప్రదింపులు", bn: "অনলাইন পরামর্শ", ml: "ഓൺലൈൻ കൺസൾട്ടേഷൻ", pa: "ਆਨਲਾਈਨ ਸਲਾਹ", or: "ଅନଲାଇନ୍ ପରାମର୍ଶ", as: "অনলাইন পৰামৰ্শ"
    },
        "mumbai": {
      hi: "मुंबई", mr: "मुंबई", kn: "ಮುಂಬೈ", gu: "મુંબઈ", ta: "மும்பை", te: "ముంబై", bn: "মুম্বাই", ml: "മുംബൈ", pa: "ਮੁੰਬਈ", or: "ମୁମ୍ବାଇ", as: "মুম্বাই"
    },
    "navi mumbai": {
      hi: "नवी मुंबई", mr: "नवी मुंबई", kn: "ನವಿ ಮುಂಬೈ", gu: "નવી મુંબઈ", ta: "நவி மும்பை", te: "నవీ ముంబై", bn: "নভি মুম্বাই", ml: "നവി മുംബൈ", pa: "ਨਵੀਂ ਮੁੰਬਈ", or: "ନଭି ମୁମ୍ବାଇ", as: "নভি মুম্বাই"
    },
    "thane": {
      hi: "ठाणे", mr: "ठाणे", kn: "ಠಾಣೆ", gu: "થાણે", ta: "தானே", te: "థానే", bn: "থানে", ml: "താനെ", pa: "ਠਾਣੇ", or: "ଥାନେ", as: "থানে"
    },
    "pune": {
      hi: "पुणे", mr: "पुणे", kn: "ಪುಣೆ", gu: "પુણે", ta: "புனே", te: "పూణే", bn: "পুনে", ml: "പൂനെ", pa: "ਪੁਣੇ", or: "ପୁଣେ", as: "পুনে"
    },
    "medikiosk clinic": {
      hi: "मेडीकियोस्क क्लिनिक", mr: "मेडीकियोस्क क्लिनिक", kn: "ಮೆಡಿಕಿಯೋಸ್ಕ್ ಕ್ಲಿನಿಕ್", gu: "મેડીકિયોસ્ક ક્લિનિક", ta: "மெடிகியோஸ்க் கிளினிக்", te: "మెడికియోస్క్ క్లినిక్", bn: "মেডিকিয়স্ক ক্লিনিক", ml: "മെഡികിയോസ്ക് ക്ലിനിക്", pa: "ਮੇਡੀਕਿਓਸਕ ਕਲੀਨਿਕ", or: "ମେଡିକିଓସ୍କ କ୍ଲିନିକ", as: "মেডিকিয়স্ক ক্লিনিক"
    }
  },
  states: {
    "maharashtra": {
      hi: "महाराष्ट्र", mr: "महाराष्ट्र", kn: "ಮಹಾರಾಷ್ಟ್ರ", gu: "મહારાષ્ટ્ર", ta: "மகாராஷ்டிரா", te: "మహారాష్ట్ర", bn: "মহারাষ্ট্র", ml: "മഹാരാഷ്ട്ര", pa: "ਮਹਾਰਾਸ਼ਟਰ", or: "ମହାରାଷ୍ଟ୍ର", as: "মহাৰাষ্ট্ৰ"
    },
    "karnataka": {
      hi: "कर्नाटक", mr: "कर्नाटक", kn: "ಕರ್ನಾಟಕ", gu: "કર્ણાટક", ta: "கர்நாடகா", te: "కర్ణాటక", bn: "কর্ণাটক", ml: "കർണാടക", pa: "ਕਰਨਾਟਕ", or: "କର୍ଣ୍ଣାଟକ", as: "কৰ্ণাটক"
    },
    "gujarat": {
      hi: "गुजरात", mr: "गुजरात", kn: "ಗುಜರಾತ್", gu: "ગુજરાત", ta: "குஜராத்", te: "గుజరాత్", bn: "গুজরাট", ml: "ഗുജറാത്ത്", pa: "ਗੁਜਰਾਤ", or: "ଗୁଜରାଟ", as: "গুজৰাট"
    },
    "delhi (nct)": {
      hi: "दिल्ली (एनसीटी)", mr: "दिल्ली (एनसीटी)", kn: "ದೆಹಲಿ (ಎನ್‌ಸಿಟಿ)", gu: "દિલ્હી (એનસીટી)", ta: "தில்லி", te: "ఢిల్లీ", bn: "দিল্লি", ml: "ഡൽഹി", pa: "ਦਿੱਲੀ", or: "ଦିଲ୍ଲୀ", as: "দিল্লী"
    },
    "tamil nadu": {
      hi: "तमिलनाडु", mr: "तमिलनाडु", kn: "ತಮಿಳುನಾಡು", gu: "તમિલનાડુ", ta: "தமிழ்நாடு", te: "తమిళనాడు", bn: "তামিলনাড়ু", ml: "തമിഴ്നാട്", pa: "ਤਾਮਿਲਨਾਡੂ", or: "ତାମିଲନାଡୁ", as: "তামিলনাডু"
    }
  }
};

export function translateClinicalTerm(term, category, lang = "en") {
  if (!term || !lang || lang === "en") return term || "";
  const key = term.trim().toLowerCase();
  const group = CLINICAL_TRANSLATIONS[category];
  if (group && group[key] && group[key][lang]) {
    return group[key][lang];
  }
  return term;
}


export function translateDepartment(dept, lang = "en") {
  if (!dept || !lang || lang === "en") return dept || "";
  const fromDept = translateClinicalTerm(dept, "departments", lang);
  if (fromDept && fromDept !== dept) return fromDept;
  const fromLoc = translateClinicalTerm(dept, "locations", lang);
  if (fromLoc && fromLoc !== dept) return fromLoc;
  const fromSpec = translateClinicalTerm(dept, "specializations", lang);
  if (fromSpec && fromSpec !== dept) return fromSpec;
  return dept;
}

export default transliterateName;
