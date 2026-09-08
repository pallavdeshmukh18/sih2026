import React, { useState, useEffect } from "react";
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
  AlertCircle 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { SUPPORTED_LANGUAGES, INDIAN_STATES_AND_UTS } from "../../constants/onboardingData";
import { requestPhoneLink, verifyPhoneLink, updatePatientProfile } from "../../services/api";
import styles from "./Account.module.css";

export default function Account() {
  const { user, token, refreshUser } = useAuth();
  const { language, changeLanguage, t } = useLanguage();

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
    </div>
  );
}
