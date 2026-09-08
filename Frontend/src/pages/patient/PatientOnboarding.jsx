import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import {
    SUPPORTED_LANGUAGES,
    INDIAN_STATES_AND_UTS,
    getRecommendedLanguageForState
} from "../../constants/onboardingData";
import {
    Sparkles,
    Search,
    ChevronRight,
    ArrowLeft,
    Mic,
    MousePointer,
    Sliders,
    Eye,
    Volume2,
    EyeOff,
    CheckCircle2,
    HeartPulse
} from "lucide-react";
import toast from "react-hot-toast";
import { savePatientOnboarding } from "../../services/api";
import styles from "./PatientOnboarding.module.css";

export default function PatientOnboarding() {
    const { user } = useAuth();
    const { language, changeLanguage, t } = useLanguage();
    const navigate = useNavigate();

    // Step state: 1: State/UT, 2: Language, 3: Interaction, 4: Accessibility
    const [step, setStep] = useState(1);

    // Onboarding Selections
    const [selectedState, setSelectedState] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState(language || "en");
    const [interactionMode, setInteractionMode] = useState("voice_touch");
    const [accessibility, setAccessibility] = useState("none");

    // UI States
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState("");

    // Filter states/UTs based on search input
    const filteredStates = useMemo(() => {
        if (!searchQuery.trim()) return INDIAN_STATES_AND_UTS;
        const q = searchQuery.toLowerCase();
        return INDIAN_STATES_AND_UTS.filter((item) =>
            item.name.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // Recommended language for the currently selected state
    const recommendedLangCode = useMemo(() => {
        return getRecommendedLanguageForState(selectedState);
    }, [selectedState]);

    // Handle State Selection
    const handleSelectState = (stateName) => {
        setSelectedState(stateName);
        setError("");
        
        // Auto-recommend corresponding language for Step 2
        const rec = getRecommendedLanguageForState(stateName);
        if (rec) {
            setSelectedLanguage(rec);
        }
    };

    // Handle Language Selection (immediate live UI language change)
    const handleSelectLanguage = (langCode) => {
        setSelectedLanguage(langCode);
        changeLanguage(langCode);
        setError("");
    };

    // Handle Navigation Next
    const handleNext = () => {
        if (step === 1 && !selectedState) {
            setError(t("onboarding.selectStateError"));
            return;
        }
        if (step === 2 && !selectedLanguage) {
            setError(t("onboarding.selectLanguageError"));
            return;
        }
        if (step === 3 && !interactionMode) {
            setError(t("onboarding.selectInteractionError"));
            return;
        }
        if (step === 4 && !accessibility) {
            setError(t("onboarding.selectAccessibilityError"));
            return;
        }

        setError("");
        if (step < 4) {
            setStep((prev) => prev + 1);
        } else {
            handleComplete();
        }
    };

    // Handle Back
    const handleBack = () => {
        setError("");
        if (step > 1) {
            setStep((prev) => prev - 1);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { token, refreshUser } = useAuth();

    // Finalize Onboarding via Backend API
    const handleComplete = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                state: selectedState,
                preferred_language: selectedLanguage,
                interaction_mode: interactionMode,
                accessibility_preference: accessibility
            };

            // Call backend endpoint PATCH /api/patient/profile/onboarding
            await savePatientOnboarding(payload, token);

            // Also keep UI language in sync
            localStorage.setItem("medikiosk_language", selectedLanguage);

            if (accessibility === "large_text") {
                document.body.classList.add("larger-text-mode");
            } else {
                document.body.classList.remove("larger-text-mode");
            }

            // Refresh user context so onboarding.completed becomes true
            await refreshUser();

            toast.success(t("onboarding.completedTitle"));
            navigate("/patient/dashboard");
        } catch (err) {
            console.error("Failed to save onboarding preferences:", err);
            toast.error(err.message || "Failed to save onboarding preferences. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.bgBlob1} />
            <div className={styles.bgBlob2} />

            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                {/* Header & Progress Bar */}
                <div className={styles.header}>
                    <div className={styles.brandRow}>
                        <div className={styles.brandName}>
                            <HeartPulse size={26} color="var(--color-teal)" />
                            <span>MediKiosk</span>
                            <span className={styles.brandBadge}>Patient Care</span>
                        </div>
                        <span className={styles.stepIndicator}>
                            {t("common.step")} {step} {t("common.of")} 4
                        </span>
                    </div>

                    <div className={styles.progressBarTrack}>
                        <div
                            className={styles.progressBarFill}
                            style={{ width: `${(step / 4) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className={styles.contentArea}>
                    <AnimatePresence mode="wait">
                        {/* STEP 1: STATE / UT SELECTION */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
                            >
                                <div>
                                    <h2 className={styles.stepTitle}>{t("onboarding.stateTitle")}</h2>
                                    <p className={styles.stepSubtitle}>{t("onboarding.stateSubtitle")}</p>
                                </div>

                                <div className={styles.searchBox}>
                                    <Search size={18} className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        className={styles.searchInput}
                                        placeholder={t("onboarding.statePlaceholder")}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className={styles.stateGrid}>
                                    {filteredStates.map((item) => {
                                        const isSelected = selectedState === item.name;
                                        return (
                                            <button
                                                key={item.name}
                                                type="button"
                                                className={`${styles.stateCard} ${isSelected ? styles.stateCardSelected : ""}`}
                                                onClick={() => handleSelectState(item.name)}
                                            >
                                                <span className={styles.stateName}>{item.name}</span>
                                                <span className={styles.stateType}>{item.type}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: PREFERRED LANGUAGE SELECTION */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
                            >
                                <div>
                                    <h2 className={styles.stepTitle}>{t("onboarding.languageTitle")}</h2>
                                    <p className={styles.stepSubtitle}>{t("onboarding.languageSubtitle")}</p>
                                </div>

                                <div className={styles.langGrid}>
                                    {SUPPORTED_LANGUAGES.map((lang) => {
                                        const isSelected = selectedLanguage === lang.code;
                                        const isRecommended = recommendedLangCode === lang.code;

                                        return (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                className={`${styles.langCard} ${isSelected ? styles.langCardSelected : ""}`}
                                                onClick={() => handleSelectLanguage(lang.code)}
                                            >
                                                {isRecommended && (
                                                    <span className={styles.recBadge}>
                                                        {t("common.recommended")}
                                                    </span>
                                                )}
                                                <span className={styles.langNative}>{lang.nativeName}</span>
                                                <span className={styles.langEnglish}>{lang.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: INTERACTION PREFERENCE */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
                            >
                                <div>
                                    <h2 className={styles.stepTitle}>{t("onboarding.interactionTitle")}</h2>
                                    <p className={styles.stepSubtitle}>{t("onboarding.interactionSubtitle")}</p>
                                </div>

                                <div className={styles.optionsList}>
                                    {/* Option A: Voice + Touch (Recommended) */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${interactionMode === "voice_touch" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setInteractionMode("voice_touch"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <Sparkles size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <div className={styles.optionTitleRow}>
                                                <span className={styles.optionTitle}>{t("onboarding.voiceAndTouch")}</span>
                                                <span className={styles.recBadge}>{t("common.recommended")}</span>
                                            </div>
                                            <span className={styles.optionDesc}>{t("onboarding.voiceAndTouchDesc")}</span>
                                        </div>
                                    </button>

                                    {/* Option B: Voice Only */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${interactionMode === "voice" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setInteractionMode("voice"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <Mic size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.voiceOnly")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.voiceOnlyDesc")}</span>
                                        </div>
                                    </button>

                                    {/* Option C: Touch Only */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${interactionMode === "touch" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setInteractionMode("touch"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <MousePointer size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.touchOnly")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.touchOnlyDesc")}</span>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: ACCESSIBILITY PREFERENCE */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
                            >
                                <div>
                                    <h2 className={styles.stepTitle}>{t("onboarding.accessibilityTitle")}</h2>
                                    <p className={styles.stepSubtitle}>{t("onboarding.accessibilitySubtitle")}</p>
                                </div>

                                <div className={styles.optionsList}>
                                    {/* Option A: Standard */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${accessibility === "none" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setAccessibility("none"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <Sliders size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.noAssistance")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.noAssistanceDesc")}</span>
                                        </div>
                                    </button>

                                    {/* Option B: Larger Text */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${accessibility === "large_text" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setAccessibility("large_text"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <Eye size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.largerText")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.largerTextDesc")}</span>
                                        </div>
                                    </button>

                                    {/* Option C: Audio Voiceover */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${accessibility === "voice_guidance" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setAccessibility("voice_guidance"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <Volume2 size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.voiceGuidance")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.voiceGuidanceDesc")}</span>
                                        </div>
                                    </button>

                                    {/* Option D: Hearing / Visual Highlights */}
                                    <button
                                        type="button"
                                        className={`${styles.optionCard} ${accessibility === "hearing_assistance" ? styles.optionCardSelected : ""}`}
                                        onClick={() => { setAccessibility("hearing_assistance"); setError(""); }}
                                    >
                                        <div className={styles.iconCircle}>
                                            <EyeOff size={24} />
                                        </div>
                                        <div className={styles.optionText}>
                                            <span className={styles.optionTitle}>{t("onboarding.hearingAssistance")}</span>
                                            <span className={styles.optionDesc}>{t("onboarding.hearingAssistanceDesc")}</span>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && <div className={styles.errorMessage}>{error}</div>}
                </div>

                {/* Footer Buttons */}
                <div className={styles.footer}>
                    {step > 1 ? (
                        <button type="button" className={styles.btnBack} onClick={handleBack}>
                            <ArrowLeft size={16} style={{ display: "inline", marginRight: "6px" }} />
                            {t("common.back")}
                        </button>
                    ) : (
                        <div />
                    )}

                    <button
                        type="button"
                        className={styles.btnNext}
                        onClick={handleNext}
                    >
                        {step === 4 ? t("common.finish") : t("common.continue")}
                        <ChevronRight size={18} />
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
