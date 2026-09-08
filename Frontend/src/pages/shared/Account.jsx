import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  Bell, 
  CheckCircle, 
  Sliders, 
  Globe, 
  Save, 
  X, 
  Send, 
  KeyRound, 
  Check, 
  MessageSquare,
  Copy,
  AlertCircle,
  Clock,
  RefreshCw 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { SUPPORTED_LANGUAGES, INDIAN_STATES_AND_UTS } from "../../constants/onboardingData";
import { 
  requestPhoneLink, 
  verifyPhoneLink, 
  updatePatientProfile,
  generateWhatsAppToken,
  getWhatsAppMe,
  unlinkWhatsApp
} from "../../services/api";
import styles from "./Account.module.css";


export default function Account() {
  const { user, token, refreshUser } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const location = useLocation();
  const whatsappCardRef = useRef(null);

  // Personal Info Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");

  // Onboarding Preferences Form State
  const [stateName, setStateName] = useState("");
  const [prefLanguage, setPrefLanguage] = useState("en");
  const [interactionMode, setInteractionMode] = useState("voice_touch");
  const [accessibility, setAccessibility] = useState("none");

  // Feedback State
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Phone Linking Modal / Flow State
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1); // 1: Input Phone, 2: Enter OTP
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [mockOtpHint, setMockOtpHint] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // WhatsApp Linking State
  const [whatsappInfo, setWhatsappInfo] = useState({ linked: false, whatsappId: null });
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappExpiresAt, setWhatsappExpiresAt] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [whatsappError, setWhatsappError] = useState("");
  const [unlinking, setUnlinking] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  // Scroll to WhatsApp card if navigated via /account/link-whatsapp or /account/whatsapp
  useEffect(() => {
    if (location.pathname.includes("whatsapp") || location.search.includes("whatsapp")) {
      setTimeout(() => {
        whatsappCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [location.pathname, location.search]);

  // Fetch WhatsApp linking status on mount / token change
  useEffect(() => {
    if (token) {
      getWhatsAppMe(token)
        .then((res) => {
          if (res?.linked) {
            setWhatsappInfo({ linked: true, whatsappId: res.whatsapp_id });
          } else {
            setWhatsappInfo({ linked: false, whatsappId: null });
          }
        })
        .catch(() => {});
    }
  }, [token]);

  // Live Countdown Timer for Token Expiration
  useEffect(() => {
    if (!whatsappExpiresAt) {
      setTimeLeft("");
      setIsExpired(false);
      return;
    }

    const updateTimer = () => {
      const remainingMs = new Date(whatsappExpiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const totalSecs = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [whatsappExpiresAt]);

  const formattedExpiryTime = useMemo(() => {
    if (!whatsappExpiresAt) return "";
    try {
      return new Date(whatsappExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [whatsappExpiresAt]);

  const handleGenerateWhatsAppToken = async () => {
    try {
      setTokenLoading(true);
      setWhatsappError("");
      const res = await generateWhatsAppToken(token);
      if (res?.success && res?.token) {
        setWhatsappToken(res.token);
        setWhatsappExpiresAt(res.expiresAt);
        setTokenCopied(false);
      } else {
        setWhatsappError(res?.message || "Unable to generate token. Please try again in a moment.");
      }
    } catch (err) {
      if (err?.status === 401) {
        setWhatsappError("Your session has expired. Please log in again.");
      } else if (err?.message?.includes("Network error") || err?.message?.includes("Failed to fetch")) {
        setWhatsappError("Server connection timeout. Please check your network or try again in a moment.");
      } else {
        setWhatsappError("Unable to generate token. Please try again in a moment.");
      }
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyWhatsAppToken = () => {
    if (whatsappToken) {
      navigator.clipboard.writeText(whatsappToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2500);
    }
  };

  const handleConfirmUnlink = async () => {
    try {
      setUnlinking(true);
      setWhatsappError("");
      const res = await unlinkWhatsApp(token);
      if (res?.success) {
        setWhatsappInfo({ linked: false, whatsappId: null });
        setWhatsappToken("");
        setWhatsappExpiresAt(null);
        setShowUnlinkModal(false);
        setFeedback({ type: "success", text: "WhatsApp account unlinked successfully." });
      } else {
        setWhatsappError(res?.message || "Failed to unlink WhatsApp account.");
      }
    } catch (err) {
      setWhatsappError("Unable to unlink WhatsApp account. Please try again.");
    } finally {
      setUnlinking(false);
    }
  };

  // Sync state with authenticated user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      if (user.profile?.dateOfBirth) {
        // Format YYYY-MM-DD for date input
        const dob = new Date(user.profile.dateOfBirth).toISOString().split("T")[0];
        setDateOfBirth(dob);
      }
      setGender(user.profile?.gender || "");

      if (user.onboarding) {
        setStateName(user.onboarding.state || "");
        setPrefLanguage(user.onboarding.preferredLanguage || language || "en");
        setInteractionMode(user.onboarding.interactionMode || "voice_touch");
        setAccessibility(user.onboarding.accessibilityPreference || "none");
      }
    }
  }, [user, language]);

  // Compute initials for profile card avatar
  const initials = (() => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "P";
  })();

  // Save Personal Info
  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    setFeedback(null);
    try {
      await updatePatientProfile(
        {
          firstName,
          lastName,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
        },
        token
      );
      await refreshUser();
      setFeedback({ type: "success", text: t("account.savedSuccess") });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSavingPersonal(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPref(true);
    setFeedback(null);
    try {
      await updatePatientProfile(
        {
          state: stateName,
          preferredLanguage: prefLanguage,
          interactionMode,
          accessibilityPreference: accessibility,
        },
        token
      );
      if (prefLanguage) {
        changeLanguage(prefLanguage);
      }
      await refreshUser();
      setFeedback({ type: "success", text: t("account.savedSuccess") });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to update preferences." });
    } finally {
      setSavingPref(false);
    }
  };

  // Initiate Phone Link OTP Request
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setPhoneError("");
    setPhoneLoading(true);
    try {
      const res = await requestPhoneLink(phoneInput, token);
      setVerificationId(res.verificationId);
      if (res.mockOtp) {
        setMockOtpHint(res.mockOtp);
      }
      setPhoneStep(2);
    } catch (err) {
      setPhoneError(err.message || "Failed to send OTP.");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Verify Phone Link OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await verifyPhoneLink(verificationId, otpInput, token);
      await refreshUser();
      setShowPhoneModal(false);
      setPhoneStep(1);
      setPhoneInput("");
      setOtpInput("");
      setFeedback({ type: "success", text: t("account.phoneLinked") });
    } catch (err) {
      setPhoneError(err.message || "OTP verification failed.");
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>{t("account.title")}</h1>
          <p className={styles.headerSubtitle}>
            {t("account.subtitle")}
          </p>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={feedback.type === "success" ? styles.bannerSuccess : styles.bannerError}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {feedback.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className={styles.mainGrid}>
          {/* Left Sidebar / Quick Profile Card */}
          <div className={styles.profileSidebarCard}>
            <div className={styles.avatarCircle}>{initials}</div>
            <h3 className={styles.profileName}>
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Patient Account"}
            </h3>
            <p className={styles.profileSubtitle}>{user?.role || "patient"} Account</p>

            <div className={styles.divider} />

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <Mail size={16} style={{ color: "#64748b" }} />
                <span>{user?.email || "No email linked"}</span>
              </div>
              <div className={styles.infoItem} style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Phone size={16} style={{ color: "#64748b" }} />
                  <span>{user?.phone || "No phone linked"}</span>
                </div>
                {user?.phoneVerified ? (
                  <span className={styles.verifiedBadge}>
                    <Check size={12} /> Verified
                  </span>
                ) : (
                  <span className={styles.unverifiedBadge}>Not Linked</span>
                )}
              </div>
              <div className={styles.infoItem} style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <MessageSquare size={16} style={{ color: "#16a34a" }} />
                  <span>{whatsappInfo.linked ? (whatsappInfo.whatsappId || "WhatsApp Linked") : "WhatsApp"}</span>
                </div>
                {whatsappInfo.linked ? (
                  <span className={styles.verifiedBadge}>
                    <Check size={12} /> Connected
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => whatsappCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={styles.unverifiedBadge}
                    style={{ cursor: "pointer", border: "1px solid #fed7aa", background: "#fff7ed" }}
                  >
                    Link WhatsApp
                  </button>
                )}
              </div>
              <div className={styles.infoItem}>
                <MapPin size={16} style={{ color: "#64748b" }} />
                <span>
                  {user?.onboarding?.state ? `${user.onboarding.state}, India` : "India"}
                </span>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className={styles.rightContent}>
            {/* Personal Information Card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  <User size={20} />
                </div>
                <h3 className={styles.cardTitle}>{t("account.personalInfo")}</h3>
              </div>

              <form onSubmit={handleSavePersonal}>
                <div className={styles.formGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.firstName")}</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Rahul"
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.lastName")}</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Sharma"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.dateOfBirth")}</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.gender")}</label>
                    <select
                      className={styles.select}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className={styles.saveBtn} disabled={savingPersonal}>
                  <Save size={16} />
                  {savingPersonal ? t("account.saving") : t("account.saveChanges")}
                </button>
              </form>
            </div>

            {/* Onboarding Preferences Card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  <Sliders size={20} />
                </div>
                <h3 className={styles.cardTitle}>{t("account.preferences")}</h3>
              </div>

              <form onSubmit={handleSavePreferences}>
                <div className={styles.formGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.state")}</label>
                    <select
                      className={styles.select}
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                    >
                      <option value="">Select State or UT</option>
                      {INDIAN_STATES_AND_UTS.map((st) => (
                        <option key={st.name} value={st.name}>
                          {st.name} ({st.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.preferredLanguage")}</label>
                    <select
                      className={styles.select}
                      value={prefLanguage}
                      onChange={(e) => setPrefLanguage(e.target.value)}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.interactionMode")}</label>
                    <select
                      className={styles.select}
                      value={interactionMode}
                      onChange={(e) => setInteractionMode(e.target.value)}
                    >
                      <option value="voice_touch">Voice + Touch (Recommended)</option>
                      <option value="touch">Touch Screen Only</option>
                      <option value="voice">Voice Interaction Only</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{t("account.accessibility")}</label>
                    <select
                      className={styles.select}
                      value={accessibility}
                      onChange={(e) => setAccessibility(e.target.value)}
                    >
                      <option value="none">Standard / No Assistance</option>
                      <option value="large_text">Large High-Contrast Text</option>
                      <option value="voice_guidance">Voice Guidance Prompts</option>
                      <option value="hearing_assistance">Visual Hearing Support</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className={styles.saveBtn} disabled={savingPref}>
                  <Globe size={16} />
                  {savingPref ? t("account.saving") : t("account.saveChanges")}
                </button>
              </form>
            </div>

            {/* Phone Verification & Security Card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  <Phone size={20} />
                </div>
                <h3 className={styles.cardTitle}>{t("account.linkPhone")}</h3>
              </div>

              <div className={styles.phoneStatusRow}>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a" }}>
                    {user?.phone ? user.phone : "No phone number linked"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {user?.phoneVerified
                      ? t("account.phoneLinked")
                      : "Link a 10-digit Indian phone number with OTP to enable SMS notifications."}
                  </div>
                </div>

                <button
                  className={styles.linkPhoneBtn}
                  onClick={() => {
                    setShowPhoneModal(true);
                    setPhoneStep(1);
                    setPhoneError("");
                    setPhoneInput(user?.phone || "");
                  }}
                >
                  {user?.phone ? "Change Number" : t("account.linkPhone")}
                </button>
              </div>
            </div>

            {/* Link WhatsApp Card */}
            <div
              ref={whatsappCardRef}
              className={styles.card}
              style={{
                border: location.pathname.includes("whatsapp") ? "2px solid #16a34a" : "1px solid #e2e8f0",
                transition: "border 0.3s ease"
              }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper} style={{ background: "#dcfce7", color: "#16a34a" }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className={styles.cardTitle}>Link WhatsApp</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    Connect your MediKiosk account to WhatsApp so you can use MediKiosk directly from WhatsApp.
                  </p>
                </div>
              </div>

              {whatsappInfo.linked ? (
                <div style={{ marginTop: "14px", padding: "20px", background: "#f0fdf4", borderRadius: "14px", border: "1px solid #bbf7d0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ background: "#dcfce7", color: "#16a34a", padding: "8px", borderRadius: "10px", marginTop: "2px" }}>
                        <CheckCircle size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "16px", color: "#166534" }}>
                          ✅ WhatsApp Connected
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#15803d" }}>
                          Your MediKiosk account is already linked to WhatsApp: <strong>{whatsappInfo.whatsappId}</strong>
                        </p>
                        <div style={{ marginTop: "12px", fontSize: "13px", color: "#334155", background: "#ffffff", padding: "12px 16px", borderRadius: "10px", border: "1px solid #bbf7d0", lineHeight: "1.6" }}>
                          📱 You can now use MediKiosk directly through WhatsApp.
                          <br />
                          Send <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", color: "#0f172a" }}>hello medikiosk</code> to start.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowUnlinkModal(true)}
                      disabled={unlinking}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#dc2626",
                        background: "#ffffff",
                        border: "1px solid #fca5a5",
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      {unlinking ? "Unlinking..." : "Unlink WhatsApp"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "14px" }}>
                  {/* Error Notification */}
                  {whatsappError && (
                    <div className={styles.bannerError} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <AlertCircle size={16} />
                      <span>❌ {whatsappError}</span>
                    </div>
                  )}

                  {!whatsappToken ? (
                    <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                            🔗 WhatsApp Account
                          </div>
                          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                            Generate a temporary, one-time linking token to connect your WhatsApp number.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateWhatsAppToken}
                          disabled={tokenLoading}
                          className={styles.linkPhoneBtn}
                          style={{ background: "#16a34a", display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px" }}
                        >
                          {tokenLoading ? (
                            <>
                              <RefreshCw size={15} className={styles.spinning} /> Generating Token...
                            </>
                          ) : (
                            <>
                              <MessageSquare size={15} /> Link WhatsApp
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "#f8fafc", padding: "22px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", marginBottom: "4px" }}>
                        <KeyRound size={18} style={{ color: "#16a34a" }} />
                        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>🔐 WhatsApp Linking Token</h4>
                      </div>
                      <p style={{ margin: "4px 0 14px 0", fontSize: "13px", color: "#64748b" }}>
                        Your temporary linking code is:
                      </p>

                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                        <div style={{
                          fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
                          fontSize: "26px",
                          fontWeight: "700",
                          letterSpacing: "6px",
                          padding: "10px 22px",
                          background: "#ffffff",
                          border: isExpired ? "2px dashed #dc2626" : "2px dashed #16a34a",
                          borderRadius: "12px",
                          color: isExpired ? "#dc2626" : "#16a34a",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                          {whatsappToken}
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyWhatsAppToken}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "11px 18px",
                            borderRadius: "10px",
                            border: "none",
                            background: tokenCopied ? "#16a34a" : "#0f172a",
                            color: "#ffffff",
                            fontWeight: "600",
                            fontSize: "13px",
                            cursor: "pointer",
                            transition: "background 0.2s"
                          }}
                        >
                          {tokenCopied ? <Check size={16} /> : <Copy size={16} />}
                          {tokenCopied ? "Copied!" : "📋 Copy Token"}
                        </button>

                        <button
                          type="button"
                          onClick={handleGenerateWhatsAppToken}
                          disabled={tokenLoading}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "11px 16px",
                            borderRadius: "10px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#334155",
                            fontWeight: "600",
                            fontSize: "13px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <RefreshCw size={14} className={tokenLoading ? styles.spinning : ""} />
                          🔄 Generate New Token
                        </button>
                      </div>

                      {/* Expiration Timer Indicator */}
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: isExpired ? "#dc2626" : "#0f766e",
                        background: isExpired ? "#fee2e2" : "#ccfbf1",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        marginBottom: "16px"
                      }}>
                        <Clock size={14} />
                        {isExpired ? (
                          <span>⚠️ Token expired at {formattedExpiryTime}. Please click "Generate New Token" above.</span>
                        ) : (
                          <span>⏱️ Valid for {timeLeft || "10:00"} {formattedExpiryTime ? `(Expires at ${formattedExpiryTime})` : ""}</span>
                        )}
                      </div>

                      {/* Next Steps Instructions */}
                      <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a", marginBottom: "8px" }}>
                          📱 Next steps
                        </div>
                        <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.7" }}>
                          <li>1️⃣ Open WhatsApp.</li>
                          <li>2️⃣ Open the MediKiosk chat.</li>
                          <li>
                            3️⃣ Send: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", color: "#0f172a" }}>hello medikiosk</code>
                          </li>
                          <li>4️⃣ When prompted, send the token above.</li>
                        </ol>
                        <div style={{ marginTop: "12px", fontSize: "12px", color: "#b45309", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>⚠️</span>
                          <span>Do not share this token with anyone.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Security & Notifications Cards */}
            <div className={styles.formGrid}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconWrapper} style={{ background: "#e0e7ff", color: "#4f46e5" }}>
                    <Shield size={20} />
                  </div>
                  <h3 className={styles.cardTitle}>Security</h3>
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                  Manage your account security and authentication method.
                </p>
                <button
                  style={{
                    width: "100%",
                    background: "transparent",
                    color: "#0f172a",
                    padding: "10px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                  onClick={() => alert("Password changes are managed via your login provider (Google / OTP).")}
                >
                  Change Password
                </button>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconWrapper} style={{ background: "#fef3c7", color: "#d97706" }}>
                    <Bell size={20} />
                  </div>
                  <h3 className={styles.cardTitle}>Notifications</h3>
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                  Manage SMS and email alerts for clinical appointments.
                </p>
                <button
                  style={{
                    width: "100%",
                    background: "#f1f5f9",
                    color: "#64748b",
                    padding: "10px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    border: "none",
                    fontSize: "13px",
                    cursor: "not-allowed"
                  }}
                  disabled
                >
                  Manage Preferences (Coming Soon)
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Phone OTP Linking Modal */}
      <AnimatePresence>
        {showPhoneModal && (
          <div className={styles.modalBackdrop} onClick={() => setShowPhoneModal(false)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
                  {phoneStep === 1 ? "Link Phone Number" : "Enter Verification Code"}
                </h3>
                <button
                  onClick={() => setShowPhoneModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>

              {phoneError && (
                <div className={styles.bannerError} style={{ marginBottom: "14px" }}>
                  {phoneError}
                </div>
              )}

              {phoneStep === 1 ? (
                <form onSubmit={handleRequestOtp}>
                  <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                    Enter your 10-digit Indian mobile number to receive a verification OTP.
                  </p>
                  <div className={styles.fieldGroup} style={{ marginBottom: "20px" }}>
                    <label className={styles.label}>Phone Number</label>
                    <input
                      type="tel"
                      className={styles.input}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setShowPhoneModal(false)}
                      style={{ background: "#e2e8f0", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.linkPhoneBtn}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? "Sending OTP..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                    We sent a 6-digit OTP code to <strong>{phoneInput}</strong>.
                  </p>
                  {mockOtpHint && (
                    <div style={{ fontSize: "12px", background: "#fef3c7", color: "#92400e", padding: "6px 10px", borderRadius: "8px", marginBottom: "14px" }}>
                      🔑 Dev Mock OTP: <strong>{mockOtpHint}</strong>
                    </div>
                  )}
                  <div className={styles.fieldGroup} style={{ marginBottom: "20px" }}>
                    <label className={styles.label}>Verification Code</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setPhoneStep(1)}
                      style={{ background: "none", border: "none", color: "#0d9488", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                    >
                      Change Number
                    </button>
                    <button
                      type="submit"
                      className={styles.linkPhoneBtn}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? "Verifying..." : "Verify & Link"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp Unlink Confirmation Modal */}
      <AnimatePresence>
        {showUnlinkModal && (
          <div className={styles.modalBackdrop} onClick={() => setShowUnlinkModal(false)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "420px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px", borderRadius: "10px" }}>
                  <AlertCircle size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                  ⚠️ Unlink WhatsApp?
                </h3>
              </div>
              <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.5", margin: "0 0 20px 0" }}>
                This will disconnect your WhatsApp account from MediKiosk.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowUnlinkModal(false)}
                  disabled={unlinking}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnlink}
                  disabled={unlinking}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  {unlinking ? "Unlinking..." : "Unlink"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
