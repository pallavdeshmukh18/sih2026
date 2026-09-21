import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, RotateCcw, Maximize2, Minimize2, X } from "lucide-react";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import ISLAvatar from "./ISLAvatar";
import styles from "./ISLAccessibilityOverlay.module.css";

const QUICK_PRESETS = ["NAMASTE", "HELLO", "TIME", "HOME", "CARE", "YOU", "PERSON"];
const SIGN_LANGUAGE_LABELS = { en:"Sign language", hi:"सांकेतिक भाषा", mr:"सांकेतिक भाषा", gu:"સાંકેતિક ભાષા", bn:"সংকেত ভাষা", ta:"சைகை மொழி", te:"సంకేత భాష", kn:"ಸಂಕೇತ ಭಾಷೆ", ml:"ആംഗ്യഭാഷ", pa:"ਸੰਕੇਤਕ ਭਾਸ਼ਾ", or:"ସାଙ୍କେତିକ ଭାଷା", as:"সাংকেতিক ভাষা" };

export default function ISLAccessibilityOverlay() {
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const signLanguageLabel = SIGN_LANGUAGE_LABELS[currentLanguage] || SIGN_LANGUAGE_LABELS.en;
  const {
    islEnabled,
    setIslEnabled,
    isAvatarCollapsed,
    setIsAvatarCollapsed,
    currentSignText,
    signPlaybackText,
    requestSign,
    isSigning,
    setIsSigning,
  } = useAccessibility();

  const [activePreset, setActivePreset] = useState("");
  const [replayKey, setReplayKey] = useState(0);
  const [enlarged, setEnlarged] = useState(false);

  const isPatient = user?.role === "patient";
  const hasVoiceGuide = user?.onboarding?.accessibilityPreference === "voice_guidance";

  // Replay the current text
  const handleReplay = () => {
    if (currentSignText) {
      setReplayKey((k) => k + 1);
    }
  };

  const handleSelectPreset = (word) => {
    setActivePreset(word);
    setReplayKey((k) => k + 1);
    requestSign(word, { context: "quick_preset" });
  };

  const handleSignStart = React.useCallback(() => {
    setIsSigning(true);
  }, [setIsSigning]);

  const handleSignEnd = React.useCallback(() => {
    setIsSigning(false);
  }, [setIsSigning]);

  // Only render if ISL is enabled and user is a patient
  if (!islEnabled) {
    return <div className={styles.overlayContainer} data-isl-ignore="true">
      <button data-isl-ignore="true" className={`${styles.minimizedButton} ${styles.interactive}`}
        onClick={() => setIslEnabled(true)} aria-label={signLanguageLabel}>
        <Sparkles size={16} /> {signLanguageLabel}
      </button>
    </div>;
  }

  return (
    <div
      className={`${styles.overlayContainer} ${
        hasVoiceGuide ? styles.overlayWithVoiceGuide : ""
      }`}
      data-isl-ignore="true"
      aria-live="polite"
      data-testid="isl-accessibility-overlay"
    >
      {isAvatarCollapsed ? (
        /* Minimized Floating Pill */
        <button
          className={`${styles.minimizedButton} ${styles.interactive}`}
          onClick={() => setIsAvatarCollapsed(false)}
          title="Open Indian Sign Language Assistant"
          aria-label="Open Indian Sign Language Assistant"
          data-testid="isl-overlay-expand-btn"
        >
          <Sparkles size={16} />
          <span>ISL Guide</span>
          <ChevronUp size={16} />
        </button>
      ) : (
        /* Expanded Floating Card */
        <div className={`${styles.card} ${styles.interactive} ${enlarged ? styles.enlarged : ""}`} data-testid="isl-overlay-card">
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.titleArea}>
              <span className={styles.titleIcon}>
                <Sparkles size={15} />
              </span>
              <span className={styles.titleText}>ISL Assistant</span>
              <span
                className={`${styles.statusIndicator} ${
                  isSigning ? styles.statusActive : ""
                }`}
                title={isSigning ? "Signing..." : "Ready"}
              />
            </div>
            <div className={styles.controlButtons}>
              <button className={styles.iconBtn} onClick={() => setEnlarged(value => !value)}
                aria-label={enlarged ? "Restore avatar size" : "Enlarge avatar"}
                title={enlarged ? "Restore avatar size" : "Enlarge avatar"} aria-pressed={enlarged}>
                {enlarged ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              {currentSignText && (
                <button
                  className={styles.iconBtn}
                  onClick={handleReplay}
                  title="Replay sign gesture"
                  aria-label="Replay sign gesture"
                  data-testid="isl-overlay-replay-btn"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                className={styles.iconBtn}
                onClick={() => setIsAvatarCollapsed(true)}
                title="Minimize ISL Assistant"
                aria-label="Minimize ISL Assistant"
                data-testid="isl-overlay-minimize-btn"
              >
                <ChevronDown size={15} />
              </button>
              <button
                className={styles.iconBtn}
                onClick={() => setIslEnabled(false)}
                title="Dismiss ISL Assistant"
                aria-label="Dismiss ISL Assistant"
                data-testid="isl-overlay-close-btn"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 3D Avatar Body */}
          <div className={styles.avatarBody} >
            <ISLAvatar
              replayId={replayKey}
              text={signPlaybackText || currentSignText}
              visible={!isAvatarCollapsed}
              height="100%"
              width="100%"
              speed={0.09}
              pause={180}
              onSignStart={handleSignStart}
              onSignEnd={handleSignEnd}
            />
          </div>

          {/* Quick Sign Words Bar */}
          <div className={styles.quickBar} data-testid="isl-quick-words-bar">
            {QUICK_PRESETS.map((word) => (
              <button
                key={word}
                type="button"
                className={`${styles.quickBtn} ${
                  currentSignText?.toUpperCase() === word || activePreset === word
                    ? styles.quickBtnActive
                    : ""
                }`}
                onClick={() => handleSelectPreset(word)}
                data-testid={`isl-overlay-preset-${word.toLowerCase()}`}
                title={`Sign "${word}" in ISL`}
              >
                {word}
              </button>
            ))}
          </div>

          {/* Subtitle / Caption Strip */}
          <div className={styles.captionStrip}>
            <div
              className={`${styles.captionText} ${
                !currentSignText ? styles.captionTextIdle : ""
              }`}
              title={currentSignText || "Hover over text or buttons to sign"}
              data-testid="isl-caption-text"
            >
              {currentSignText ? (
                <span>&ldquo;{currentSignText}&rdquo;</span>
              ) : (
                "Hover or select an item to sign"
              )}
            </div>
            <span className={styles.islBadge}>ISL 3D</span>
          </div>
        </div>
      )}
    </div>
  );
}
