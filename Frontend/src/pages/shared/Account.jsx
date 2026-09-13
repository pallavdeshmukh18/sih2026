import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, Camera, Check, CheckCircle, Clock, Copy, ExternalLink, KeyRound,
  Mail, MapPin, MessageSquare, Pencil, Phone, RefreshCw, Save, ShieldCheck, X
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { INDIAN_STATES_AND_UTS, SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import {
  generateWhatsAppToken, getWhatsAppMe, unlinkWhatsApp,
  requestPhoneLink, updatePatientProfile, verifyPhoneLink, uploadProfilePhoto
} from "../../services/api";
import { transliterateName } from "../../utils/transliterate";
import accountBanner from "../../assets/patient-gateway-banner.png";
import styles from "./Account.module.css";

const MEDIKIOSK_WHATSAPP_LINK = "https://wa.me/919579543836?text=hello%20medikiosk";

export default function Account() {
  const { user, token, refreshUser } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const location = useLocation();
  const whatsappCardRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(user?.profilePhotoUrl || "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    dateOfBirth: user?.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split("T")[0] : "",
    gender: user?.profile?.gender || "",
    state: user?.onboarding?.state || "",
    preferredLanguage: user?.onboarding?.preferredLanguage || user?.preferredLanguage || language || "en",
    interactionMode: user?.onboarding?.interactionMode || "voice_touch",
    accessibilityPreference: user?.onboarding?.accessibilityPreference || "none",
  }));
  const [phoneModal, setPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  // WhatsApp Linking State
  const [whatsappInfo, setWhatsappInfo] = useState({ linked: false, whatsappId: null, linkedAt: null });
  const [whatsappLoading, setWhatsappLoading] = useState(true);
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
      const timer = setTimeout(() => {
        whatsappCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.search]);

  // Fetch WhatsApp linking status on mount / token change
  useEffect(() => {
    if (token) {
      setWhatsappLoading(true);
      getWhatsAppMe(token)
        .then((res) => {
          if (res?.linked) {
            setWhatsappInfo({
              linked: true,
              whatsappId: res.whatsapp_id || res.whatsappId,
              linkedAt: res.linked_at || res.linkedAt,
            });
          } else {
            setWhatsappInfo({ linked: false, whatsappId: null, linkedAt: null });
          }
        })
        .catch(() => {
          setWhatsappInfo({ linked: false, whatsappId: null, linkedAt: null });
        })
        .finally(() => {
          setWhatsappLoading(false);
        });
    }
  }, [token]);

  // Live countdown timer for token expiration based on backend expiresAt
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
        setIsExpired(false);
      } else {
        const msg = res?.message || t("account.profileUpdateError", "Unable to generate token. Please try again.");
        setWhatsappError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err?.status === 401
        ? "Your session has expired. Please log in again."
        : (err?.message || "Unable to generate token. Please try again.");
      setWhatsappError(msg);
      toast.error(msg);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyWhatsAppToken = async () => {
    if (!whatsappToken || isExpired) return;
    try {
      await navigator.clipboard.writeText(whatsappToken);
      setTokenCopied(true);
      toast.success(t("account.tokenCopied", "Token copied to clipboard"));
      setTimeout(() => setTokenCopied(false), 2500);
    } catch {
      toast.error("Failed to copy token");
    }
  };

  const handleConfirmUnlink = async () => {
    try {
      setUnlinking(true);
      setWhatsappError("");
      const res = await unlinkWhatsApp(token);
      if (res?.success) {
        setWhatsappInfo({ linked: false, whatsappId: null, linkedAt: null });
        setWhatsappToken("");
        setWhatsappExpiresAt(null);
        setShowUnlinkModal(false);
        toast.success(t("account.whatsappUnlinked", "WhatsApp account unlinked successfully."));
      } else {
        const msg = res?.message || "Failed to unlink WhatsApp account.";
        setWhatsappError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err?.message || "Unable to unlink WhatsApp account. Please try again.";
      setWhatsappError(msg);
      toast.error(msg);
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    if (!editing && user) {
      setForm((prev) => ({
        ...prev,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        dateOfBirth: user?.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split("T")[0] : "",
        gender: user?.profile?.gender || "",
        state: user?.onboarding?.state || "",
        preferredLanguage: user?.onboarding?.preferredLanguage || user?.preferredLanguage || language || "en",
      }));
    }
  }, [user, language, editing]);

  useEffect(() => {
    setPhoto(user?.profilePhotoUrl || "");
  }, [user?.profilePhotoUrl]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const initials = `${user?.firstName?.[0] || "P"}${user?.lastName?.[0] || ""}`.toUpperCase();
  const rawFullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const fullName = rawFullName ? transliterateName(rawFullName, language) : t("account.patient", "Patient");
  const displayDate = user?.profile?.dateOfBirth
    ? new Date(user.profile.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : t("account.notProvided", "Not provided");

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updatePatientProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        state: form.state,
        preferredLanguage: form.preferredLanguage,
        interactionMode: form.interactionMode,
        accessibilityPreference: form.accessibilityPreference,
      }, token);
      changeLanguage(form.preferredLanguage);
      await refreshUser();
      setEditing(false);
      toast.success(t("account.profileUpdated", "Profile updated successfully."));
    } catch (error) {
      toast.error(error.message || t("account.profileUpdateError", "Unable to update your profile."));
    } finally {
      setSaving(false);
    }
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    setPhoneLoading(true);
    try {
      const response = await requestPhoneLink(phone, token);
      setVerificationId(response.verificationId);
      setMockOtp(response.mockOtp || "");
      setPhoneStep(2);
    } catch (error) {
      toast.error(error.message || t("account.otpSentError", "Unable to send OTP."));
    } finally {
      setPhoneLoading(false);
    }
  };

  const confirmOtp = async (event) => {
    event.preventDefault();
    setPhoneLoading(true);
    try {
      await verifyPhoneLink(verificationId, otp, token);
      await refreshUser();
      setPhoneModal(false);
      setPhoneStep(1);
      setOtp("");
      toast.success(t("account.phoneVerified", "Phone number verified."));
    } catch (error) {
      toast.error(error.message || t("account.otpFailed", "OTP verification failed."));
    } finally {
      setPhoneLoading(false);
    }
  };

  const openPhoneModal = () => {
    setPhone(user?.phone || "");
    setPhoneStep(1);
    setPhoneModal(true);
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photos must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const previousPhoto = photo;
    setPhoto(previewUrl);
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append("photo", file);

    try {
      const response = await uploadProfilePhoto(formData, token);
      if (response?.profilePhotoUrl) setPhoto(response.profilePhotoUrl);
      await refreshUser();
      toast.success("Profile photo updated successfully.");
    } catch (error) {
      setPhoto(previousPhoto);
      toast.error(error.message || "Failed to upload photo.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setPhotoUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className={`${styles.page} workspacePage`}>
      <header className={styles.hero}>
        <div>
          <span>{t("account.badge", "My account")}</span>
          <h1>{t("account.title", "Your Information")}</h1>
          <p>{t("account.subtitle", "Keep your details up to date for a smoother healthcare experience.")}</p>
        </div>
        <blockquote>{t("account.quote", "“A healthier you,\na brighter tomorrow.”")}</blockquote>
        <img src={accountBanner} alt="" aria-hidden="true" />
      </header>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <section className={styles.detailsCard}>
          <div className={styles.cardTitle}>
            <h2>{t("account.profileDetails", "Profile Details")}</h2>
            <button onClick={() => setEditing((value) => !value)}>
              {editing ? <X /> : <Pencil />}
              {editing ? t("account.cancel", "Cancel") : t("account.edit", "Edit")}
            </button>
          </div>

          <div className={styles.identity}>
            <div className={styles.avatar}>{photo ? <img src={photo} alt={fullName} /> : initials}</div>
            <div>
              <div className={styles.nameRow}>
                <h3>{fullName}</h3>
                <span>{user?.role === "patient" || !user?.role ? t("account.patient", "Patient") : user.role}</span>
              </div>
              <p>
                <Mail /> {user?.email || t("account.noEmail", "No email linked")}
                <i />
                <Phone /> {user?.phone || t("account.noPhone", "No phone linked")}
              </p>
              <p>
                <MapPin /> {user?.onboarding?.state ? `${user.onboarding.state}, India` : "India"}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.form key="edit" className={styles.editForm} onSubmit={saveProfile} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label>
                  {t("account.firstName", "First name")}
                  <input name="firstName" value={form.firstName} onChange={update} required />
                </label>
                <label>
                  {t("account.lastName", "Last name")}
                  <input name="lastName" value={form.lastName} onChange={update} />
                </label>
                <label>
                  {t("account.dob", "Date of birth")}
                  <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={update} />
                </label>
                <label>
                  {t("account.gender", "Gender")}
                  <select name="gender" value={form.gender} onChange={update}>
                    <option value="">{t("account.selectGender", "Select gender")}</option>
                    <option value="Male">{t("account.male", "Male")}</option>
                    <option value="Female">{t("account.female", "Female")}</option>
                    <option value="Other">{t("account.other", "Other")}</option>
                  </select>
                </label>
                <label>
                  {t("account.state", "State")}
                  <select name="state" value={form.state} onChange={update}>
                    <option value="">{t("account.selectState", "Select State or UT")}</option>
                    {INDIAN_STATES_AND_UTS.map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
                  </select>
                </label>
                <label>
                  {t("account.language", "Language")}
                  <select name="preferredLanguage" value={form.preferredLanguage} onChange={update}>
                    {SUPPORTED_LANGUAGES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} ({item.nativeName})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("account.interactionMode", "Interaction Mode")}
                  <select name="interactionMode" value={form.interactionMode} onChange={update}>
                    <option value="voice_touch">{t("account.voiceTouch", "Voice + Touch Screen")}</option>
                    <option value="voice">{t("account.voiceOnly", "Voice Only")}</option>
                    <option value="touch">{t("account.touchOnly", "Touch Screen Only")}</option>
                  </select>
                </label>
                <label>
                  {t("account.accessibilityPreference", "Accessibility Preference")}
                  <select name="accessibilityPreference" value={form.accessibilityPreference} onChange={update}>
                    <option value="none">{t("account.standardInterface", "Standard Interface")}</option>
                    <option value="large_text">{t("account.largerText", "Larger Text")}</option>
                    <option value="voice_guidance">{t("account.audioVoiceover", "Audio Voiceover")}</option>
                    <option value="hearing_assistance">{t("account.visualHighlights", "Visual Highlights")}</option>
                    <option value="sign_language">{t("account.indianSignLanguage", "Indian Sign Language")}</option>
                  </select>
                </label>
                <button className={styles.save} disabled={saving}>
                  <Save /> {saving ? t("account.saving", "Saving…") : t("account.saveChanges", "Save Changes")}
                </button>
              </motion.form>
            ) : (
              <motion.dl key="view" className={styles.information} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div>
                  <dt>{t("account.fullName", "Full Name")}</dt>
                  <dd>{fullName}</dd>
                </div>
                <div>
                  <dt>{t("account.dob", "Date of Birth")}</dt>
                  <dd>{displayDate}</dd>
                </div>
                <div>
                  <dt>{t("account.gender", "Gender")}</dt>
                  <dd>{user?.profile?.gender ? t(`account.${user.profile.gender.toLowerCase()}`, user.profile.gender) : t("account.notProvided", "Not provided")}</dd>
                </div>
                <div>
                  <dt>{t("account.phoneNumber", "Phone Number")}</dt>
                  <dd>
                    {user?.phone || t("account.notLinked", "Not linked")}
                    {user?.phoneVerified && <span><CheckCircle /> {t("account.verified", "Verified")}</span>}
                    <button onClick={openPhoneModal}>{user?.phone ? t("account.change", "Change") : t("account.linkPhone", "Link phone")}</button>
                  </dd>
                </div>
                <div>
                  <dt>{t("account.emailAddress", "Email Address")}</dt>
                  <dd>{user?.email || t("account.notLinked", "Not linked")}</dd>
                </div>
                <div>
                  <dt>{t("account.address", "Address")}</dt>
                  <dd>{user?.onboarding?.state ? `${user.onboarding.state}, India` : "India"}</dd>
                </div>
                <div>
                  <dt>{t("account.language", "Language")}</dt>
                  <dd>{SUPPORTED_LANGUAGES.find((item) => item.code === (user?.onboarding?.preferredLanguage || language))?.name || "English"}</dd>
                </div>
                <div>
                  <dt>{t("account.interactionMode", "Interaction Mode")}</dt>
                  <dd>{user?.onboarding?.interactionMode === "voice" ? t("account.voiceOnly", "Voice Only") : user?.onboarding?.interactionMode === "touch" ? t("account.touchOnly", "Touch Screen Only") : t("account.voiceTouch", "Voice + Touch Screen")}</dd>
                </div>
                <div>
                  <dt>{t("account.accessibilityPreference", "Accessibility Preference")}</dt>
                  <dd>{user?.onboarding?.accessibilityPreference === "large_text" ? t("account.largerText", "Larger Text") : user?.onboarding?.accessibilityPreference === "voice_guidance" ? t("account.audioVoiceover", "Audio Voiceover") : user?.onboarding?.accessibilityPreference === "hearing_assistance" ? t("account.visualHighlights", "Visual Highlights") : user?.onboarding?.accessibilityPreference === "sign_language" ? t("account.indianSignLanguage", "Indian Sign Language") : t("account.standardInterface", "Standard Interface")}</dd>
                </div>
              </motion.dl>
            )}
          </AnimatePresence>
          </section>

          {/* WhatsApp Integration Card */}
          <section
            ref={whatsappCardRef}
            className={`${styles.whatsappCard} ${
              location.pathname.includes("whatsapp") || location.search.includes("whatsapp")
                ? styles.whatsappCardFocused
                : ""
            }`}
          >
            <div className={styles.cardTitle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "#dcfce7", color: "#16a34a", padding: "8px", borderRadius: "10px", display: "grid", placeItems: "center" }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    {t("account.whatsappIntegration", "WhatsApp Integration")}
                  </h2>
                  <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    {t("account.whatsappDesc", "Connect your WhatsApp account to use the MediKiosk patient assistant through WhatsApp.")}
                  </p>
                </div>
              </div>
            </div>

            {whatsappError && (
              <div style={{
                marginTop: "14px",
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#b91c1c",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <AlertCircle size={16} />
                <span>{whatsappError}</span>
              </div>
            )}

            {whatsappLoading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                <RefreshCw size={16} className={styles.spinning} style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }} />
                Loading WhatsApp status...
              </div>
            ) : whatsappInfo.linked ? (
              /* ALREADY LINKED STATE */
              <div className={styles.whatsappConnected}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ background: "#dcfce7", color: "#16a34a", padding: "8px", borderRadius: "10px", marginTop: "2px", display: "grid", placeItems: "center" }}>
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "16px", color: "#166534" }}>
                        ✅ {t("account.whatsappConnected", "WhatsApp Connected")}
                      </div>
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#15803d" }}>
                        {t("account.whatsappConnectedDesc", "Your MediKiosk account is linked to WhatsApp:")} <strong>{whatsappInfo.whatsappId}</strong>
                        {whatsappInfo.linkedAt && (
                          <span style={{ display: "block", fontSize: "11px", color: "#166534", marginTop: "3px", opacity: 0.85 }}>
                            Linked on {new Date(whatsappInfo.linkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </p>
                      <div style={{ marginTop: "12px", fontSize: "13px", color: "#334155", background: "#ffffff", padding: "12px 16px", borderRadius: "10px", border: "1px solid #bbf7d0", lineHeight: "1.6" }}>
                        📱 {t("account.whatsappUseInstructions", "You can now use MediKiosk directly through WhatsApp.")}
                        <br />
                        {t("account.whatsappSendHello", "Send hello medikiosk to start.")}
                        <div style={{ marginTop: "10px" }}>
                          <a
                            href={MEDIKIOSK_WHATSAPP_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 16px",
                              background: "#16a34a",
                              color: "#ffffff",
                              borderRadius: "8px",
                              fontWeight: "700",
                              fontSize: "12px",
                              textDecoration: "none",
                              boxShadow: "0 2px 6px rgba(22,163,74,0.2)"
                            }}
                          >
                            <MessageSquare size={14} />
                            {t("account.chatOnWhatsApp", "Chat on WhatsApp")}
                            <ExternalLink size={12} style={{ opacity: 0.85 }} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnlinkModal(true)}
                    disabled={unlinking}
                    style={{
                      padding: "8px 16px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#dc2626",
                      background: "#ffffff",
                      border: "1px solid #fca5a5",
                      borderRadius: "9px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    {unlinking ? t("account.unlinking", "Unlinking...") : t("account.unlinkWhatsApp", "Unlink WhatsApp")}
                  </button>
                </div>
              </div>
            ) : !whatsappToken ? (
              /* UNLINKED STATE (No token generated yet) */
              <div className={styles.whatsappUnlinked}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                      🔗 {t("account.linkWhatsApp", "Link WhatsApp")}
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      {t("account.whatsappDesc", "Connect your WhatsApp account to use the MediKiosk patient assistant through WhatsApp.")}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleGenerateWhatsAppToken}
                      disabled={tokenLoading}
                      style={{
                        background: "#16a34a",
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: "pointer"
                      }}
                    >
                      {tokenLoading ? (
                        <>
                          <RefreshCw size={15} className={styles.spinning} /> {t("account.generatingToken", "Generating Token...")}
                        </>
                      ) : (
                        <>
                          <MessageSquare size={15} /> {t("account.generateToken", "Generate Linking Token")}
                        </>
                      )}
                    </button>
                    <a
                      href={MEDIKIOSK_WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "9px 16px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#1e293b",
                        fontWeight: "700",
                        fontSize: "13px",
                        textDecoration: "none"
                      }}
                    >
                      <MessageSquare size={15} style={{ color: "#16a34a" }} />
                      {t("account.chatOnWhatsApp", "Chat on WhatsApp")}
                      <ExternalLink size={13} style={{ opacity: 0.7 }} />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* TOKEN GENERATED STATE */
              <div style={{ background: "#f8fafc", padding: "22px", borderRadius: "16px", border: "1px solid #e2e8f0", marginTop: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", marginBottom: "4px" }}>
                  <KeyRound size={18} style={{ color: "#16a34a" }} />
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700" }}>
                    🔐 {t("account.whatsappLinkingToken", "WhatsApp Linking Token")}
                  </h4>
                </div>
                <p style={{ margin: "4px 0 14px 0", fontSize: "13px", color: "#64748b" }}>
                  {t("account.tempCodeDesc", "Your temporary linking code is:")}
                </p>

                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <div
                    className={styles.tokenBox}
                    style={{
                      border: isExpired ? "2px dashed #dc2626" : "2px dashed #16a34a",
                      color: isExpired ? "#dc2626" : "#16a34a",
                      textDecoration: isExpired ? "line-through" : "none"
                    }}
                  >
                    {whatsappToken}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyWhatsAppToken}
                    disabled={isExpired}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 18px",
                      borderRadius: "10px",
                      border: "none",
                      background: isExpired ? "#94a3b8" : tokenCopied ? "#16a34a" : "#0f172a",
                      color: "#ffffff",
                      fontWeight: "700",
                      fontSize: "13px",
                      cursor: isExpired ? "not-allowed" : "pointer",
                      transition: "background 0.2s"
                    }}
                  >
                    {tokenCopied ? <Check size={16} /> : <Copy size={16} />}
                    {tokenCopied ? t("account.tokenCopied", "Copied!") : t("account.copyToken", "Copy Token")}
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
                      fontWeight: "700",
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <RefreshCw size={14} className={tokenLoading ? styles.spinning : ""} />
                    {t("account.generateNewToken", "Generate New Token")}
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
                    <span>⚠️ {t("account.tokenExpiredAt", "Token expired at")} {formattedExpiryTime}. {t("account.tokenExpiredNotice", "Please click \"Generate New Token\" above.")}</span>
                  ) : (
                    <span>⏱️ {t("account.validFor", "Valid for")} {timeLeft || "10:00"} {formattedExpiryTime ? `(${t("account.expiresAt", "Expires at")} ${formattedExpiryTime})` : ""}</span>
                  )}
                </div>

                {/* Next Steps Instructions */}
                <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a", marginBottom: "8px" }}>
                    📱 {t("account.nextSteps", "Next steps")}
                  </div>
                  <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.7" }}>
                    <li>1️⃣ {t("account.step1OpenWhatsApp", "Open WhatsApp.")}</li>
                    <li>2️⃣ {t("account.step2OpenChat", "Open the MediKiosk chat.")}</li>
                    <li>
                      3️⃣ {t("account.step3SendHello", "Send: hello medikiosk")}
                    </li>
                    <li>4️⃣ {t("account.step4SendToken", "When prompted, send the token above.")}</li>
                  </ol>
                  <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <a
                      href={MEDIKIOSK_WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 18px",
                        background: "#16a34a",
                        color: "#ffffff",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "13px",
                        textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(22,163,74,0.25)"
                      }}
                    >
                      <MessageSquare size={16} />
                      {t("account.openWhatsApp", "Open WhatsApp")}
                      <ExternalLink size={14} style={{ opacity: 0.85 }} />
                    </a>
                  </div>
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "#b45309", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>⚠️</span>
                    <span>{t("account.tokenSecurityNotice", "Do not share this token with anyone. It expires in 10 minutes and can only be used once.")}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.photoCard}>
            <h2>{t("account.profilePhoto", "Profile Photo")}</h2>
            <div className={styles.photo}>{photo ? <img src={photo} alt={fullName} /> : initials}</div>
            <h3>{t("account.addProfilePhoto", "Add a profile photo")}</h3>
            <p>{t("account.photoDesc", "A recognizable photo helps healthcare providers.")}</p>
            <label aria-disabled={photoUploading}>
              {photoUploading ? <RefreshCw className={styles.spin} /> : <Camera />} {photoUploading ? "Uploading…" : t("account.uploadPhoto", "Upload Photo")}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} disabled={photoUploading} />
            </label>
          </section>
          <section className={styles.security}>
            <ShieldCheck />
            <div>
              <h3>{t("account.securityTitle", "Your Information is Secure")}</h3>
              <p>{t("account.securityDesc", "We use industry-standard encryption to keep your data safe and private.")}</p>
              <a href="#privacy">{t("account.learnMore", "Learn more")} <ArrowRight /></a>
            </div>
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {phoneModal && (
          <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPhoneModal(false)}>
            <motion.div className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}>
              <header>
                <h2>{phoneStep === 1 ? t("account.linkPhoneTitle", "Link Phone Number") : t("account.verifyPhoneTitle", "Verify Phone Number")}</h2>
                <button onClick={() => setPhoneModal(false)}><X /></button>
              </header>
              {phoneStep === 1 ? (
                <form onSubmit={requestOtp}>
                  <p>{t("account.enterPhoneDesc", "Enter your mobile number to receive a verification code.")}</p>
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" required />
                  <button disabled={phoneLoading}>{phoneLoading ? t("account.sendingOtp", "Sending…") : t("account.sendOtp", "Send OTP")}</button>
                </form>
              ) : (
                <form onSubmit={confirmOtp}>
                  <p>{t("account.enterOtpDesc", "Enter the 6-digit code sent to")} <strong>{phone}</strong>.</p>
                  {mockOtp && <small>{t("account.devOtp", "Development OTP:")} {mockOtp}</small>}
                  <input value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={6} inputMode="numeric" placeholder={t("account.verificationCode", "Verification code")} required />
                  <button disabled={phoneLoading}>{phoneLoading ? t("account.verifying", "Verifying…") : t("account.verifyAndLink", "Verify & Link")}</button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* WhatsApp Unlink Confirmation Modal */}
        {showUnlinkModal && (
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUnlinkModal(false)}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "#fee2e2", color: "#dc2626", padding: "7px", borderRadius: "10px", display: "grid", placeItems: "center" }}>
                    <AlertCircle size={20} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                    {t("account.unlinkModalTitle", "Unlink WhatsApp?")}
                  </h2>
                </div>
                <button type="button" onClick={() => setShowUnlinkModal(false)} aria-label="Close">
                  <X />
                </button>
              </header>

              <p style={{ margin: "4px 0 20px 0", fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                {t("account.unlinkModalDesc", "This will disconnect your WhatsApp account from MediKiosk.")}
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowUnlinkModal(false)}
                  disabled={unlinking}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "9px",
                    border: "1px solid #dce3df",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  {t("account.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnlink}
                  disabled={unlinking}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "9px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  {unlinking ? t("account.unlinking", "Unlinking...") : t("account.unlinkConfirm", "Unlink")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
