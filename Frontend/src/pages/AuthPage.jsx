import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import lottieUrl from "../assets/d62JHEJbaa.lottie?url";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    loginPatientPhone,
    verifyPatientPhoneLogin,
    registerPatientPhone,
    verifyPatientPhoneRegistration,
    loginPatientEmail,
    verifyPatientEmailLogin,
    registerPatientEmail,
    verifyPatientEmailRegistration,
    loginDoctor,
    registerDoctor,
} from "../services/api";
import styles from "./AuthPage.module.css";

const AuthPage = () => {
    const { login, refreshUser } = useAuth();
    const navigate = useNavigate();

    // Primary Auth States
    const [role, setRole] = useState("patient"); // 'patient' | 'doctor'
    const [mode, setMode] = useState("login"); // 'login' | 'register'
    const [doctorMode, setDoctorMode] = useState("login"); // 'login' | 'register'
    const [method, setMethod] = useState("phone"); // 'phone' | 'email' | 'google'
    const [step, setStep] = useState(1); // 1: Info/Credentials input, 2: OTP input

    // Form Field States
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender, setGender] = useState("Male");
    const [otp, setOtp] = useState("");
    const [verificationId, setVerificationId] = useState("");
    const [registrationNumber, setRegistrationNumber] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [department, setDepartment] = useState("");

    // UI States
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Reset fields on tab changes
    const resetForm = () => {
        setStep(1);
        setOtp("");
        setVerificationId("");
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setDoctorMode("login");
        resetForm();
    };

    const handleModeChange = (newMode) => {
        setMode(newMode);
        resetForm();
    };

    const handleMethodChange = (newMethod) => {
        setMethod(newMethod);
        resetForm();
    };

    // --- FORM SUBMISSION HANDLERS ---

    // Doctor Login Submit
    const handleDoctorLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await loginDoctor(email, password);
            login(res.token, res.user);
            toast.success("Welcome back, Doctor!");
            navigate("/doctor/dashboard");
        } catch (err) {
            toast.error(err.message || "Invalid doctor credentials.");
        } finally {
            setLoading(false);
        }
    };

    // Patient Phone Login / Registration Handlers
    const handlePatientPhoneStep1 = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === "login") {
                const res = await loginPatientPhone(phone);
                setVerificationId(res.verificationId);
                setStep(2);
                toast.success("OTP sent to your phone.");
            } else {
                if (!firstName || !phone || !dateOfBirth || !gender) {
                    toast.error("Please complete all required registration fields.");
                    return;
                }
                const res = await registerPatientPhone({
                    firstName,
                    lastName,
                    phone,
                    dateOfBirth,
                    gender,
                });
                setVerificationId(res.verificationId);
                setStep(2);
                toast.success("OTP sent to your phone.");
            }
        } catch (err) {
            toast.error(err.message || "Failed to request OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handlePatientPhoneStep2 = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (mode === "login") {
                res = await verifyPatientPhoneLogin(verificationId, otp);
            } else {
                res = await verifyPatientPhoneRegistration(verificationId, otp);
            }
            login(res.token, res.user);
            toast.success("Successfully logged in!");
            const fullUser = await refreshUser(res.token);
            const isCompleted = fullUser?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${res.user.id}`);
            navigate(isCompleted ? "/patient/dashboard" : "/patient/onboarding");
        } catch (err) {
            toast.error(err.message || "Invalid OTP verification code.");
        } finally {
            setLoading(false);
        }
    };

    // Patient Email Login / Registration Handlers
    const handlePatientEmailStep1 = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === "login") {
                const res = await loginPatientEmail(email);
                setVerificationId(res.verificationId);
                setStep(2);
                toast.success("OTP sent to your email.");
            } else {
                if (!firstName || !email || !dateOfBirth || !gender) {
                    toast.error("Please complete all required registration fields.");
                    return;
                }
                const res = await registerPatientEmail({
                    firstName,
                    lastName,
                    email,
                    dateOfBirth,
                    gender,
                });
                setVerificationId(res.verificationId);
                setStep(2);
                toast.success("OTP sent to your email.");
            }
        } catch (err) {
            toast.error(err.message || "Failed to request OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handlePatientEmailStep2 = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (mode === "login") {
                res = await verifyPatientEmailLogin(verificationId, otp);
            } else {
                res = await verifyPatientEmailRegistration(verificationId, otp);
            }
            login(res.token, res.user);
            toast.success("Successfully logged in!");
            const fullUser = await refreshUser(res.token);
            const isCompleted = fullUser?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${res.user.id}`);
            navigate(isCompleted ? "/patient/dashboard" : "/patient/onboarding");
        } catch (err) {
            toast.error(err.message || "Invalid OTP verification code.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleClick = () => {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
        window.location.href = `${apiBaseUrl}/api/auth/patient/google`;
    };

    return (
        <div className={styles.authContainer}>
            {/* Background Shapes */}
            <div className={styles.bgBlobTopRight}></div>
            <div className={styles.bgBlobBottomLeft}></div>

            <div className={styles.authCard}>
                {/* Left Side: Form Section */}
                <div className={styles.formSection}>
                    <div className={styles.formHeader}>
                        <h1>MediKiosk</h1>
                        <p>{role === "patient" ? (mode === "login" ? "Patient Sign In" : "Patient Registration") : (doctorMode === "login" ? "Doctor Portal Sign In" : "Doctor Registration")}</p>
                    </div>

                    {/* Role Selector Tabs */}
                    <div className={styles.roleSelector}>
                        <button
                            type="button"
                            className={`${styles.roleTab} ${role === "patient" ? styles.roleTabActive : ""}`}
                            onClick={() => handleRoleChange("patient")}
                        >
                            Patient
                        </button>
                        <button
                            type="button"
                            className={`${styles.roleTab} ${role === "doctor" ? styles.roleTabActive : ""}`}
                            onClick={() => handleRoleChange("doctor")}
                        >
                            Doctor
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* DOCTOR AUTHENTICATION FORM */}
                        {role === "doctor" && (
                            <motion.div
                                key={`doctor-${doctorMode}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Doctor Login / Register Toggle */}
                                <div className={styles.methodSelector} style={{ marginBottom: '20px' }}>
                                    <button
                                        type="button"
                                        className={`${styles.methodPill} ${doctorMode === 'login' ? styles.methodPillActive : ''}`}
                                        onClick={() => { setDoctorMode('login'); resetForm(); }}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.methodPill} ${doctorMode === 'register' ? styles.methodPillActive : ''}`}
                                        onClick={() => { setDoctorMode('register'); resetForm(); }}
                                    >
                                        Register
                                    </button>
                                </div>

                                {/* DOCTOR LOGIN FORM */}
                                {doctorMode === 'login' && (
                                    <form
                                        className={styles.form}
                                        onSubmit={handleDoctorLogin}
                                    >
                                        <div className={styles.inputGroup}>
                                            <span className={styles.icon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                    <polyline points="22,6 12,13 2,6"></polyline>
                                                </svg>
                                            </span>
                                            <input
                                                type="email"
                                                placeholder="Doctor Email Address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <span className={styles.icon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                </svg>
                                            </span>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className={styles.eyeIcon}
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label="Toggle password visibility"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                </svg>
                                            </button>
                                        </div>
                                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                                            {loading ? "Authenticating..." : "SIGN IN AS DOCTOR"}
                                        </button>
                                    </form>
                                )}

                                {/* DOCTOR REGISTER FORM */}
                                {doctorMode === 'register' && (
                                    <form
                                        className={styles.form}
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (!firstName || !email || !password || !registrationNumber) {
                                                toast.error('Please fill in all required fields.');
                                                return;
                                            }
                                            if (password.length < 8) {
                                                toast.error('Password must be at least 8 characters.');
                                                return;
                                            }
                                            setLoading(true);
                                            try {
                                                await registerDoctor({ firstName, lastName, email, password, registrationNumber, specialization, department });
                                                toast.success('Account created! Awaiting admin verification before you can log in.');
                                                setDoctorMode('login');
                                                resetForm();
                                            } catch (err) {
                                                toast.error(err.message || 'Registration failed.');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                    >
                                        <div className={styles.nameRow}>
                                            <div className={styles.inputGroup}>
                                                <input
                                                    type="text"
                                                    placeholder="First Name *"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <input
                                                    type="text"
                                                    placeholder="Last Name"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <span className={styles.icon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                    <polyline points="22,6 12,13 2,6"></polyline>
                                                </svg>
                                            </span>
                                            <input
                                                type="email"
                                                placeholder="Email Address *"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <span className={styles.icon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                </svg>
                                            </span>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Password (min 8 chars) *"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                            <button type="button" className={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                </svg>
                                            </button>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <span className={styles.icon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                                </svg>
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Medical Registration Number *"
                                                value={registrationNumber}
                                                onChange={(e) => setRegistrationNumber(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className={styles.nameRow}>
                                            <div className={styles.inputGroup}>
                                                <input
                                                    type="text"
                                                    placeholder="Specialization (e.g. Cardiology)"
                                                    value={specialization}
                                                    onChange={(e) => setSpecialization(e.target.value)}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <input
                                                    type="text"
                                                    placeholder="Department"
                                                    value={department}
                                                    onChange={(e) => setDepartment(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                                            {loading ? "Creating Account..." : "CREATE DOCTOR ACCOUNT"}
                                        </button>
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '8px' }}>
                                            Your account will be pending admin verification before you can log in.
                                        </p>
                                    </form>
                                )}
                            </motion.div>
                        )}

                        {/* PATIENT AUTHENTICATION FORM */}
                        {role === "patient" && (
                            <motion.div
                                key="patient-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Patient Method Selector */}
                                <div className={styles.methodSelector}>
                                    <button
                                        type="button"
                                        className={`${styles.methodPill} ${method === "phone" ? styles.methodPillActive : ""}`}
                                        onClick={() => handleMethodChange("phone")}
                                    >
                                        Phone OTP
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.methodPill} ${method === "email" ? styles.methodPillActive : ""}`}
                                        onClick={() => handleMethodChange("email")}
                                    >
                                        Email OTP
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.methodPill} ${method === "google" ? styles.methodPillActive : ""}`}
                                        onClick={() => handleMethodChange("google")}
                                    >
                                        Google
                                    </button>
                                </div>

                                {/* PATIENT PHONE FLOW */}
                                {method === "phone" && (
                                    <form
                                        className={styles.form}
                                        onSubmit={step === 1 ? handlePatientPhoneStep1 : handlePatientPhoneStep2}
                                    >
                                        {step === 1 ? (
                                            <>
                                                {mode === "register" && (
                                                    <>
                                                        <div className={styles.nameRow}>
                                                            <div className={styles.inputGroup}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="First Name"
                                                                    value={firstName}
                                                                    onChange={(e) => setFirstName(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className={styles.inputGroup}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Last Name"
                                                                    value={lastName}
                                                                    onChange={(e) => setLastName(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className={styles.inputGroup}>
                                                            <input
                                                                type="date"
                                                                placeholder="Date of Birth"
                                                                value={dateOfBirth}
                                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <div className={styles.inputGroup}>
                                                            <select
                                                                value={gender}
                                                                onChange={(e) => setGender(e.target.value)}
                                                                required
                                                            >
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </div>
                                                    </>
                                                )}

                                                <div className={styles.inputGroup}>
                                                    <span className={styles.icon}>📱</span>
                                                    <input
                                                        type="tel"
                                                        placeholder="Phone Number (e.g. +919876543210)"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <button type="submit" className={styles.submitBtn} disabled={loading}>
                                                    {loading ? "Sending OTP..." : mode === "login" ? "SEND PHONE OTP" : "REGISTER WITH PHONE"}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className={styles.noticeBanner}>
                                                    Enter the 6-digit OTP code sent to <strong>{phone}</strong>
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <span className={styles.icon}>🔑</span>
                                                    <input
                                                        type="text"
                                                        placeholder="6-Digit OTP Code"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        maxLength={6}
                                                        required
                                                    />
                                                </div>
                                                <button type="submit" className={styles.submitBtn} disabled={loading}>
                                                    {loading ? "Verifying..." : "VERIFY OTP & LOGIN"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.switchLink}
                                                    onClick={() => setStep(1)}
                                                    style={{ marginTop: "8px" }}
                                                >
                                                    ← Change Phone Number
                                                </button>
                                            </>
                                        )}
                                    </form>
                                )}

                                {/* PATIENT EMAIL FLOW */}
                                {method === "email" && (
                                    <form
                                        className={styles.form}
                                        onSubmit={step === 1 ? handlePatientEmailStep1 : handlePatientEmailStep2}
                                    >
                                        {step === 1 ? (
                                            <>
                                                {mode === "register" && (
                                                    <>
                                                        <div className={styles.nameRow}>
                                                            <div className={styles.inputGroup}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="First Name"
                                                                    value={firstName}
                                                                    onChange={(e) => setFirstName(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className={styles.inputGroup}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Last Name"
                                                                    value={lastName}
                                                                    onChange={(e) => setLastName(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className={styles.inputGroup}>
                                                            <input
                                                                type="date"
                                                                placeholder="Date of Birth"
                                                                value={dateOfBirth}
                                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <div className={styles.inputGroup}>
                                                            <select
                                                                value={gender}
                                                                onChange={(e) => setGender(e.target.value)}
                                                                required
                                                            >
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </div>
                                                    </>
                                                )}

                                                <div className={styles.inputGroup}>
                                                    <span className={styles.icon}>✉️</span>
                                                    <input
                                                        type="email"
                                                        placeholder="Patient Email Address"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <button type="submit" className={styles.submitBtn} disabled={loading}>
                                                    {loading ? "Sending OTP..." : mode === "login" ? "SEND EMAIL OTP" : "REGISTER WITH EMAIL"}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className={styles.noticeBanner}>
                                                    Enter the 6-digit OTP code sent to <strong>{email}</strong>
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <span className={styles.icon}>🔑</span>
                                                    <input
                                                        type="text"
                                                        placeholder="6-Digit OTP Code"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        maxLength={6}
                                                        required
                                                    />
                                                </div>
                                                <button type="submit" className={styles.submitBtn} disabled={loading}>
                                                    {loading ? "Verifying..." : "VERIFY OTP & LOGIN"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.switchLink}
                                                    onClick={() => setStep(1)}
                                                    style={{ marginTop: "8px" }}
                                                >
                                                    ← Change Email Address
                                                </button>
                                            </>
                                        )}
                                    </form>
                                )}

                                {/* PATIENT GOOGLE FLOW */}
                                {method === "google" && (
                                    <div className={styles.form}>
                                        <div className={styles.noticeBanner}>
                                            <strong>Google Sign-In Note:</strong><br />
                                            Backend Google callback currently returns JSON directly. A backend/frontend OAuth bridge is required before automatic frontend session establishment.
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.googleBtn}
                                            onClick={handleGoogleClick}
                                        >
                                            <svg className={styles.googleIcon} viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Continue with Google
                                        </button>
                                    </div>
                                )}

                                {/* Mode Toggle (Login vs Register) */}
                                {method !== "google" && (
                                    <p className={styles.switchAuth}>
                                        {mode === "login" ? (
                                            <>
                                                Don't have a patient account?{" "}
                                                <button
                                                    type="button"
                                                    className={styles.switchLink}
                                                    onClick={() => handleModeChange("register")}
                                                >
                                                    Create Account
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                Already have an account?{" "}
                                                <button
                                                    type="button"
                                                    className={styles.switchLink}
                                                    onClick={() => handleModeChange("login")}
                                                >
                                                    Sign In
                                                </button>
                                            </>
                                        )}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={styles.backHome}>
                        <Link to="/">← Back to Home</Link>
                    </div>
                </div>

                {/* Right Side: Lottie Welcome Animation */}
                <div className={styles.welcomeSection}>
                    <div className={styles.lottieContainer}>
                        <DotLottieReact
                            src={lottieUrl}
                            loop
                            autoplay
                            style={{ width: "100%", height: "400px" }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
