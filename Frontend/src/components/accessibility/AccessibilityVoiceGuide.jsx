import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Sparkles, Loader2, Stethoscope, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { synthesizeTTS } from "../../services/api";
import styles from "./AccessibilityVoiceGuide.module.css";

// Helper: Convert Base64 string to Blob
function base64ToBlob(base64, mimeType = "audio/wav") {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper: Clean raw DOM text to prevent speaking garbage (URLs, UUIDs, raw HTML, SVG data)
function cleanAccessibleText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let cleaned = rawText
    .replace(/<[^>]*>?/gm, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    .replace(/[✦•·|:;{}[\]()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2 || /^\d+$/.test(cleaned)) {
    return "";
  }

  return cleaned;
}

// Helper: Extract accessible label from a DOM node
function extractTargetText(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";

  const dataAcc = el.getAttribute("data-acc-text");
  if (dataAcc) return cleanAccessibleText(dataAcc);

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return cleanAccessibleText(ariaLabel);

  const title = el.getAttribute("title");
  if (title) return cleanAccessibleText(title);

  const alt = el.getAttribute("alt");
  if (alt) return cleanAccessibleText(alt);

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return cleanAccessibleText(placeholder);

    if (el.id) {
      const associatedLabel = document.querySelector(`label[for="${el.id}"]`);
      if (associatedLabel) return cleanAccessibleText(associatedLabel.innerText);
    }
  }

  const innerText = el.innerText || el.textContent || "";
  return cleanAccessibleText(innerText);
}

// Custom Robot AI Character Avatar SVG
function RobotAvatar({ isSpeaking, isLoadingAudio, isMuted }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${styles.robotSvg} ${isSpeaking ? styles.speakingSvg : ""} ${isLoadingAudio ? styles.loadingSvg : ""} ${isMuted ? styles.mutedSvg : ""}`}
    >
      {/* Antenna Stem & Orb */}
      <line x1="24" y1="11" x2="24" y2="4" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
      <circle
        cx="24"
        cy="4"
        r="3.5"
        className={styles.antennaOrb}
        fill={isLoadingAudio ? "#f59e0b" : isSpeaking ? "#10b981" : isMuted ? "#94a3b8" : "#2dd4bf"}
      />

      {/* Side Ear Accessories */}
      <rect x="3" y="20" width="4" height="9" rx="2" fill="#0f766e" />
      <rect x="41" y="20" width="4" height="9" rx="2" fill="#0f766e" />

      {/* Main Outer Head Frame */}
      <rect x="7" y="10" width="34" height="31" rx="10" fill="url(#headGradient)" stroke="#0d9488" strokeWidth="2" />

      {/* Sleek Metallic Visor */}
      <rect x="11" y="16" width="26" height="15" rx="6" fill="#0f172a" />

      {/* Expressive LED Eyes */}
      {isMuted ? (
        <>
          <line x1="15" y1="23" x2="20" y2="23" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="23" x2="33" y2="23" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="17.5" cy="22.5" r="3.5" className={styles.robotEye} fill={isSpeaking ? "#10b981" : isLoadingAudio ? "#f59e0b" : "#2dd4bf"} />
          <circle cx="30.5" cy="22.5" r="3.5" className={styles.robotEye} fill={isSpeaking ? "#10b981" : isLoadingAudio ? "#f59e0b" : "#2dd4bf"} />
          <circle cx="16.5" cy="21.5" r="1" fill="#ffffff" />
          <circle cx="29.5" cy="21.5" r="1" fill="#ffffff" />
        </>
      )}

      {/* Mouth / Speaker Display */}
      {isMuted ? (
        <line x1="20" y1="28" x2="28" y2="28" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      ) : isSpeaking ? (
        <path d="M 18 27 Q 24 32 30 27" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" className={styles.talkingMouth} />
      ) : (
        <path d="M 19 27 Q 24 30 29 27" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* Metallic Head Gradient */}
      <defs>
        <linearGradient id="headGradient" x1="7" y1="10" x2="41" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#ccfbf1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AccessibilityVoiceGuide() {
  const { user, token } = useAuth();
  const { language } = useLanguage();

  // Check if Voice Guidance preference is active
  const prefActive = user?.onboarding?.accessibilityPreference === "voice_guidance";
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Audio & Timer Refs
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastSpokenTextRef = useRef("");
  const isFetchingRef = useRef(false);

  // Stop any currently playing audio and revoke temporary Blob URLs
  const stopAudio = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
  };

  // Perform TTS synthesis & play spoken audio
  const speakText = async (text) => {
    if (!text || isMuted || !prefActive) return;

    // Interrupt previous speech and audio
    stopAudio();

    lastSpokenTextRef.current = text;
    setCurrentText(text);
    setIsLoadingAudio(true);
    isFetchingRef.current = true;

    try {
      const res = await synthesizeTTS(text, language, token);
      isFetchingRef.current = false;
      setIsLoadingAudio(false);

      if (res && res.success && res.audio_base64) {
        const audioBlob = base64ToBlob(res.audio_base64, "audio/wav");
        const objectUrl = URL.createObjectURL(audioBlob);
        currentObjectUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          stopAudio();
        };

        audio.onerror = () => {
          stopAudio();
        };

        setIsSpeaking(true);
        await audio.play();
      }
    } catch (err) {
      isFetchingRef.current = false;
      setIsLoadingAudio(false);
      setIsSpeaking(false);
      console.warn("[VoiceGuide] TTS synthesis skipped:", err.message);
    }
  };

  // Attach global event listeners for mouseover and focusin
  useEffect(() => {
    if (!prefActive || isMuted) {
      stopAudio();
      return;
    }

    const interactiveSelector =
      "button, a, input, select, textarea, label, [role='button'], h1, h2, h3, h4, .navItem, [data-acc-text]";

    const handleTargetTrigger = (target) => {
      if (!target) return;

      const interactiveEl = target.closest(interactiveSelector);
      if (!interactiveEl) return;

      const extracted = extractTargetText(interactiveEl);
      if (!extracted) return;

      // Duplicate suppression: if already speaking/synthesized this exact text, skip
      if (lastSpokenTextRef.current === extracted && (isSpeaking || isLoadingAudio)) {
        return;
      }

      // Interrupt existing speech immediately
      stopAudio();

      // Apply 450ms hover debounce before synthesizing
      debounceTimerRef.current = setTimeout(() => {
        speakText(extracted);
      }, 450);
    };

    const handleMouseOver = (e) => {
      handleTargetTrigger(e.target);
    };

    const handleFocusIn = (e) => {
      handleTargetTrigger(e.target);
    };

    const handleMouseOut = (e) => {
      const target = e.target;
      if (target && target.closest(interactiveSelector)) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      }
    };

    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("mouseout", handleMouseOut, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      stopAudio();
    };
  }, [prefActive, isMuted, language, token]);

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Do not render if preference is disabled or user role is not patient
  if (!prefActive || user?.role !== "patient") {
    return null;
  }

  return (
    <div className={styles.characterContainer} aria-live="polite">
      {/* Speech Bubble Display */}
      {!isCollapsed && (
        <div className={styles.speechBubble}>
          <div className={styles.speechHeader}>
            <span className={styles.characterName}>
              <Sparkles size={13} color="#0d9488" /> Asha Bot · AI Voice Guide
            </span>
            {isSpeaking && (
              <div className={styles.soundWave} title="Speaking">
                <div className={styles.waveBar} />
                <div className={styles.waveBar} />
                <div className={styles.waveBar} />
                <div className={styles.waveBar} />
              </div>
            )}
            {isLoadingAudio && <span className={styles.badgeTag}>Thinking...</span>}
          </div>

          <div className={styles.speechContent}>
            {isMuted ? (
              <span className={styles.speechPlaceholder}>Voice guidance is currently muted.</span>
            ) : isLoadingAudio ? (
              <span className={styles.speechPlaceholder}>Synthesizing voice audio...</span>
            ) : isSpeaking ? (
              currentText
            ) : (
              <span className={styles.speechPlaceholder}>Hover or focus any text to hear voice guide.</span>
            )}
          </div>
        </div>
      )}

      {/* Main Character Avatar Body */}
      <div className={`${styles.characterCard} ${isMuted ? styles.mutedCard : ""} ${isCollapsed ? styles.collapsedCard : ""}`}>
        <div className={styles.avatarRing} onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: "pointer" }}>
          {isSpeaking && <div className={styles.pulseRing} />}
          <RobotAvatar isSpeaking={isSpeaking} isLoadingAudio={isLoadingAudio} isMuted={isMuted} />
          <span className={styles.stethBadge}>
            <Stethoscope size={11} />
          </span>
        </div>

        {!isCollapsed && (
          <>
            <div className={styles.characterMeta}>
              <span className={styles.characterTitle}>
                Asha Bot <span style={{ fontSize: "11px", fontWeight: "500", color: "#0d9488", background: "#f0fdf4", padding: "1px 6px", borderRadius: "10px" }}>Robot AI</span>
              </span>
              <span className={styles.characterSub}>
                {isMuted ? "Muted" : isSpeaking ? "Speaking" : isLoadingAudio ? "Thinking..." : "Active Guide"}
              </span>
            </div>

            <div className={styles.controlsGroup}>
              <button
                onClick={() => {
                  if (!isMuted) stopAudio();
                  setIsMuted(!isMuted);
                }}
                className={styles.controlBtn}
                title={isMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
                aria-label={isMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button
                onClick={() => setIsCollapsed(true)}
                className={styles.controlBtn}
                title="Collapse Voice Guide"
                aria-label="Collapse Voice Guide"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
