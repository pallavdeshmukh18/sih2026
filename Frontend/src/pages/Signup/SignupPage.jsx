import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Mail,
  Phone,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  loginDoctor,
  loginPatientEmail,
  loginPatientPhone,
  loginStaff,
  registerDoctor,
  registerPatientEmail,
  verifyPatientEmailLogin,
  verifyPatientEmailRegistration,
  verifyPatientPhoneLogin,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import heroImage from "../../assets/signup-heritage-hero-v2.png";
import "./SignupPage.css";

const roles = [
  { id: "patient", label: "Patient", detail: "Manage your health", icon: UserRound },
  { id: "doctor", label: "Doctor", detail: "Care for your patients", icon: Stethoscope },
  { id: "receptionist", label: "Receptionist", detail: "Manage appointments", icon: Building2 },
];

function Brand() {
  return (
    <Link className="signup-brand" to="/" aria-label="MediKiosk home">
      <span className="signup-brand-mark"><Leaf size={27} /><HeartPulse size={20} /></span>
      <span><strong>Medi<span>Kiosk</span></strong><small>Your Health. In Your Hands.</small></span>
    </Link>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("register");
  const [patientMethod, setPatientMethod] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [verificationId, setVerificationId] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "",
    dateOfBirth: "", gender: "Male", registrationNumber: "", specialization: "", otp: "",
  });
  const ActiveRoleIcon = roles.find((item) => item.id === role)?.icon || UserRound;

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const selectRole = (nextRole) => {
    setRole(nextRole);
    if (nextRole === "receptionist") setMode("login");
    setStep(1);
    setVerificationId("");
  };

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setStep(1);
    setVerificationId("");
  };

  const finishPatientLogin = async (response) => {
    login(response.token, response.user);
    const fullUser = await refreshUser(response.token);
    const complete = fullUser?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${response.user.id}`);
    navigate(complete ? "/patient/dashboard" : "/patient/onboarding");
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login" && step === 1) {
        if (role === "doctor") {
          const response = await loginDoctor(form.email, form.password);
          login(response.token, response.user);
          toast.success("Welcome back, Doctor!");
          navigate("/doctor/dashboard");
          return;
        }
        if (role === "receptionist") {
          const response = await loginStaff(form.email, form.password);
          login(response.token, response.user);
          toast.success("Welcome back!");
          navigate("/");
          return;
        }
        const response = patientMethod === "email"
          ? await loginPatientEmail(form.email)
          : await loginPatientPhone(form.phone);
        setVerificationId(response.verificationId);
        setStep(2);
        toast.success(`A verification code was sent to your ${patientMethod}.`);
        return;
      }

      if (mode === "login" && step === 2) {
        const response = patientMethod === "email"
          ? await verifyPatientEmailLogin(verificationId, form.otp)
          : await verifyPatientPhoneLogin(verificationId, form.otp);
        await finishPatientLogin(response);
        toast.success("Welcome back!");
        return;
      }

      if (role === "doctor") {
        await registerDoctor({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          registrationNumber: form.registrationNumber,
          specialization: form.specialization,
        });
        toast.success("Account created. You can sign in after verification.");
        selectMode("login");
        return;
      }

      if (step === 1) {
        const response = await registerPatientEmail({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
        });
        setVerificationId(response.verificationId);
        setStep(2);
        toast.success("A verification code was sent to your email.");
      } else {
        const response = await verifyPatientEmailRegistration(verificationId, form.otp);
        login(response.token, response.user);
        await refreshUser(response.token);
        toast.success("Welcome to MediKiosk!");
        navigate("/patient/onboarding");
      }
    } catch (error) {
      toast.error(error.message || "We couldn't create your account.");
    } finally {
      setLoading(false);
    }
  };

  const googleSignup = () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
    window.location.href = `${apiBaseUrl}/api/auth/patient/google`;
  };

  return (
    <main className="signup-page">
      <section className="signup-story">
        <img src={heroImage} alt="India Gate at sunrise" />
        <div className="signup-story-shade" />
        <Brand />
        <div className="signup-story-copy">
          <span className="signup-eyebrow">Traditional care. Modern technology.</span>
          <h1>A healthier India starts with <em>you.</em></h1>
          <p>Create your account and be part of a platform that makes healthcare more accessible, connected and human.</p>
          <div className="signup-benefits">
            <article><UsersRound /><span><strong>Your Data. Your Control.</strong><small>Secure, private and transparent.</small></span></article>
            <article><Leaf /><span><strong>Care Without Barriers</strong><small>Multilingual and inclusive for every Indian.</small></span></article>
            <article><HeartPulse /><span><strong>Smarter Care Together</strong><small>For patients, doctors and communities.</small></span></article>
          </div>
        </div>
        <blockquote>“Health is not a destination,<br />but a more humane tomorrow.”</blockquote>
      </section>

      <svg className="signup-organic-divider" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M46 0 C12 70 62 132 30 205 C2 270 58 326 25 400 C0 460 54 525 29 595 C7 660 61 727 31 800 C7 860 50 930 18 1000 H100 V0 Z" />
        <path className="signup-organic-divider-edge" d="M46 0 C12 70 62 132 30 205 C2 270 58 326 25 400 C0 460 54 525 29 595 C7 660 61 727 31 800 C7 860 50 930 18 1000" />
      </svg>

      <section className="signup-panel-wrap">
        <div className="signup-mobile-brand"><Brand /></div>
        <div className="signup-language">EN <span>⌄</span></div>
        <div className={`signup-card signup-card--${mode} signup-card--${role}`}>
          <header>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${mode}-${step}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <span className="signup-kicker">{mode === "login" ? "Welcome back" : "Create your account"}</span>
                <h2>{mode === "login" ? "Sign in to MediKiosk" : "Join MediKiosk"}</h2>
                <p>{step === 2 ? `Verify your ${patientMethod} to continue` : "Choose your role to get started"}</p>
              </motion.div>
            </AnimatePresence>
          </header>

          {step === 1 && (
            <label className="signup-role-select">
              <ActiveRoleIcon aria-hidden="true" />
              <span><small>Continue as</small><strong>{roles.find((item) => item.id === role)?.label}</strong></span>
              <select value={role} onChange={(event) => selectRole(event.target.value)} aria-label="Choose account type">
                {roles.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="signup-flow"
              key={`${mode}-${role}-${patientMethod}-${step}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
          {role === "receptionist" && mode === "register" ? (
            <div className="signup-invite">
              <Building2 />
              <h3>Join through your clinic</h3>
              <p>Receptionist accounts are securely created by a verified doctor or clinic administrator.</p>
              <button type="button" onClick={() => selectMode("login")}>Go to staff sign in <ArrowRight size={17} /></button>
            </div>
          ) : (
            <form className="signup-form" onSubmit={submit}>
              {step === 2 ? (
                <label className="signup-field">
                  <span>Verification code</span><LockKeyhole />
                  <input name="otp" value={form.otp} onChange={update} inputMode="numeric" maxLength={6} placeholder="Enter 6-digit code" required autoFocus />
                </label>
              ) : mode === "login" ? (
                <>
                  {role === "patient" && (
                    <div className="signup-otp-options" role="group" aria-label="Choose OTP method">
                      <button type="button" className={patientMethod === "email" ? "active" : ""} onClick={() => setPatientMethod("email")}><Mail /> Email OTP</button>
                      <button type="button" className={patientMethod === "phone" ? "active" : ""} onClick={() => setPatientMethod("phone")}><Phone /> Phone OTP</button>
                    </div>
                  )}
                  {role === "patient" && patientMethod === "phone" ? (
                    <label className="signup-field"><span>Phone number</span><Phone /><input type="tel" name="phone" value={form.phone} onChange={update} placeholder="+91 98765 43210" required /></label>
                  ) : (
                    <label className="signup-field"><span>Email address</span><Mail /><input type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label>
                  )}
                  {role !== "patient" && (
                    <label className="signup-field"><span>Password</span><LockKeyhole /><input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update} placeholder="Enter your password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></label>
                  )}
                </>
              ) : (
                <>
                  <div className="signup-name-row">
                    <label className="signup-field"><span>First name</span><UserRound /><input name="firstName" value={form.firstName} onChange={update} placeholder="First name" required /></label>
                    <label className="signup-field"><span>Last name</span><input name="lastName" value={form.lastName} onChange={update} placeholder="Last name" /></label>
                  </div>
                  <label className="signup-field"><span>Email address</span><Mail /><input type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label>
                  {role === "patient" && (
                    <>
                      <label className="signup-field"><span>Phone number</span><Phone /><input type="tel" name="phone" value={form.phone} onChange={update} placeholder="+91 98765 43210" /></label>
                      <div className="signup-name-row">
                        <label className="signup-field"><span>Date of birth</span><CalendarDays /><input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={update} required /></label>
                        <label className="signup-field"><span>Gender</span><select name="gender" value={form.gender} onChange={update}><option>Male</option><option>Female</option><option>Other</option></select></label>
                      </div>
                    </>
                  )}
                  {role === "doctor" && (
                    <>
                      <label className="signup-field"><span>Medical registration number</span><HeartPulse /><input name="registrationNumber" value={form.registrationNumber} onChange={update} placeholder="Registration number" required /></label>
                      <label className="signup-field"><span>Specialization</span><Stethoscope /><input name="specialization" value={form.specialization} onChange={update} placeholder="e.g. Cardiology" /></label>
                      <label className="signup-field"><span>Create password</span><LockKeyhole /><input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update} minLength={8} placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></label>
                    </>
                  )}
                </>
              )}

              <button className="signup-submit" disabled={loading}>{loading ? "Please wait…" : step === 2 ? "Verify & continue" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight /></button>
              {step === 2 && <button type="button" className="signup-back" onClick={() => setStep(1)}>Change {patientMethod}</button>}
            </form>
          )}

          {role === "patient" && step === 1 && (
            <><div className="signup-divider"><span>or continue with</span></div><button className="signup-google" type="button" onClick={googleSignup}>
              <svg className="signup-google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.31v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.77c-.99.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.83Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.56 10.56 0 0 0 12 1a11 11 0 0 0-9.82 6.07L5.84 9.9A6.57 6.57 0 0 1 12 5.38Z" />
              </svg>
              Google
            </button></>
          )}
          {mode === "register" && <p className="signup-legal">By creating an account, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>}
          <p className="signup-signin">{mode === "login" ? "New to MediKiosk?" : "Already have an account?"} <button type="button" onClick={() => selectMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create account" : "Sign in"}</button></p>
            </motion.div>
          </AnimatePresence>
        </div>
        <footer><Leaf /><span>“Same care.<br />A brighter tomorrow.”</span><small>Swasth Bharat &nbsp;•&nbsp; Sashakt Nagrik</small></footer>
      </section>
    </main>
  );
}
