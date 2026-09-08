/**
 * MediKiosk Onboarding Data Constants
 * Single source of truth for languages, Indian States & Union Territories, and recommendations.
 */

export const SUPPORTED_LANGUAGES = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
    { code: "mr", name: "Marathi", nativeName: "मराठी" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు" },
    { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
    { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
    { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
    { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
    { code: "as", name: "Assamese", nativeName: "অসমীয়া" }
];

export const INDIAN_STATES_AND_UTS = [
    // 28 States
    { name: "Andhra Pradesh", type: "State" },
    { name: "Arunachal Pradesh", type: "State" },
    { name: "Assam", type: "State" },
    { name: "Bihar", type: "State" },
    { name: "Chhattisgarh", type: "State" },
    { name: "Goa", type: "State" },
    { name: "Gujarat", type: "State" },
    { name: "Haryana", type: "State" },
    { name: "Himachal Pradesh", type: "State" },
    { name: "Jharkhand", type: "State" },
    { name: "Karnataka", type: "State" },
    { name: "Kerala", type: "State" },
    { name: "Madhya Pradesh", type: "State" },
    { name: "Maharashtra", type: "State" },
    { name: "Manipur", type: "State" },
    { name: "Meghalaya", type: "State" },
    { name: "Mizoram", type: "State" },
    { name: "Nagaland", type: "State" },
    { name: "Odisha", type: "State" },
    { name: "Punjab", type: "State" },
    { name: "Rajasthan", type: "State" },
    { name: "Sikkim", type: "State" },
    { name: "Tamil Nadu", type: "State" },
    { name: "Telangana", type: "State" },
    { name: "Tripura", type: "State" },
    { name: "Uttar Pradesh", type: "State" },
    { name: "Uttarakhand", type: "State" },
    { name: "West Bengal", type: "State" },
    
    // 8 Union Territories
    { name: "Andaman and Nicobar Islands", type: "Union Territory" },
    { name: "Chandigarh", type: "Union Territory" },
    { name: "Dadra and Nagar Haveli and Daman and Diu", type: "Union Territory" },
    { name: "Delhi (NCT)", type: "Union Territory" },
    { name: "Jammu and Kashmir", type: "Union Territory" },
    { name: "Ladakh", type: "Union Territory" },
    { name: "Lakshadweep", type: "Union Territory" },
    { name: "Puducherry", type: "Union Territory" }
];

/**
 * Maps State / UT to recommended regional language code.
 * Recommendation only — patients remain free to choose any language.
 */
export const STATE_LANGUAGE_RECOMMENDATIONS = {
    "Maharashtra": "mr",
    "Goa": "mr",
    "Gujarat": "gu",
    "Dadra and Nagar Haveli and Daman and Diu": "gu",
    "Tamil Nadu": "ta",
    "Puducherry": "ta",
    "Karnataka": "kn",
    "Andhra Pradesh": "te",
    "Telangana": "te",
    "Kerala": "ml",
    "Lakshadweep": "ml",
    "West Bengal": "bn",
    "Tripura": "bn",
    "Andaman and Nicobar Islands": "bn",
    "Punjab": "pa",
    "Chandigarh": "pa",
    "Odisha": "or",
    "Assam": "as",
    "Delhi (NCT)": "hi",
    "Uttar Pradesh": "hi",
    "Madhya Pradesh": "hi",
    "Bihar": "hi",
    "Rajasthan": "hi",
    "Haryana": "hi",
    "Himachal Pradesh": "hi",
    "Uttarakhand": "hi",
    "Jharkhand": "hi",
    "Chhattisgarh": "hi",
    "Jammu and Kashmir": "hi",
    "Ladakh": "hi"
};

/**
 * Returns recommended language code for a given state name
 */
export function getRecommendedLanguageForState(stateName) {
    if (!stateName) return null;
    return STATE_LANGUAGE_RECOMMENDATIONS[stateName] || "en";
}
