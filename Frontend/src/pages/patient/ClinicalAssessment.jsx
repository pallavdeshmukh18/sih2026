import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import {
  startClinicalSession,
  sendClinicalTextTurn,
  sendClinicalVoiceTurn,
  finalizeClinicalSession,
  getPatientAppointments,
  getMedicalId,
  fetchPublicDoctors,
  createAppointment,
} from "../../services/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplet,
  ExternalLink,
  FileText,
  FlaskConical,
  HeartPulse,
  Loader2,
  Mic,
  Pill,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  User,
  UserCheck,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "../../i18n";
import heroImage from "../../assets/teleconsult-hero.png";
import styles from "./ClinicalAssessment.module.css";

const formatRecordDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

const SYMPTOM_CARDS = [
  { id: "Fever & Chills", label: "Fever & Chills", icon: Droplet, color: "#e11d48", bg: "#ffe4e6", specialty: "General Medicine" },
  { id: "Severe Headache", label: "Severe Headache", icon: BrainCircuit, color: "#7c3aed", bg: "#ede9fe", specialty: "Neurology" },
  { id: "Cough & Cold", label: "Cough & Cold", icon: Activity, color: "#0284c7", bg: "#e0f2fe", specialty: "General Medicine" },
  { id: "Chest Pain", label: "Chest Pain", icon: HeartPulse, color: "#dc2626", bg: "#fee2e2", specialty: "Cardiology" },
  { id: "Abdominal Pain", label: "Abdominal Pain", icon: ShieldAlert, color: "#d97706", bg: "#fef3c7", specialty: "General Medicine" },
  { id: "Joint / Muscle Pain", label: "Joint / Muscle Pain", icon: Zap, color: "#ea580c", bg: "#ffedd5", specialty: "Orthopedics" },
  { id: "Shortness of Breath", label: "Shortness of Breath", icon: Stethoscope, color: "#059669", bg: "#d1fae5", specialty: "Cardiology" },
  { id: "Skin Rash", label: "Skin Rash", icon: Sparkles, color: "#9333ea", bg: "#f3e8ff", specialty: "Dermatology" },
];

export const SPECIALTY_META = {
  Cardiology: {
    name: "Cardiology",
    department: "Cardiovascular Care",
    icon: HeartPulse,
    color: "#dc2626",
    bg: "#fee2e2",
    badge: "Cardiovascular Specialist",
    desc: "Specialized in cardiovascular health, heart diagnostics, chest symptom evaluation, and blood pressure management.",
  },
  Neurology: {
    name: "Neurology",
    department: "Neurosciences & Stroke Unit",
    icon: BrainCircuit,
    color: "#7c3aed",
    bg: "#ede9fe",
    badge: "Neurology Specialist",
    desc: "Specialized in neurological diagnostics, severe headaches, migraines, vertigo, neuropathies, and nerve care.",
  },
  Orthopedics: {
    name: "Orthopedics",
    department: "Orthopedics & Joint Care",
    icon: Zap,
    color: "#ea580c",
    bg: "#ffedd5",
    badge: "Orthopedics & Bone Specialist",
    desc: "Specialized in musculoskeletal care, joint and muscle pain, bone health, spine integrity, and sports injuries.",
  },
  Dermatology: {
    name: "Dermatology",
    department: "Dermatology & Skin Care",
    icon: Sparkles,
    color: "#9333ea",
    bg: "#f3e8ff",
    badge: "Dermatology Specialist",
    desc: "Specialized in cutaneous disorders, allergies, skin rashes, eczema, lesions, and skin wellness.",
  },
  Pediatrics: {
    name: "Pediatrics",
    department: "Child Health & Pediatrics",
    icon: Droplet,
    color: "#0284c7",
    bg: "#e0f2fe",
    badge: "Pediatrics Specialist",
    desc: "Specialized in infant, child, and adolescent healthcare, developmental tracking, and pediatric triage.",
  },
  "General Medicine": {
    name: "General Medicine",
    department: "Internal Medicine & OPD",
    icon: Stethoscope,
    color: "#087b6d",
    bg: "#e6f6f0",
    badge: "Internal Medicine & OPD Specialist",
    desc: "Comprehensive diagnostic evaluation for fevers, infections, cough, abdominal symptoms, and primary care.",
  },
};

export const mapComplaintToSpecialty = (complaint = "") => {
  const c = String(complaint || "").toLowerCase();
  if (c.includes("chest") || c.includes("heart") || c.includes("palpitation") || c.includes("hypertension") || c.includes("breath")) {
    return "Cardiology";
  }
  if (c.includes("headache") || c.includes("migraine") || c.includes("dizziness") || c.includes("vertigo") || c.includes("numbness") || c.includes("seizure") || c.includes("brain")) {
    return "Neurology";
  }
  if (c.includes("joint") || c.includes("muscle") || c.includes("bone") || c.includes("fracture") || c.includes("back pain") || c.includes("knee") || c.includes("sprain") || c.includes("stiffness")) {
    return "Orthopedics";
  }
  if (c.includes("skin") || c.includes("rash") || c.includes("itching") || c.includes("allergy") || c.includes("acne") || c.includes("eczema") || c.includes("boil") || c.includes("lesion")) {
    return "Dermatology";
  }
  if (c.includes("child") || c.includes("baby") || c.includes("infant") || c.includes("pediatric") || c.includes("toddler")) {
    return "Pediatrics";
  }
  return "General Medicine";
};

const COMMON_CHIEF_COMPLAINTS = SYMPTOM_CARDS.map(s => s.id);

const getDynamicOptions = (question, language = "en") => {
  const lang = (language || "en").toLowerCase();
  if (lang === "hi") {
    return [
      { id: "opt_1", label: "आज ही शुरू हुआ" },
      { id: "opt_2", label: "2–3 दिन पहले" },
      { id: "opt_3", label: "1–2 सप्ताह से" },
      { id: "opt_4", label: "लंबे समय से / पुराना" }
    ];
  }
  if (lang === "mr") {
    return [
      { id: "opt_1", label: "आजच सुरू झाले" },
      { id: "opt_2", label: "2–3 दिवसांपूर्वी" },
      { id: "opt_3", label: "1–2 आठवड्यांपासून" },
      { id: "opt_4", label: "दीर्घकालीन / जुना त्रास" }
    ];
  }
  if (lang === "gu") {
    return [
      { id: "opt_1", label: "આજે જ શરૂ થયું" },
      { id: "opt_2", label: "2–3 દિવસ પહેલાં" },
      { id: "opt_3", label: "1–2 અઠવાડિયાથી" },
      { id: "opt_4", label: "લાંબા સમયથી / જૂનું" }
    ];
  }
  return [
    { id: "opt_1", label: "Just started today" },
    { id: "opt_2", label: "A few days" },
    { id: "opt_3", label: "A few weeks" },
    { id: "opt_4", label: "Long term / Chronic" }
  ];
};

export default function ClinicalAssessment() {
  const { user, token } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const appointmentIdFromUrl = searchParams.get("appointmentId");
  const doctorIdFromUrl = searchParams.get("doctorId");

  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointmentIdFromUrl || "");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [customComplaint, setCustomComplaint] = useState("");

  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [options, setOptions] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [customAnswerText, setCustomAnswerText] = useState("");

  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState(null);
  const [healthSummary, setHealthSummary] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctorIdFromUrl || "");
  const [targetDoctor, setTargetDoctor] = useState(null);
  const [recommendedSpecialization, setRecommendedSpecialization] = useState("");
  const [matchingSpecialists, setMatchingSpecialists] = useState([]);
  const [showAllDoctors, setShowAllDoctors] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [bookingType, setBookingType] = useState("in_person");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Voice Input States
  const [sessionLanguage, setSessionLanguage] = useState(currentLanguage || "en");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [micError, setMicError] = useState(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMedicalId(token).then((response) => {
      if (response.success && response.medicalId) setHealthSummary(response.medicalId);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchPublicDoctors(token).then((response) => {
      if (response.success && Array.isArray(response.doctors)) {
        setDoctors(response.doctors);
        const initialDoctorId = doctorIdFromUrl || "";
        setSelectedDoctorId(initialDoctorId);
        setTargetDoctor(response.doctors.find((doctor) => String(doctor.id) === String(initialDoctorId)) || null);
      }
    }).catch(() => {});
  }, [token, doctorIdFromUrl]);

  useEffect(() => {
    setTargetDoctor(doctors.find((doctor) => String(doctor.id) === String(selectedDoctorId)) || null);
  }, [doctors, selectedDoctorId]);

  // Synchronize specialty recommendations and matching doctors upon completion
  useEffect(() => {
    if (!isCompleted) return;
    const activeComplaint = chiefComplaint || customComplaint || complaintFromUrl || "";
    const specialty = recommendedSpecialization || mapComplaintToSpecialty(activeComplaint);
    if (!recommendedSpecialization && specialty) {
      setRecommendedSpecialization(specialty);
    }
    if (doctors.length > 0) {
      const matched = doctors.filter((d) => {
        const docSpec = (d.specialization || "").toLowerCase();
        const docDept = (d.department || "").toLowerCase();
        const target = specialty.toLowerCase();
        return docSpec.includes(target) || docDept.includes(target);
      });
      const finalMatched = matched.length > 0 ? matched : doctors.slice(0, 3);
      setMatchingSpecialists(finalMatched);

      if (!selectedDoctorId && finalMatched.length > 0) {
        setSelectedDoctorId(String(finalMatched[0].id));
        setTargetDoctor(finalMatched[0]);
      }
    }
  }, [isCompleted, recommendedSpecialization, chiefComplaint, customComplaint, complaintFromUrl, doctors, selectedDoctorId]);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const complaintFromUrl = searchParams.get("complaint");

  useEffect(() => {
    async function loadAppointments() {
      if (!token) return;
      try {
        const res = await getPatientAppointments(token);
        if (res.success && Array.isArray(res.appointments) && res.appointments.length > 0) {
          setAppointments(res.appointments);
          if (!selectedAppointmentId) {
            setSelectedAppointmentId(appointmentIdFromUrl || res.appointments[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load patient appointments for assessment:", err.message);
      }
    }
    loadAppointments();
  }, [token, appointmentIdFromUrl]);

  // Auto-start assessment if redirected from doctor booking with complaint
  useEffect(() => {
    if (!token || sessionId || loading || !complaintFromUrl) return;

    async function autoStart() {
      setLoading(true);
      setError(null);
      try {
        const activeLang = currentLanguage || "en";
        setSessionLanguage(activeLang);
        setChiefComplaint(complaintFromUrl);

        const payload = {
          chiefComplaint: complaintFromUrl,
          appointmentId: appointmentIdFromUrl || selectedAppointmentId || undefined,
          language: activeLang,
        };

        const res = await startClinicalSession(payload, token);
        if (res.success && res.sessionId) {
          const firstQ = res.nextQuestion || res.firstQuestion;
          setSessionId(res.sessionId);
          setCurrentQuestion(firstQ);
          setOptions(res.options || []);
          setConversationHistory([
            { role: "system", content: firstQ },
          ]);
        }
      } catch (err) {
        console.error("Auto start session failed:", err);
      } finally {
        setLoading(false);
      }
    }

    autoStart();
  }, [token, complaintFromUrl, sessionId, loading, appointmentIdFromUrl, selectedAppointmentId, currentLanguage]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    const activeComplaint = chiefComplaint || customComplaint;
    if (!activeComplaint.trim()) {
      setError("Please select or type your primary complaint to begin.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const activeLang = currentLanguage || "en";
      setSessionLanguage(activeLang);

      const payload = {
        chiefComplaint: activeComplaint,
        appointmentId: selectedAppointmentId || undefined,
        language: activeLang,
      };

      const res = await startClinicalSession(payload, token);
      if (res.success && res.sessionId) {
        const firstQ = res.nextQuestion || res.firstQuestion;
        setSessionId(res.sessionId);
        setCurrentQuestion(firstQ);
        setOptions(res.options || []);
        setConversationHistory([
          { role: "system", content: firstQ },
        ]);
      } else {
        throw new Error(res.message || "Failed to start clinical assessment.");
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setError(err.message || "Unable to start assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = async () => {
    setMicError(null);
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError(t("assessment.micDenied") || "Voice recording is not supported in this browser. Please use text or options.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = "";
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/wav",
      ];
      for (const type of candidateTypes) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const audioChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunks.length === 0) {
          setMicError("No audio recorded. Please try speaking again.");
          return;
        }

        const actualMime = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunks, { type: actualMime });

        let ext = ".webm";
        if (actualMime.includes("ogg")) ext = ".ogg";
        else if (actualMime.includes("wav")) ext = ".wav";
        else if (actualMime.includes("mp4") || actualMime.includes("m4a")) ext = ".m4a";

        const filename = `patient_voice${ext}`;
        await handleSendVoiceTurn(audioBlob, filename);
      };

      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError(t("assessment.micDenied") || "Microphone access is required for voice input. Please grant permission or use text input.");
      } else {
        setMicError(err.message || "Failed to access microphone. Please try text input.");
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSendVoiceTurn = async (audioBlob, filename) => {
    if (!sessionId || loading) return;

    setLoading(true);
    setIsProcessingVoice(true);
    setError(null);
    setMicError(null);

    try {
      const res = await sendClinicalVoiceTurn(sessionId, audioBlob, filename, token);
      if (res.success) {
        const transcriptText = res.transcript || "";
        if (transcriptText) {
          setLastTranscript(transcriptText);
        }

        const userContent = transcriptText || "[Voice Response]";
        const newHistory = [
          ...conversationHistory,
          { role: "user", content: userContent },
        ];

        const sessionDone = res.isComplete || res.isCompleted || (res.session && res.session.is_completed);
        const finalSummary = res.summary || (res.session && res.session.summary);

        if (sessionDone) {
          setIsCompleted(true);
          setSummary(finalSummary || "");
          setConversationHistory(newHistory);
          if (res.recommendedSpecialization) {
            setRecommendedSpecialization(res.recommendedSpecialization);
          }
          if (Array.isArray(res.matchingSpecialists) && res.matchingSpecialists.length > 0) {
            setMatchingSpecialists(res.matchingSpecialists);
            setSelectedDoctorId(String(res.matchingSpecialists[0].id));
            setTargetDoctor(res.matchingSpecialists[0]);
          }
        } else if (res.nextQuestion) {
          setCurrentQuestion(res.nextQuestion);
          setOptions(res.options || []);
          setConversationHistory([
            ...newHistory,
            { role: "system", content: res.nextQuestion },
          ]);
        }
      } else {
        throw new Error(res.message || "Voice turn processing failed.");
      }
    } catch (err) {
      console.error("Voice turn error:", err);
      setError(err.message || "Could not process speech. Please try speaking again or use text input.");
    } finally {
      setLoading(false);
      setIsProcessingVoice(false);
    }
  };

  const handleSendResponse = async (answerText) => {
    const textToSend = answerText || customAnswerText;
    if (!textToSend.trim() || !sessionId || loading || isRecording || isProcessingVoice) return;

    setLoading(true);
    setError(null);
    setCustomAnswerText("");

    const newHistory = [
      ...conversationHistory,
      { role: "user", content: textToSend },
    ];
    setConversationHistory(newHistory);

    try {
      const res = await sendClinicalTextTurn(sessionId, textToSend, token);
      if (res.success) {
        const sessionDone = res.isComplete || res.isCompleted || (res.session && res.session.is_completed);
        const finalSummary = res.summary || (res.session && res.session.summary);

        if (sessionDone) {
          setIsCompleted(true);
          setSummary(finalSummary || "");
          if (res.recommendedSpecialization) {
            setRecommendedSpecialization(res.recommendedSpecialization);
          }
          if (Array.isArray(res.matchingSpecialists) && res.matchingSpecialists.length > 0) {
            setMatchingSpecialists(res.matchingSpecialists);
            setSelectedDoctorId(String(res.matchingSpecialists[0].id));
            setTargetDoctor(res.matchingSpecialists[0]);
          }
        } else if (res.nextQuestion) {
          setCurrentQuestion(res.nextQuestion);
          setOptions(res.options || []);
          setConversationHistory([
            ...newHistory,
            { role: "system", content: res.nextQuestion },
          ]);
        }
      } else {
        throw new Error(res.message || "Failed to process response.");
      }
    } catch (err) {
      console.error("Error sending response turn:", err);
      setError(err.message || "Unable to send response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!sessionId || isFinalizing) return;
    setIsFinalizing(true);
    setError(null);

    try {
      const res = await finalizeClinicalSession(sessionId, token);
      if (res.success) {
        setIsCompleted(true);
        const finalSummary = res.summary || (res.session && res.session.summary) || "Assessment completed successfully.";
        setSummary(finalSummary);
        if (res.recommendedSpecialization) {
          setRecommendedSpecialization(res.recommendedSpecialization);
        }
        if (Array.isArray(res.matchingSpecialists) && res.matchingSpecialists.length > 0) {
          setMatchingSpecialists(res.matchingSpecialists);
          setSelectedDoctorId(String(res.matchingSpecialists[0].id));
          setTargetDoctor(res.matchingSpecialists[0]);
        }
      } else {
        throw new Error(res.message || "Failed to finalize session.");
      }
    } catch (err) {
      console.error("Error finalizing session:", err);
      setError(err.message || "Unable to complete assessment. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleOpenBooking = (doctor = null, type = "in_person") => {
    if (doctor) {
      setSelectedDoctorId(String(doctor.id));
      setTargetDoctor(doctor);
    }
    setBookingType(type);
    setShowBookingModal(true);
  };

  const handleCreateBooking = async (event, customDoctor = null) => {
    if (event && event.preventDefault) event.preventDefault();
    const docId = customDoctor ? String(customDoctor.id) : selectedDoctorId;
    if (!docId) {
      setError("Please select a doctor before confirming your appointment.");
      return;
    }
    setBookingSubmitting(true);
    setError(null);
    try {
      const activeComplaint = chiefComplaint || customComplaint || "Clinical Consultation";
      const chosenDoc = customDoctor || targetDoctor || doctors.find((d) => String(d.id) === String(docId));
      const res = await createAppointment({
        doctorId: docId,
        scheduledAt: new Date(bookingDate).toISOString(),
        durationMinutes: 30,
        appointmentType: bookingType,
        reason: activeComplaint,
        notes: summary ? `[Pre-Consultation Clinical Intake Briefing]:\n${summary}` : `Assessment session #${sessionId}`,
        sessionId: sessionId || undefined,
      }, token);

      if (res.success || res.appointment) {
        setBookedAppointment({
          ...(res.appointment || {}),
          doctorId: docId,
          doctorName: chosenDoc?.name || `Dr. ${chosenDoc?.first_name || chosenDoc?.firstName || ""} ${chosenDoc?.last_name || chosenDoc?.lastName || ""}`.trim() || "Specialist Doctor",
          specialization: chosenDoc?.specialization || recommendedSpecialization || "General Medicine",
          scheduledAt: bookingDate,
          appointmentType: bookingType,
        });
        setBookingSuccess(true);
        setShowBookingModal(false);
      } else {
        throw new Error(res.message || "Appointment booking failed.");
      }
    } catch (bookingError) {
      console.error("Booking error:", bookingError);
      setError(bookingError.message || "Failed to book appointment. Please try again.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <motion.main
      className={`${styles.page} workspacePage`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <header className={styles.hero}>
        <img src={heroImage} alt="Clinical assessment hero" />
        <div className={styles.heroCopy}>
          <span>{t("assessment.badge", "CLINICAL TRIAGE")}</span>
          <h1>{t("assessment.title", "Clinical Assessment")}</h1>
          <p>{t("assessment.subtitle", "Evaluate your symptoms with AI-assisted clinical triage before consulting with your doctor.")}</p>
        </div>
        <button
          onClick={() => navigate("/patient/dashboard")}
          className={styles.heroBackBtn}
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={15} /> {t("common.back", "Back")}
        </button>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {/* Feature Hero Card */}
          <section className={styles.requestCard}>
            <div className={styles.requestCardLeft}>
              <span className={styles.requestCardIcon}><Stethoscope size={22} color="#087b6d" /></span>
              <div>
                <h2>{t("assessment.intakeHeroTitle", "Intelligent Pre-Consultation Triage")}</h2>
                <p>{t("assessment.intakeHeroSubtitle", "Answer guided diagnostic questions to generate a clinical briefing for your doctor.")}</p>
              </div>
            </div>
            <div className={styles.badgePill}>
              <Sparkles size={13} /> {t("assessment.aiAssist", "AI Clinical Assist")}
            </div>
          </section>

          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!sessionId && (
            <form onSubmit={handleStartSession} className={styles.triageCard}>
              <header className={styles.cardHeader}>
                <h3>{t("assessment.chiefComplaintPrompt", "What is your main symptom or health concern today?")}</h3>
                <p>{t("assessment.selectPrimaryDesc", "Select your primary symptom to begin adaptive clinical questioning:")}</p>
              </header>

              <div className={styles.symptomGrid}>
                {SYMPTOM_CARDS.map((item) => {
                  const Icon = item.icon;
                  const isActive = chiefComplaint === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.symptomCard} ${isActive ? styles.symptomCardActive : ""}`}
                      onClick={() => {
                        setChiefComplaint(item.id);
                        setCustomComplaint("");
                      }}
                    >
                      <div className={styles.symptomIcon} style={{ background: item.bg, color: item.color }}>
                        <Icon size={17} />
                      </div>
                      <span className={styles.symptomLabel}>{item.label}</span>
                      <div className={styles.symptomRadio}>
                        {isActive && <Check size={11} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className={styles.customSection}>
                <label className={styles.sectionLabel}>
                  <span>{t("assessment.customComplaintPrompt", "Or describe your symptoms in your own words")}</span>
                  <small>{t("common.optional", "Optional")}</small>
                </label>
                <div className={styles.customInputBox}>
                  <FileText size={16} className={styles.customIcon} />
                  <input
                    type="text"
                    className={styles.customInput}
                    placeholder={t("assessment.customComplaintPlaceholder", "e.g., Throbbing temple headache since this morning, mild nausea...")}
                    value={customComplaint}
                    onChange={(e) => {
                      setCustomComplaint(e.target.value);
                      setChiefComplaint("");
                    }}
                  />
                  {customComplaint && (
                    <button type="button" onClick={() => setCustomComplaint("")} className={styles.clearBtn} aria-label="Clear input">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {appointments.length > 0 && (
                <div className={styles.apptLinkRow}>
                  <label><Calendar size={14} /> {t("assessment.selectApptOptional", "Link with Upcoming Appointment")}:</label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  >
                    {appointments.map((appt) => (
                      <option key={appt.id} value={appt.id}>
                        Dr. {appt.doctor_first_name} {appt.doctor_last_name} ({appt.specialization || "General"}) - {new Date(appt.scheduled_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <footer className={styles.cardFooter}>
                <div className={styles.securityHint}>
                  <ShieldCheck size={16} color="#087b6d" />
                  <span>{t("assessment.clinicalGrade", "Clinical-grade triage · Encrypted & Private")}</span>
                </div>
                <button type="submit" className={styles.startBtn} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={15} className={styles.spin} />
                      <span>{t("assessment.starting", "Initializing Session...")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("assessment.beginAssessment", "Begin Assessment")}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </footer>
            </form>
          )}

          {sessionId && !isCompleted && (
            <div className={styles.chatWindow}>
              <div className={styles.questionCard}>
                <div className={styles.questionBadge}>
                  <Stethoscope size={13} /> {t("assessment.intakeAssistant", "CLINICAL AI QUESTION")}
                </div>
                <div className={styles.questionText}>{currentQuestion}</div>

                {/* Option-based choices */}
                <div className={styles.optionsGrid}>
                  {(options && options.length > 0
                    ? options
                    : getDynamicOptions(currentQuestion, currentLanguage)
                  ).map((opt, idx) => {
                    const label = typeof opt === "string" ? opt : opt.label || opt.id;
                    const key = typeof opt === "string" ? `${opt}-${idx}` : opt.id || idx;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={styles.optionBtn}
                        onClick={() => handleSendResponse(label)}
                        disabled={loading || isRecording || isProcessingVoice}
                      >
                        <span>{label}</span>
                        <ArrowRight size={14} className={styles.optionArrow} />
                      </button>
                    );
                  })}
                </div>

                {/* Custom typed / spoken response option */}
                <div className={styles.customAnswerSection}>
                  <span className={styles.customAnswerLabel}>{t("assessment.typeAnswer", "Or type a specific response:")}</span>
                  <div className={styles.inputGroup}>
                    <input
                      type="text"
                      className={styles.customInput}
                      placeholder={t("assessment.typeAnswerPlaceholder") || "Type your answer here..."}
                      value={customAnswerText}
                      onChange={(e) => setCustomAnswerText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSendResponse();
                        }
                      }}
                      disabled={loading || isRecording || isProcessingVoice}
                    />
                    <button
                      type="button"
                      className={styles.sendBtn}
                      onClick={() => handleSendResponse()}
                      disabled={loading || isRecording || isProcessingVoice || !customAnswerText.trim()}
                    >
                      <Send size={15} />
                    </button>
                  </div>

                  {/* Voice Recording Control */}
                  <div className={styles.voiceSection}>
                    {!isRecording ? (
                      <button
                        type="button"
                        className={styles.voiceBtn}
                        onClick={handleStartRecording}
                        disabled={loading || isProcessingVoice}
                        aria-label="Speak your answer using microphone"
                      >
                        <Mic size={15} />
                        <span>🎙️ {t("assessment.speakAnswer") || "Speak your answer"}</span>
                      </button>
                    ) : (
                      <div className={styles.recordingActiveContainer}>
                        <div className={styles.recordingPulseDot}></div>
                        <span>{t("assessment.recording") || "Recording..."} ({formatDuration(recordingDuration)})</span>
                        <button
                          type="button"
                          className={styles.stopRecordingBtn}
                          onClick={handleStopRecording}
                          aria-label="Stop recording"
                        >
                          <Square size={11} fill="currentColor" /> {t("assessment.stopRecording") || "Stop"}
                        </button>
                      </div>
                    )}

                    {isProcessingVoice && (
                      <span className={styles.voiceProcessing}>
                        <Loader2 size={13} className={styles.spin} /> {t("assessment.processingVoice") || "Transcribing speech..."}
                      </span>
                    )}
                  </div>

                  {micError && (
                    <div className={styles.micAlert}>
                      <AlertCircle size={13} /> {micError}
                    </div>
                  )}

                  {lastTranscript && !isRecording && (
                    <div className={styles.transcriptionCard}>
                      <span className={styles.transcriptionHeader}>{t("assessment.youSaid") || "You said:"}</span>
                      <p className={styles.transcriptionBody}>"{lastTranscript}"</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.finalizeBar}>
                <button
                  onClick={() => handleFinalize()}
                  disabled={isFinalizing}
                  className={styles.finalizeBtn}
                >
                  {isFinalizing ? (
                    <><Loader2 size={14} className={styles.spin} /> {t("account.saving", "Finalizing...")}</>
                  ) : (
                    <><CheckCircle2 size={14} /> {t("assessment.completeAssessmentNow", "Complete Assessment Now")}</>
                  )}
                </button>
              </div>

              {conversationHistory.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyTitle}>{t("assessment.intakeTranscript", "Intake Transcript")}</div>
                  {conversationHistory.map((msg, idx) => (
                    <div key={idx} className={styles.chatTurn}>
                      {msg.role === "system" ? (
                        <div className={styles.systemTurn}>
                          <span className={styles.turnSpeaker}>{t("assessment.doctorAi", "Doctor AI:")}</span>
                          <p>{msg.content}</p>
                        </div>
                      ) : (
                        <div className={styles.patientTurn}>
                          <span className={styles.turnSpeaker}>{t("assessment.you", "You:")}</span>
                          <p>{msg.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isCompleted && (
            <div className={styles.completionSection}>
              {bookingSuccess && bookedAppointment ? (
                <div className={styles.bookingSuccessCard}>
                  <div className={styles.bookingSuccessIcon}>
                    <CheckCircle2 size={36} color="#059669" />
                  </div>
                  <h2>{t("assessment.bookingSuccessTitle", "Appointment Confirmed!")}</h2>
                  <p className={styles.bookingSuccessSub}>
                    {t("assessment.bookingSuccessMsg", "Your consultation has been successfully scheduled. Your clinical intake briefing has been forwarded to the doctor.")}
                  </p>

                  <div className={styles.bookedDetailsBox}>
                    <div className={styles.bookedDetailRow}>
                      <span className={styles.bookedLabel}>Doctor:</span>
                      <span className={styles.bookedValue}>{bookedAppointment.doctorName || "Specialist Doctor"}</span>
                    </div>
                    <div className={styles.bookedDetailRow}>
                      <span className={styles.bookedLabel}>Department:</span>
                      <span className={styles.bookedValue}>{bookedAppointment.specialization || recommendedSpecialization || "General Medicine"}</span>
                    </div>
                    <div className={styles.bookedDetailRow}>
                      <span className={styles.bookedLabel}>Date & Time:</span>
                      <span className={styles.bookedValue}>
                        {new Date(bookedAppointment.scheduledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}
                      </span>
                    </div>
                    <div className={styles.bookedDetailRow}>
                      <span className={styles.bookedLabel}>Consultation Type:</span>
                      <span className={styles.bookedValue}>
                        {bookedAppointment.appointmentType === "video" ? "📹 Teleconsultation (Video Call)" : "🏥 In-Person Hospital Consultation"}
                      </span>
                    </div>
                    <div className={styles.bookedDetailRow}>
                      <span className={styles.bookedLabel}>Triage Status:</span>
                      <span className={styles.bookedValue} style={{ color: "#087b6d", fontWeight: 750 }}>
                        ✓ Pre-Consultation Briefing Attached (Session #{sessionId})
                      </span>
                    </div>
                  </div>

                  <div className={styles.completionActions}>
                    <button
                      onClick={() => navigate("/patient/appointments")}
                      className={styles.startBtn}
                      style={{ width: "auto", padding: "0 24px" }}
                    >
                      <Calendar size={15} /> {t("navigation.appointments", "View in Appointments")}
                    </button>
                    <button
                      onClick={() => navigate("/patient/dashboard")}
                      className={styles.secondaryBtn}
                    >
                      {t("assessment.returnDashboard", "Return to Dashboard")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.completionCard}>
                  <div className={styles.completionHeader}>
                    <div className={styles.completionIcon}>
                      <CheckCircle2 size={30} />
                    </div>
                    <div>
                      <h2>{t("assessment.assessmentComplete", "Assessment Complete!")}</h2>
                      <p className={styles.completionSub}>
                        {t("assessment.assessmentSuccess", "Your structured clinical history has been successfully created and attached to your record.")}
                      </p>
                    </div>
                  </div>

                  {summary && (
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryHeader}>
                        <FileText size={15} color="#087b6d" />
                        <strong>{t("assessment.viewSummary", "Clinical Intake Summary for Doctor:")}</strong>
                      </div>
                      <p>{summary}</p>
                    </div>
                  )}

                  {/* Specialist Recommendation Banner */}
                  {(() => {
                    const activeComplaint = chiefComplaint || customComplaint || complaintFromUrl || "";
                    const spec = recommendedSpecialization || mapComplaintToSpecialty(activeComplaint);
                    const meta = SPECIALTY_META[spec] || SPECIALTY_META["General Medicine"];
                    const MetaIcon = meta.icon;

                    return (
                      <div
                        className={styles.specialtyBanner}
                        style={{
                          borderColor: `${meta.color}35`,
                          background: `linear-gradient(135deg, ${meta.bg} 0%, #ffffff 100%)`,
                        }}
                      >
                        <div className={styles.specialtyBannerLeft}>
                          <div className={styles.specialtyIconWrap} style={{ background: meta.color, color: "#ffffff" }}>
                            <MetaIcon size={24} />
                          </div>
                          <div>
                            <div className={styles.specialtyBadge} style={{ color: meta.color, background: `${meta.color}18` }}>
                              <Sparkles size={11} /> {meta.badge}
                            </div>
                            <h3 className={styles.specialtyTitle}>
                              {t("assessment.recommendedSpecialty", "Recommended Care Specialty")}: <span>{spec}</span>
                            </h3>
                            <p className={styles.specialtyDesc}>
                              {meta.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Specialist Doctor Cards Direct Booking */}
                  <div className={styles.bookingPromptSection}>
                    <div className={styles.bookingPromptHeader}>
                      <div>
                        <h4>{t("assessment.bookConsultTitle", "Direct Specialist Booking")}</h4>
                        <p>{t("assessment.bookConsultSubtitle", "Choose a verified specialist doctor to book an appointment with your clinical intake notes pre-linked:")}</p>
                      </div>
                      {doctors.length > matchingSpecialists.length && (
                        <button
                          type="button"
                          className={styles.toggleDoctorsBtn}
                          onClick={() => setShowAllDoctors(!showAllDoctors)}
                        >
                          {showAllDoctors ? "Show Recommended Only" : `Browse All Doctors (${doctors.length})`}
                        </button>
                      )}
                    </div>

                    <div className={styles.specialistsGrid}>
                      {(showAllDoctors ? doctors : (matchingSpecialists.length > 0 ? matchingSpecialists : doctors.slice(0, 3))).map((doc) => {
                        const docName = doc.name || `Dr. ${doc.first_name || doc.firstName || ""} ${doc.last_name || doc.lastName || ""}`.trim();
                        const docSpecialty = doc.specialization || "General Medicine";
                        const docDept = doc.department || "Outpatient Care";
                        const isSelected = String(doc.id) === String(selectedDoctorId);

                        return (
                          <div
                            key={doc.id}
                            className={`${styles.specialistCard} ${isSelected ? styles.specialistCardActive : ""}`}
                            onClick={() => {
                              setSelectedDoctorId(String(doc.id));
                              setTargetDoctor(doc);
                            }}
                          >
                            <div className={styles.specialistTop}>
                              <div className={styles.doctorAvatar}>
                                <User size={20} color="#087b6d" />
                              </div>
                              <div className={styles.doctorInfo}>
                                <div className={styles.doctorNameRow}>
                                  <h5>{docName}</h5>
                                  <span className={styles.verifiedBadge} title="Verified Doctor">
                                    <Check size={10} /> Verified
                                  </span>
                                </div>
                                <span className={styles.docSpecialtyTag}>{docSpecialty}</span>
                                <span className={styles.docDeptTag}><Building size={11} /> {docDept}</span>
                              </div>
                            </div>

                            <div className={styles.doctorCardFooter}>
                              <div className={styles.availabilityPill}>
                                <span className={styles.liveDot}></span> Available
                              </div>
                              <div className={styles.cardActionBtns}>
                                <button
                                  type="button"
                                  className={styles.quickBookBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenBooking(doc, "in_person");
                                  }}
                                >
                                  🏥 In-Person
                                </button>
                                <button
                                  type="button"
                                  className={styles.quickTeleconsultBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenBooking(doc, "video");
                                  }}
                                >
                                  📹 Video Call
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.customDoctorBookingBanner}>
                      <button
                        type="button"
                        className={styles.startBtn}
                        onClick={() => handleOpenBooking(targetDoctor || matchingSpecialists[0] || doctors[0], "in_person")}
                        style={{ width: "auto", padding: "0 28px" }}
                      >
                        <Calendar size={15} />
                        {targetDoctor
                          ? `Book with ${targetDoctor.name || `Dr. ${targetDoctor.firstName || targetDoctor.first_name || ""} ${targetDoctor.lastName || targetDoctor.last_name || ""}`.trim()}`
                          : "Book with Recommended Doctor"}
                      </button>
                    </div>
                  </div>

                  <div className={styles.completionActions}>
                    <button
                      onClick={() => navigate("/patient/dashboard")}
                      className={styles.secondaryBtn}
                    >
                      {t("assessment.returnDashboard", "Return to Dashboard")}
                    </button>
                    <button
                      onClick={() => navigate("/patient/history")}
                      className={styles.secondaryBtn}
                    >
                      {t("navigation.history", "View History")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Column */}
        <aside className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <h3>{t("assessment.howItWorks", "How Triage Works")}</h3>
            <div className={styles.stepsList}>
              <div className={styles.stepItem}>
                <span className={styles.stepNum}>1</span>
                <div>
                  <strong>{t("assessment.step1Title", "Select Chief Complaint")}</strong>
                  <p>{t("assessment.step1Desc", "Pick your primary symptom or enter a description.")}</p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNum}>2</span>
                <div>
                  <strong>{t("assessment.step2Title", "Interactive Clinical Turn")}</strong>
                  <p>{t("assessment.step2Desc", "Answer adaptive questions via voice or quick choices.")}</p>
                </div>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNum}>3</span>
                <div>
                  <strong>{t("assessment.step3Title", "Specialist Doctor Referral")}</strong>
                  <p>{t("assessment.step3Desc", "Instantly book an appointment with a matching specialist.")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <h3>{t("assessment.profileSnapshot", "Your Medical Profile")}</h3>
              <button type="button" onClick={() => navigate("/patient/medical-id")}>{t("common.view", "View")}</button>
            </div>
            <div className={styles.profileMini}>
              <div className={styles.miniItem}>
                <User size={13} color="#087b6d" />
                <span>{user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Verified Patient"}</span>
              </div>
              <div className={styles.miniItem}>
                <AlertCircle size={13} color="#e11d48" />
                <span>{healthSummary?.allergies?.length || 0} {t("medicalId.allergies", "Allergies Recorded")}</span>
              </div>
              <div className={styles.miniItem}>
                <Pill size={13} color="#0d9488" />
                <span>{healthSummary?.medications?.length || 0} {t("medicalId.currentMedications", "Active Medications")}</span>
              </div>
            </div>
          </div>

          <div className={styles.emergencyCard}>
            <AlertTriangle size={18} />
            <div>
              <strong>{t("assessment.emergencyTitle", "Emergency Advisory")}</strong>
              <p>{t("assessment.emergencyNotice", "If you are experiencing severe chest pain, sudden numbness, or difficulty breathing, call 112 immediately.")}</p>
            </div>
          </div>
        </aside>
      </div>

      {showBookingModal && (
        <div className={styles.bookingOverlay} role="dialog" aria-modal="true" aria-label="Book an appointment">
          <motion.div
            className={styles.bookingModal}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <div className={styles.modalIcon}>
                  <Calendar size={20} color="#087b6d" />
                </div>
                <div>
                  <h3>Book Doctor Appointment</h3>
                  <p>Your clinical intake triage data will be attached automatically.</p>
                </div>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowBookingModal(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => handleCreateBooking(e)}>
              {/* Doctor Selector */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <User size={13} /> Select Specialist Doctor:
                </label>
                <select
                  className={styles.formSelect}
                  value={selectedDoctorId}
                  onChange={(event) => {
                    setSelectedDoctorId(event.target.value);
                    setTargetDoctor(doctors.find((d) => String(d.id) === String(event.target.value)) || null);
                  }}
                  required
                >
                  {doctors.map((doctor) => {
                    const name = doctor.name || `Dr. ${doctor.firstName || doctor.first_name || ""} ${doctor.lastName || doctor.last_name || ""}`.trim();
                    return (
                      <option key={doctor.id} value={doctor.id}>
                        {name} {doctor.specialization ? `(${doctor.specialization})` : ""} - {doctor.department || "OPD"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Consultation Mode */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <Stethoscope size={13} /> Mode of Consultation:
                </label>
                <div className={styles.consultModeGrid}>
                  <button
                    type="button"
                    className={`${styles.consultModeBtn} ${bookingType === "in_person" ? styles.consultModeActive : ""}`}
                    onClick={() => setBookingType("in_person")}
                  >
                    <div className={styles.modeIcon}>🏥</div>
                    <div>
                      <strong>In-Person Hospital Visit</strong>
                      <small>Physical examination at OPD Clinic</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.consultModeBtn} ${bookingType === "video" ? styles.consultModeActive : ""}`}
                    onClick={() => setBookingType("video")}
                  >
                    <div className={styles.modeIcon}>📹</div>
                    <div>
                      <strong>Teleconsultation (Video)</strong>
                      <small>Secure HD WebRTC consultation</small>
                    </div>
                  </button>
                </div>
              </div>

              {/* Date & Time */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <Clock size={13} /> Preferred Date & Time:
                </label>
                <input
                  type="datetime-local"
                  className={styles.formInput}
                  value={bookingDate}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(event) => setBookingDate(event.target.value)}
                  required
                />
              </div>

              {/* Clinical Note Attachment Notice */}
              <div className={styles.triageAttachedBox}>
                <ShieldCheck size={16} color="#087b6d" />
                <div>
                  <strong>Attached Clinical Assessment:</strong>
                  <p>Chief Complaint: <em>{chiefComplaint || customComplaint || "Clinical Triage"}</em> (Session #{sessionId})</p>
                </div>
              </div>

              <div className={styles.bookingActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowBookingModal(false)}
                  disabled={bookingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.startBtn}
                  style={{ width: "auto", padding: "0 24px" }}
                  disabled={bookingSubmitting}
                >
                  {bookingSubmitting ? (
                    <>
                      <Loader2 size={15} className={styles.spin} />
                      <span>Confirming Appointment...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Confirm & Book Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.main>
  );
}
