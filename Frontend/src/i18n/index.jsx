import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

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

import { SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS } from "./languages";
import { useAuth } from "../context/AuthContext";
import { updatePatientProfile } from "../services/api";

const STORAGE_KEY = "medikiosk_language";

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
  gu: { translation: gu },
  bn: { translation: bn },
  ta: { translation: ta },
  te: { translation: te },
  kn: { translation: kn },
  ml: { translation: ml },
  pa: { translation: pa },
  or: { translation: or },
  as: { translation: as },
};

const savedLang = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const initialLanguage = savedLang && resources[savedLang] ? savedLang : "en";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });
}

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const auth = useAuth();
  const user = auth?.user;
  const token = auth?.token;
  const updateUser = auth?.updateUser;

  const [currentLang, setCurrentLang] = useState(() => i18nInstance.language || initialLanguage);

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      setCurrentLang(lng);
    };
    i18nInstance.on("languageChanged", handleLanguageChanged);
    return () => {
      i18nInstance.off("languageChanged", handleLanguageChanged);
    };
  }, [i18nInstance]);

  // Sync preferred_language from authenticated user profile once when user logs in or profile first loads
  const syncedUserIdRef = useRef(null);

  useEffect(() => {
    if (!user) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current !== user.id) {
      syncedUserIdRef.current = user.id;
      const userLang = user?.onboarding?.preferredLanguage || user?.onboarding?.preferred_language || user?.preferredLanguage;
      const currentStored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const targetLang = (currentStored && resources[currentStored])
        ? currentStored
        : (userLang && resources[userLang])
        ? userLang
        : "en";

      if (targetLang && i18nInstance.language !== targetLang) {
        i18nInstance.changeLanguage(targetLang);
        setCurrentLang(targetLang);
        localStorage.setItem(STORAGE_KEY, targetLang);
        document.documentElement.lang = targetLang;
      }
    }
  }, [user, i18nInstance]);

  const changeLanguage = async (code) => {
    if (resources[code]) {
      setCurrentLang(code);
      await i18nInstance.changeLanguage(code);
      localStorage.setItem(STORAGE_KEY, code);
      document.documentElement.lang = code;

      // Keep user in AuthContext in sync immediately
      if (updateUser) {
        updateUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            preferredLanguage: code,
            onboarding: {
              ...(prev.onboarding || {}),
              preferredLanguage: code,
              preferred_language: code,
            },
          };
        });
      }

      // Persist to backend user profile if authenticated
      if (token && user) {
        try {
          await updatePatientProfile({ preferredLanguage: code }, token);
        } catch (err) {
          console.warn("[i18n] Failed to persist preferredLanguage to backend:", err.message);
        }
      }
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language: currentLang,
        currentLanguage: currentLang,
        changeLanguage,
        t,
        i18n: i18nInstance,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: i18n.language || "en",
      currentLanguage: i18n.language || "en",
      changeLanguage: (code) => i18n.changeLanguage(code),
      t: i18n.t.bind(i18n),
      i18n,
    };
  }
  return context;
};

export { i18n, SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS };
export default i18n;
