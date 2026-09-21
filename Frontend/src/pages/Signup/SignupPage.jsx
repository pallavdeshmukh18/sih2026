import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseMedical, CalendarDays, Check, Eye, EyeOff, FileText, LockKeyhole, Mail, Phone, ShieldCheck, Stethoscope, UserRound, UsersRound } from "lucide-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { API_BASE_URL, loginDoctor, loginPatientEmail, loginPatientPhone, loginStaff, registerDoctor, registerPatientEmail, verifyPatientEmailLogin, verifyPatientEmailRegistration, verifyPatientPhoneLogin } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LANGUAGE_OPTIONS, useLanguage } from "../../i18n";
import careImage from "../../assets/signup-care-family-generated-v2.png";
import { SIGNUP_COPY } from "./signupCopy";
import "./SignupPage.css";

const GoogleIcon = () => <svg className="signup-google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.31v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.77c-.99.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.83Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.56 10.56 0 0 0 12 1a11 11 0 0 0-9.82 6.07L5.84 9.9A6.57 6.57 0 0 1 12 5.38Z"/></svg>;

function Brand({ copy }) { return <Link className="signup-brand" to="/" aria-label="MediKiosk home"><span className="signup-brand-leaf" aria-hidden="true"><i/><i/><i/></span><span><strong>MediKiosk<span>.</span></strong><small>{copy.brandTagline}</small></span></Link>; }

export default function SignupPage() {
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();
  const { currentLanguage, changeLanguage } = useLanguage();
  const c = SIGNUP_COPY[currentLanguage] || SIGNUP_COPY.en;
  const roles = [
    { id: "patient", label: c.patient, detail: c.patientDesc, icon: UserRound },
    { id: "doctor", label: c.doctor, detail: c.doctorDesc, icon: Stethoscope },
    { id: "receptionist", label: c.staff, detail: c.staffDesc, icon: UsersRound },
  ];
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("register");
  const [patientMethod, setPatientMethod] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [verificationId, setVerificationId] = useState("");
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", password:"", dateOfBirth:"", gender:"", registrationNumber:"", specialization:"", otp:"" });
  const update = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }));
  const selectRole = next => {
    const leavingStaffRole = role === "receptionist" && next !== "receptionist";
    setRole(next);
    if (next === "receptionist") setMode("login");
    else if (leavingStaffRole) setMode("register");
    setStep(1);
    setVerificationId("");
  };
  const selectMode = next => { setMode(next); setStep(1); setVerificationId(""); };

  const finishPatientLogin = async response => {
    login(response.token, response.user); const fullUser = await refreshUser(response.token);
    const complete = fullUser?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${response.user.id}`);
    navigate(complete ? "/patient/dashboard" : "/patient/onboarding");
  };
  const submit = async event => {
    event.preventDefault(); setLoading(true);
    try {
      if (mode === "login" && step === 1) {
        if (role === "doctor") { const r = await loginDoctor(form.email, form.password); login(r.token,r.user); toast.success(c.welcome); navigate("/doctor/dashboard"); return; }
        if (role === "receptionist") { const r = await loginStaff(form.email, form.password); login(r.token,r.user); toast.success(c.welcome); navigate("/receptionist/dashboard"); return; }
        const r = patientMethod === "email" ? await loginPatientEmail(form.email) : await loginPatientPhone(form.phone); setVerificationId(r.verificationId); setStep(2); toast.success(`${c.verify}: ${c[patientMethod]}`); return;
      }
      if (mode === "login" && step === 2) { const r = patientMethod === "email" ? await verifyPatientEmailLogin(verificationId,form.otp) : await verifyPatientPhoneLogin(verificationId,form.otp); await finishPatientLogin(r); toast.success(c.welcome); return; }
      if (role === "doctor") { await registerDoctor({ firstName:form.firstName,lastName:form.lastName,email:form.email,password:form.password,registrationNumber:form.registrationNumber,specialization:form.specialization }); toast.success(c.createButton); selectMode("login"); return; }
      if (step === 1) { const r = await registerPatientEmail({ firstName:form.firstName,lastName:form.lastName,email:form.email,phone:form.phone,dateOfBirth:form.dateOfBirth,gender:form.gender }); setVerificationId(r.verificationId); setStep(2); toast.success(`${c.verify}: ${c.email}`); }
      else { const r = await verifyPatientEmailRegistration(verificationId,form.otp); login(r.token,r.user); await refreshUser(r.token); toast.success(c.welcome); navigate("/patient/onboarding"); }
    } catch (error) { toast.error(error.message || c.create); } finally { setLoading(false); }
  };

  return <main className="signup-page">
    <aside className="signup-story"><Brand copy={c}/><div className="signup-story-copy"><h1>{c.headline1}<br/>{c.headline2}<br/><em>{c.headline3}</em></h1><p>{c.story}</p><span className="signup-story-rule"/><blockquote>{c.quote}</blockquote></div><img src={careImage} alt={c.doctors}/></aside>
    <section className="signup-center"><div className={`signup-card signup-card--${mode}`}>
      <label className="signup-language"><span>{c.selectLanguage}</span><select value={currentLanguage} onChange={e=>changeLanguage(e.target.value)} aria-label={c.selectLanguage}>{LANGUAGE_OPTIONS.map(language=><option key={language.code} value={language.code}>{language.nativeName}</option>)}</select></label>
      <div className="signup-card-top">{c.already} <button type="button" onClick={()=>selectMode("login")}>{c.signIn} <ArrowRight/></button></div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.header key={`${mode}-${step}`} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2,ease:"easeOut"}}>
          <h2>{mode === "login" ? c.welcome : c.create}</h2><p>{step === 2 ? `${c.verify} — ${c[patientMethod]}` : mode === "login" ? c.signInSub : c.join}</p>
        </motion.header>
      </AnimatePresence>
      {step === 1 && <div className="signup-roles" role="group" aria-label={c.create}>{roles.map(({id,label,detail,icon:Icon})=><button type="button" key={id} className={role===id?"active":""} onClick={()=>selectRole(id)}><Icon/><span><strong>{label}</strong><small>{detail}</small></span>{role===id&&<i><Check/></i>}</button>)}</div>}
      <AnimatePresence mode="wait" initial={false}><motion.div className="signup-flow" key={`${mode}-${role}-${patientMethod}-${step}`} initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}} transition={{duration:.18}}>
        <form className="signup-form" onSubmit={submit}>
          {step === 2 ? <Field className="signup-field-full" label={c.verify} icon={LockKeyhole}><input name="otp" value={form.otp} onChange={update} inputMode="numeric" maxLength={6} placeholder="OTP" required autoFocus/></Field>
          : mode === "login" ? <><div className="signup-otp-options">{role === "patient"&&<><button type="button" className={patientMethod==="email"?"active":""} onClick={()=>setPatientMethod("email")}><Mail/> {c.email} OTP</button><button type="button" className={patientMethod==="phone"?"active":""} onClick={()=>setPatientMethod("phone")}><Phone/> {c.phone} OTP</button></>}</div><Field className="signup-field-full" label={patientMethod==="phone"&&role==="patient"?c.phone:c.email} icon={patientMethod==="phone"&&role==="patient"?Phone:Mail}><input type={patientMethod==="phone"&&role==="patient"?"tel":"email"} name={patientMethod==="phone"&&role==="patient"?"phone":"email"} value={patientMethod==="phone"&&role==="patient"?form.phone:form.email} onChange={update} placeholder={patientMethod==="phone"&&role==="patient"?"+91 98765 43210":"you@example.com"} required/></Field>{role!=="patient"&&<PasswordField {...{form,update,showPassword,setShowPassword}} copy={c}/>}</>
          : <><Field label={c.firstName}><input name="firstName" value={form.firstName} onChange={update} placeholder={c.firstName} required/></Field><Field label={c.lastName}><input name="lastName" value={form.lastName} onChange={update} placeholder={c.lastName}/></Field><Field label={c.email}><input type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" required/></Field>
          {role === "patient" ? <><Field label={c.phone} prefix="🇮🇳  +91⌄"><input type="tel" name="phone" value={form.phone} onChange={update} placeholder={c.phone}/></Field><Field label={c.dateOfBirth} trailing={CalendarDays}><input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={update} required/></Field><Field label={c.gender}><select name="gender" value={form.gender} onChange={update} required><option value="" disabled>{c.selectGender}</option><option value="Male">{c.male}</option><option value="Female">{c.female}</option><option value="Other">{c.other}</option></select></Field></> : <><Field label={c.registration}><input name="registrationNumber" value={form.registrationNumber} onChange={update} placeholder={c.registration} required/></Field><Field label={c.specialization}><input name="specialization" value={form.specialization} onChange={update} placeholder={c.specialization}/></Field></>}
          <PasswordField {...{form,update,showPassword,setShowPassword}} optional={role==="patient"} copy={c}/><label className="signup-consent"><input type="checkbox" required/><span><Check/></span>{c.agree} <a href="#terms">{c.terms}</a> {c.and} <a href="#privacy">{c.privacy}</a></label></>}
          <button className="signup-submit" disabled={loading}>{loading?c.wait:step===2?c.verify:mode==="login"?c.signIn:c.createButton}<ArrowRight/></button>{step===2&&<button type="button" className="signup-back" onClick={()=>setStep(1)}>← {c.signIn}</button>}
        </form>
        {role==="patient"&&step===1&&<><div className="signup-divider"><span>{c.continueWith}</span></div><div className="signup-socials"><button type="button" onClick={()=>{window.location.href=`${API_BASE_URL}/api/auth/patient/google`;}}><GoogleIcon/>{c.google}</button><button type="button" onClick={()=>toast(`${c.digi} — ${c.wait}`)}><BriefcaseMedical/>{c.digi}</button></div></>}
        {mode==="login"&&<p className="signup-mode-switch">MediKiosk <button onClick={()=>selectMode("register")}>{c.createButton}</button></p>}
      </motion.div></AnimatePresence>
    </div></section>
    <aside className="signup-trust"><TrustCard icon={FileText} tone="green" title={c.records}>{c.recordsDesc}</TrustCard><TrustCard icon={UsersRound} tone="blue" title={c.doctors}>{c.doctorsDesc}</TrustCard><TrustCard icon={ShieldCheck} tone="purple" title={c.secure}>{c.secureDesc}</TrustCard><div className="signup-trust-signoff"><span/><p>{c.signoff}</p></div></aside>
  </main>;
}

function Field({label,icon:Icon,trailing:Trailing,prefix,className="",children}) { return <label className={`signup-field ${className}`}><span>{label}</span><div>{Icon&&<Icon/>}{prefix&&<b>{prefix}</b>}{children}{Trailing&&<Trailing/>}</div></label>; }
function PasswordField({form,update,showPassword,setShowPassword,optional=false,copy=SIGNUP_COPY.en}) { return <Field className="signup-field-full" label={copy.password}><input type={showPassword?"text":"password"} name="password" value={form.password} onChange={update} minLength={optional?undefined:8} placeholder={copy.password} required={!optional}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={copy.password}>{showPassword?<EyeOff/>:<Eye/>}</button></Field>; }
function TrustCard({icon:Icon,tone,title,children}) { return <article className="signup-trust-card"><div className={`signup-trust-icon ${tone}`}><Icon/></div><h3>{title}</h3><p>{children}</p></article>; }
