import { useTranslation } from "react-i18next";
import { resources } from "../i18n/resources.js";
import { createSiteTextResolver } from "../components/accessibility/isl/siteText.js";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const AccessibilityContext = createContext(null);
const resolveSiteText = createSiteTextResolver(resources);

export const AccessibilityProvider = ({ children }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  // 1. ISL Enabled State
  // Initialized from user profile or local storage cache
  const [islEnabled, setIslEnabledState] = useState(() => {
    const cached = localStorage.getItem("medikiosk_isl_enabled");
    if (cached !== null) return cached === "true";
    return (
      user?.onboarding?.islEnabled === true ||
      user?.onboarding?.accessibilityPreference === "sign_language"
    );
  });

  // Sync state when user object updates from backend
  useEffect(() => {
    if (user?.onboarding) {
      const serverVal =
        user.onboarding.islEnabled === true ||
        user.onboarding.accessibilityPreference === "sign_language";
      setIslEnabledState(serverVal);
      localStorage.setItem("medikiosk_isl_enabled", String(serverVal));
    }
  }, [user]);

  const setIslEnabled = useCallback((val) => {
    const boolVal = Boolean(val);
    setIslEnabledState(boolVal);
    localStorage.setItem("medikiosk_isl_enabled", String(boolVal));
  }, []);

  const toggleISL = useCallback(() => {
    setIslEnabledState((prev) => {
      const next = !prev;
      localStorage.setItem("medikiosk_isl_enabled", String(next));
      return next;
    });
  }, []);

  // 2. Avatar Presentation & Collapse State
  const [isAvatarCollapsed, setIsAvatarCollapsed] = useState(false);

  // 3. Current Contextual Text to Sign
  const [currentSignText, setCurrentSignText] = useState("");
  const [signPlaybackText, setSignPlaybackText] = useState("");
  const [currentContext, setCurrentContext] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [activeToken, setActiveToken] = useState("");

  // Contextual Sign Request API
  const requestSign = useCallback(
    (text, options = {}) => {
      if (!islEnabled || !text) return;
      const clean = typeof text === "string" ? text.trim() : "";
      if (!clean) return;

      setCurrentSignText(clean);
      setSignPlaybackText(resolveSiteText(clean, i18n.language));
      if (options.context) setCurrentContext(options.context);

      // Auto-uncollapse avatar if it was collapsed and a high-priority prompt arrives
      if (options.autoExpand && isAvatarCollapsed) {
        setIsAvatarCollapsed(false);
      }
    },
    [islEnabled, isAvatarCollapsed, i18n.language]
  );

  const clearSign = useCallback(() => {
    setCurrentSignText("");
    setSignPlaybackText("");
    setCurrentContext("");
    setIsSigning(false);
    setActiveToken("");
  }, []);

  const value = {
    islEnabled,
    setIslEnabled,
    toggleISL,
    isAvatarCollapsed,
    setIsAvatarCollapsed,
    currentSignText,
    signPlaybackText,
    currentContext,
    requestSign,
    clearSign,
    isSigning,
    setIsSigning,
    activeToken,
    setActiveToken,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    // Return safe dummy fallback if accessed outside provider
    return {
      islEnabled: false,
      setIslEnabled: () => {},
      toggleISL: () => {},
      isAvatarCollapsed: false,
      setIsAvatarCollapsed: () => {},
      currentSignText: "",
      currentContext: "",
      requestSign: () => {},
      clearSign: () => {},
      isSigning: false,
      setIsSigning: () => {},
      activeToken: "",
      setActiveToken: () => {},
    };
  }
  return ctx;
};
