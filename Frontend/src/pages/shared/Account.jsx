import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, CheckCircle, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { INDIAN_STATES_AND_UTS, SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import { requestPhoneLink, updatePatientProfile, verifyPhoneLink, uploadProfilePhoto } from "../../services/api";
import accountBanner from "../../assets/patient-gateway-banner.png";
import styles from "./Account.module.css";

export default function Account() {
  const { user, token, refreshUser } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState("");
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    dateOfBirth: user?.profile?.dateOfBirth ? new Date(user.profile.dateOfBirth).toISOString().split("T")[0] : "",
    gender: user?.profile?.gender || "",
    state: user?.onboarding?.state || "",
    preferredLanguage: user?.onboarding?.preferredLanguage || language || "en",
  }));
  const [phoneModal, setPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const initials = `${user?.firstName?.[0] || "P"}${user?.lastName?.[0] || ""}`.toUpperCase();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Patient Account";
  const displayDate = user?.profile?.dateOfBirth
    ? new Date(user.profile.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "Not provided";

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
      }, token);
      changeLanguage(form.preferredLanguage);
      await refreshUser();
      setEditing(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(error.message || "Unable to update your profile.");
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
      toast.error(error.message || "Unable to send OTP.");
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
      toast.success("Phone number verified.");
    } catch (error) {
      toast.error(error.message || "OTP verification failed.");
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

    setPhoto(URL.createObjectURL(file));
    
    const formData = new FormData();
    formData.append("photo", file);
    
    try {
      await uploadProfilePhoto(formData, token);
      await refreshUser();
      toast.success("Profile photo updated successfully.");
    } catch (error) {
      toast.error(error.message || "Failed to upload photo.");
    }
  };

  return (
    <div className={`${styles.page} workspacePage`}>
      <header className={styles.hero}>
        <div><span>My account</span><h1>Your Information</h1><p>Keep your details up to date for a smoother healthcare experience.</p></div>
        <blockquote>“A healthier you,<br />a brighter tomorrow.”</blockquote>
        <img src={accountBanner} alt="" aria-hidden="true" />
      </header>

      <div className={styles.grid}>
        <section className={styles.detailsCard}>
          <div className={styles.cardTitle}><h2>Profile Details</h2><button onClick={() => setEditing((value) => !value)}>{editing ? <X /> : <Pencil />}{editing ? "Cancel" : "Edit"}</button></div>

          <div className={styles.identity}>
            <div className={styles.avatar}>{photo ? <img src={photo} alt={fullName} /> : initials}</div>
            <div><div className={styles.nameRow}><h3>{fullName}</h3><span>{user?.role || "Patient"}</span></div><p><Mail /> {user?.email || "No email linked"}<i /><Phone /> {user?.phone || "No phone linked"}</p><p><MapPin /> {user?.onboarding?.state ? `${user.onboarding.state}, India` : "India"}</p></div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.form key="edit" className={styles.editForm} onSubmit={saveProfile} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label>First name<input name="firstName" value={form.firstName} onChange={update} required /></label>
                <label>Last name<input name="lastName" value={form.lastName} onChange={update} /></label>
                <label>Date of birth<input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={update} /></label>
                <label>Gender<select name="gender" value={form.gender} onChange={update}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
                <label>State<select name="state" value={form.state} onChange={update}><option value="">Select State or UT</option>{INDIAN_STATES_AND_UTS.map((state) => <option key={state.name}>{state.name}</option>)}</select></label>
                <label>Language<select name="preferredLanguage" value={form.preferredLanguage} onChange={update}>{SUPPORTED_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.nativeName})</option>)}</select></label>
                <button className={styles.save} disabled={saving}><Save /> {saving ? "Saving…" : "Save Changes"}</button>
              </motion.form>
            ) : (
              <motion.dl key="view" className={styles.information} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div><dt>Full Name</dt><dd>{fullName}</dd></div>
                <div><dt>Date of Birth</dt><dd>{displayDate}</dd></div>
                <div><dt>Gender</dt><dd>{user?.profile?.gender || "Not provided"}</dd></div>
                <div><dt>Phone Number</dt><dd>{user?.phone || "Not linked"}{user?.phoneVerified && <span><CheckCircle /> Verified</span>}<button onClick={openPhoneModal}>{user?.phone ? "Change" : "Link phone"}</button></dd></div>
                <div><dt>Email Address</dt><dd>{user?.email || "Not linked"}</dd></div>
                <div><dt>Address</dt><dd>{user?.onboarding?.state ? `${user.onboarding.state}, India` : "India"}</dd></div>
                <div><dt>Language</dt><dd>{SUPPORTED_LANGUAGES.find((item) => item.code === (user?.onboarding?.preferredLanguage || language))?.name || "English"}</dd></div>
              </motion.dl>
            )}
          </AnimatePresence>
        </section>

        <aside className={styles.side}>
          <section className={styles.photoCard}><h2>Profile Photo</h2><div className={styles.photo}>{photo ? <img src={photo} alt={fullName} /> : initials}</div><h3>Add a profile photo</h3><p>A recognizable photo helps healthcare providers.</p><label><Camera /> Upload Photo<input type="file" accept="image/*" onChange={handlePhotoUpload} /></label></section>
          <section className={styles.security}><ShieldCheck /><div><h3>Your Information is Secure</h3><p>We use industry-standard encryption to keep your data safe and private.</p><a href="#privacy">Learn more <ArrowRight /></a></div></section>
        </aside>
      </div>

      <AnimatePresence>
        {phoneModal && <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPhoneModal(false)}>
          <motion.div className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}>
            <header><h2>{phoneStep === 1 ? "Link Phone Number" : "Verify Phone Number"}</h2><button onClick={() => setPhoneModal(false)}><X /></button></header>
            {phoneStep === 1 ? <form onSubmit={requestOtp}><p>Enter your mobile number to receive a verification code.</p><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" required /><button disabled={phoneLoading}>{phoneLoading ? "Sending…" : "Send OTP"}</button></form>
              : <form onSubmit={confirmOtp}><p>Enter the 6-digit code sent to <strong>{phone}</strong>.</p>{mockOtp && <small>Development OTP: {mockOtp}</small>}<input value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={6} inputMode="numeric" placeholder="Verification code" required /><button disabled={phoneLoading}>{phoneLoading ? "Verifying…" : "Verify & Link"}</button></form>}
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
