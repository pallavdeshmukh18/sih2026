import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Sun,
    Moon,
    Monitor,
    Sparkles,
    Mic,
    MousePointer,
    Sliders,
    Eye,
    Volume2,
    EyeOff,
    Bell,
    Lock,
    Globe,
    Check,
    Save,
    Shield,
    Smartphone
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { useAccessibility } from "../../context/AccessibilityContext";
import { SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import { updatePatientProfile } from "../../services/api";
import styles from "./Settings.module.css";

export default function Settings() {
    const { user, token, refreshUser } = useAuth();
    const { language, changeLanguage, t } = useLanguage();

    // 1. Theme state (light / dark / system)
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("medikiosk_theme") || "light";
    });

    // 2. Interaction Mode (voice_touch, voice, touch)
    const [interactionMode, setInteractionMode] = useState(() => {
        return user?.onboarding?.interactionMode || "voice_touch";
    });

    // 3. Accessibility Preference (none, large_text, voice_guidance, hearing_assistance, sign_language)
    const { islEnabled, setIslEnabled } = useAccessibility();
    const [accessibility, setAccessibility] = useState(() => {
        return user?.onboarding?.accessibilityPreference || "none";
    });

    const [islActive, setIslActive] = useState(() => {
        return (
            user?.onboarding?.islEnabled === true ||
            user?.onboarding?.accessibilityPreference === "sign_language" ||
            islEnabled
        );
    });

    useEffect(() => {
        if (user?.onboarding) {
            const serverIsl =
                user.onboarding.islEnabled === true ||
                user.onboarding.accessibilityPreference === "sign_language";
            setIslActive(serverIsl);
            setAccessibility(user.onboarding.accessibilityPreference || "none");
        }
    }, [user]);

    // 4. Preferred Language
    const [selectedLanguage, setSelectedLanguage] = useState(() => {
        return user?.onboarding?.preferredLanguage || language || "en";
    });

    // 5. Generic Settings
    const [notifications, setNotifications] = useState({
        email: true,
        sms: true,
        whatsapp: true,
        appointmentReminders: true
    });

    const [privacy, setPrivacy] = useState({
        shareAnalytics: false,
        allowDoctorAccess: true
    });

    const [isSaving, setIsSaving] = useState(false);

    // Sync theme changes with DOM body class
    useEffect(() => {
        localStorage.setItem("medikiosk_theme", theme);
        if (theme === "dark") {
            document.body.classList.add("dark-theme");
        } else if (theme === "light") {
            document.body.classList.remove("dark-theme");
        } else {
            // System preference check
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            if (prefersDark) {
                document.body.classList.add("dark-theme");
            } else {
                document.body.classList.remove("dark-theme");
            }
        }
    }, [theme]);

    // Handle Language change instantly
    const handleLanguageChange = (langCode) => {
        setSelectedLanguage(langCode);
        changeLanguage(langCode);
    };

    // Save Settings Handler
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Apply large text mode immediately
            if (accessibility === "large_text") {
                document.body.classList.add("larger-text-mode");
            } else {
                document.body.classList.remove("larger-text-mode");
            }

            // Sync with backend database
            if (token && user?.role === "patient") {
                const effectiveIsl = islActive || accessibility === "sign_language";
                await updatePatientProfile({
                    preferredLanguage: selectedLanguage,
                    interactionMode: interactionMode,
                    accessibilityPreference: accessibility,
                    islEnabled: effectiveIsl
                }, token);
                setIslEnabled(effectiveIsl);
                await refreshUser();
            } else {
                setIslEnabled(islActive || accessibility === "sign_language");
            }

            toast.success("Settings updated successfully!");
        } catch (err) {
            console.error("Failed to update settings:", err);
            toast.error(err.message || "Failed to update settings");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.subtitle}>Customize your MediKiosk interface, accessibility options, and preferences.</p>
                </div>
                <button
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={isSaving}
                    data-testid="settings-save-btn"
                >
                    <Save size={18} />
                    {isSaving ? "Saving..." : "Save Preferences"}
                </button>
            </header>

            <div className={styles.sectionsGrid}>
                {/* SECTION 1: APPEARANCE & THEME */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className={styles.cardHeader}>
                        <Sun className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Appearance & Theme</h2>
                            <p>Choose how MediKiosk looks to you</p>
                        </div>
                    </div>

                    <div className={styles.themeGrid}>
                        <button
                            type="button"
                            className={`${styles.themeOption} ${theme === "light" ? styles.themeActive : ""}`}
                            onClick={() => setTheme("light")}
                        >
                            <div className={styles.themePreviewLight}>
                                <Sun size={24} />
                            </div>
                            <span className={styles.themeLabel}>Light Mode</span>
                        </button>

                        <button
                            type="button"
                            className={`${styles.themeOption} ${theme === "dark" ? styles.themeActive : ""}`}
                            onClick={() => setTheme("dark")}
                        >
                            <div className={styles.themePreviewDark}>
                                <Moon size={24} />
                            </div>
                            <span className={styles.themeLabel}>Dark Mode</span>
                        </button>

                        <button
                            type="button"
                            className={`${styles.themeOption} ${theme === "system" ? styles.themeActive : ""}`}
                            onClick={() => setTheme("system")}
                        >
                            <div className={styles.themePreviewSystem}>
                                <Monitor size={24} />
                            </div>
                            <span className={styles.themeLabel}>System Preference</span>
                        </button>
                    </div>
                </motion.section>

                {/* SECTION 2: INTERACTION MODE (Step 3 Options) */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                >
                    <div className={styles.cardHeader}>
                        <Sparkles className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Interaction Mode</h2>
                            <p>Choose your preferred mode of interacting with the kiosk</p>
                        </div>
                    </div>

                    <div className={styles.optionsList}>
                        {/* Option A: Voice + Touch */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${interactionMode === "voice_touch" ? styles.optionCardSelected : ""}`}
                            onClick={() => setInteractionMode("voice_touch")}
                        >
                            <div className={styles.iconCircle}>
                                <Sparkles size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <div className={styles.optionTitleRow}>
                                    <span className={styles.optionTitle}>{t("onboarding.voiceAndTouch", "Voice + Touch")}</span>
                                    <span className={styles.inlineRecBadge}>{t("common.recommended", "Recommended")}</span>
                                </div>
                                <span className={styles.optionDesc}>{t("onboarding.voiceAndTouchDesc", "Seamlessly combine speech and touch input")}</span>
                            </div>
                            {interactionMode === "voice_touch" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option B: Voice Only */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${interactionMode === "voice" ? styles.optionCardSelected : ""}`}
                            onClick={() => setInteractionMode("voice")}
                        >
                            <div className={styles.iconCircle}>
                                <Mic size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.voiceOnly", "Voice")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.voiceOnlyDesc", "Speak your responses into the kiosk microphone")}</span>
                            </div>
                            {interactionMode === "voice" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option C: Touch Screen Only */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${interactionMode === "touch" ? styles.optionCardSelected : ""}`}
                            onClick={() => setInteractionMode("touch")}
                        >
                            <div className={styles.iconCircle}>
                                <MousePointer size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.touchOnly", "Touch Screen")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.touchOnlyDesc", "Tap options and type on the kiosk touch screen")}</span>
                            </div>
                            {interactionMode === "touch" && <Check size={20} className={styles.checkIcon} />}
                        </button>
                    </div>
                </motion.section>

                {/* SECTION 3: ACCESSIBILITY PREFERENCE (Step 4 Options) */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                >
                    <div className={styles.cardHeader}>
                        <Sliders className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Accessibility & Assistance</h2>
                            <p>Customize the kiosk interface for your maximum comfort</p>
                        </div>
                    </div>

                    <div className={styles.optionsList}>
                        {/* Option A: Standard */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${accessibility === "none" ? styles.optionCardSelected : ""}`}
                            onClick={() => setAccessibility("none")}
                        >
                            <div className={styles.iconCircle}>
                                <Sliders size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.noAssistance", "Standard Interface")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.noAssistanceDesc", "No special assistance needed")}</span>
                            </div>
                            {accessibility === "none" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option B: Larger Text */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${accessibility === "large_text" ? styles.optionCardSelected : ""}`}
                            onClick={() => setAccessibility("large_text")}
                        >
                            <div className={styles.iconCircle}>
                                <Eye size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.largerText", "Larger Text")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.largerTextDesc", "Increase font size across all kiosk screens")}</span>
                            </div>
                            {accessibility === "large_text" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option C: Audio Voiceover */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${accessibility === "voice_guidance" ? styles.optionCardSelected : ""}`}
                            onClick={() => setAccessibility("voice_guidance")}
                        >
                            <div className={styles.iconCircle}>
                                <Volume2 size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.voiceGuidance", "Audio Voiceover")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.voiceGuidanceDesc", "Read aloud all questions and instructions")}</span>
                            </div>
                            {accessibility === "voice_guidance" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option D: Visual Highlights */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${accessibility === "hearing_assistance" ? styles.optionCardSelected : ""}`}
                            onClick={() => setAccessibility("hearing_assistance")}
                        >
                            <div className={styles.iconCircle}>
                                <EyeOff size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("onboarding.hearingAssistance", "Visual Highlights")}</span>
                                <span className={styles.optionDesc}>{t("onboarding.hearingAssistanceDesc", "Enhanced visual cues and clear closed-captions")}</span>
                            </div>
                            {accessibility === "hearing_assistance" && <Check size={20} className={styles.checkIcon} />}
                        </button>

                        {/* Option E: Indian Sign Language */}
                        <button
                            type="button"
                            className={`${styles.optionCard} ${accessibility === "sign_language" ? styles.optionCardSelected : ""}`}
                            onClick={() => {
                                setAccessibility("sign_language");
                                setIslActive(true);
                                setIslEnabled(true);
                            }}
                            data-testid="settings-opt-sign-language"
                        >
                            <div className={styles.iconCircle}>
                                <Sparkles size={22} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t("accessibility.indianSignLanguage", "Indian Sign Language")}</span>
                                <span className={styles.optionDesc}>{t("accessibility.indianSignLanguageDesc", "Show a 3D avatar that signs instructions and information")}</span>
                            </div>
                            {accessibility === "sign_language" && <Check size={20} className={styles.checkIcon} />}
                        </button>
                    </div>

                    {/* Independent Assistance Addon: Indian Sign Language (3D Avatar) */}
                    <div className={styles.addonSection} data-testid="settings-isl-addon-section">
                        <div className={styles.addonHeader}>
                            <div className={styles.addonIconCircle}>
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <div className={styles.addonTitle}>Indian Sign Language (3D Avatar)</div>
                                <div className={styles.addonDesc}>Display a persistent 3D avatar at the bottom-right that signs instructions and questions</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={islActive}
                            aria-pressed={islActive}
                            className={`${styles.toggleSwitch} ${islActive ? styles.toggleSwitchActive : ""}`}
                            onClick={() => {
                                const next = !islActive;
                                setIslActive(next);
                                setIslEnabled(next);
                                if (next && accessibility === "none") {
                                    setAccessibility("sign_language");
                                } else if (!next && accessibility === "sign_language") {
                                    setAccessibility("none");
                                }
                            }}
                            aria-label="Toggle Indian Sign Language Avatar"
                            data-testid="settings-isl-toggle"
                        >
                            <span className={styles.toggleKnob} />
                        </button>
                    </div>
                </motion.section>

                {/* SECTION 4: LANGUAGE & REGION */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                >
                    <div className={styles.cardHeader}>
                        <Globe className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Language Preferences</h2>
                            <p>Select your default kiosk display & voice language</p>
                        </div>
                    </div>

                    <div className={styles.langGrid}>
                        {SUPPORTED_LANGUAGES.map((lang) => {
                            const isSelected = selectedLanguage === lang.code;
                            return (
                                <button
                                    key={lang.code}
                                    type="button"
                                    className={`${styles.langCard} ${isSelected ? styles.langCardSelected : ""}`}
                                    onClick={() => handleLanguageChange(lang.code)}
                                >
                                    <span className={styles.langNative}>{lang.nativeName}</span>
                                    <span className={styles.langEnglish}>{lang.name}</span>
                                    {isSelected && <Check size={16} className={styles.langCheck} />}
                                </button>
                            );
                        })}
                    </div>
                </motion.section>

                {/* SECTION 5: NOTIFICATIONS & ALERTS */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                >
                    <div className={styles.cardHeader}>
                        <Bell className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Notifications & Reminders</h2>
                            <p>Manage how and when you receive medical alerts and consultation updates</p>
                        </div>
                    </div>

                    <div className={styles.toggleList}>
                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleTitle}>WhatsApp Notifications</span>
                                <p className={styles.toggleDesc}>Receive prescription PDFs and appointment passes directly on WhatsApp</p>
                            </div>
                            <input
                                type="checkbox"
                                className={styles.toggleInput}
                                checked={notifications.whatsapp}
                                onChange={(e) => setNotifications(prev => ({ ...prev, whatsapp: e.target.checked }))}
                            />
                        </div>

                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleTitle}>Appointment Reminders</span>
                                <p className={styles.toggleDesc}>Get reminders 1 hour before scheduled teleconsultations</p>
                            </div>
                            <input
                                type="checkbox"
                                className={styles.toggleInput}
                                checked={notifications.appointmentReminders}
                                onChange={(e) => setNotifications(prev => ({ ...prev, appointmentReminders: e.target.checked }))}
                            />
                        </div>

                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleTitle}>Email Summaries</span>
                                <p className={styles.toggleDesc}>Receive digital copies of completed clinical intake assessments</p>
                            </div>
                            <input
                                type="checkbox"
                                className={styles.toggleInput}
                                checked={notifications.email}
                                onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                            />
                        </div>
                    </div>
                </motion.section>

                {/* SECTION 6: PRIVACY & SECURITY */}
                <motion.section
                    className={styles.card}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.25 }}
                >
                    <div className={styles.cardHeader}>
                        <Shield className={styles.cardIcon} size={22} />
                        <div>
                            <h2>Privacy & Security</h2>
                            <p>Control your data permissions and healthcare privacy</p>
                        </div>
                    </div>

                    <div className={styles.toggleList}>
                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleTitle}>Doctor Records Access</span>
                                <p className={styles.toggleDesc}>Allow attending doctors to view your past medical history and ABHA profile</p>
                            </div>
                            <input
                                type="checkbox"
                                className={styles.toggleInput}
                                checked={privacy.allowDoctorAccess}
                                onChange={(e) => setPrivacy(prev => ({ ...prev, allowDoctorAccess: e.target.checked }))}
                            />
                        </div>

                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleTitle}>Anonymous Quality Analytics</span>
                                <p className={styles.toggleDesc}>Share anonymized voice transcription logs to improve AI accuracy</p>
                            </div>
                            <input
                                type="checkbox"
                                className={styles.toggleInput}
                                checked={privacy.shareAnalytics}
                                onChange={(e) => setPrivacy(prev => ({ ...prev, shareAnalytics: e.target.checked }))}
                            />
                        </div>
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
