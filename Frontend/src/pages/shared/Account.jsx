import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, CheckCircle, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { INDIAN_STATES_AND_UTS, SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import { requestPhoneLink, updatePatientProfile, verifyPhoneLink } from "../../services/api";
import { transliterateName } from "../../utils/transliterate";
import accountBanner from "../../assets/patient-gateway-banner.png";
import styles from "./Account.module.css";

export default function Account() {
  const { user, token, refreshUser } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState("");
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    dateOfBirth: user?.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split("T")[0] : "",
    gender: user?.profile?.gender || "",
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
        <section className={styles.detailsCard}>
          <div className={styles.cardTitle}>
            <h2>{t("account.profileDetails", "Profile Details")}</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => window.location.href = "/patient/assessment"}
                style={{
                  background: "#e6fffa",
                  color: "#0d9488",
                  border: "1px solid #99f6e4",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <ShieldCheck size={16} /> {t("navigation.assessment", "Clinical Assessment")}
              </button>
              <button onClick={() => setEditing((value) => !value)}>
                {editing ? <X /> : <Pencil />}
                {editing ? t("account.cancel", "Cancel") : t("account.edit", "Edit")}
              </button>
            </div>
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
                  <dd>{user?.onboarding?.accessibilityPreference === "large_text" ? t("account.largerText", "Larger Text") : user?.onboarding?.accessibilityPreference === "voice_guidance" ? t("account.audioVoiceover", "Audio Voiceover") : user?.onboarding?.accessibilityPreference === "hearing_assistance" ? t("account.visualHighlights", "Visual Highlights") : t("account.standardInterface", "Standard Interface")}</dd>
                </div>
              </motion.dl>
            )}
          </AnimatePresence>
        </section>

        <aside className={styles.side}>
          <section className={styles.photoCard}>
            <h2>{t("account.profilePhoto", "Profile Photo")}</h2>
            <div className={styles.photo}>{photo ? <img src={photo} alt={fullName} /> : initials}</div>
            <h3>{t("account.addProfilePhoto", "Add a profile photo")}</h3>
            <p>{t("account.photoDesc", "A recognizable photo helps healthcare providers.")}</p>
            <label>
              <Camera /> {t("account.uploadPhoto", "Upload Photo")}
              <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && setPhoto(URL.createObjectURL(event.target.files[0]))} />
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
      </AnimatePresence>
    </div>
  );
}
