import React, { createContext, useContext, useState, useEffect } from "react";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import gu from "./locales/gu.json";
import bn from "./locales/bn.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";
import ml from "./locales/ml.json";
import pa from "./locales/pa.json";
import or from "./locales/or.json";
import as from "./locales/as.json";

const LOCALES = { en, hi, mr, gu, bn, ta, te, kn, ml, pa, or, as };

export const LANGUAGE_OPTIONS = [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
    { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
    { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
    { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
    { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
    { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
    { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
    { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
    { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
    { code: "or", label: "Odia", nativeLabel: "ଓଡ଼િଆ" },
    { code: "as", label: "Assamese", nativeLabel: "অসমীয়া" },
];

const STORAGE_KEY = "medikiosk_language";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && LOCALES[saved] ? saved : "en";
    });

    const changeLanguage = (code) => {
        if (LOCALES[code]) {
            setLanguage(code);
            localStorage.setItem(STORAGE_KEY, code);
            document.documentElement.lang = code;
        }
    };

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = (keyPath) => {
        const keys = keyPath.split(".");
        let currentDict = LOCALES[language] || LOCALES.en;
        
        for (const k of keys) {
            if (currentDict && currentDict[k] !== undefined) {
                currentDict = currentDict[k];
            } else {
                // Fallback to English if translation key is missing in active locale
                let fallbackDict = LOCALES.en;
                for (const fk of keys) {
                    if (fallbackDict && fallbackDict[fk] !== undefined) {
                        fallbackDict = fallbackDict[fk];
                    } else {
                        return keyPath; // Return raw key if even fallback fails
                    }
                }
                return fallbackDict;
            }
        }
        return currentDict;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};
