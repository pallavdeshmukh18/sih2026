import React, { useState, useEffect, useRef } from "react";
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
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Droplet,
  FileText,
  FlaskConical,
  HeartPulse,
  Leaf,
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
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "../../i18n";
import heroImage from "../../assets/teleconsult-hero.png";
import VoiceOrb from "../../components/voice/VoiceOrb";
import styles from "./ClinicalAssessment.module.css";

const base64ToAudioBlob = (base64) => {
  const bytes = atob(base64);
  const values = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) values[index] = bytes.charCodeAt(index);
  return new Blob([values], { type: "audio/wav" });
};

const formatRecordDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

const SYMPTOM_CARDS = [
  { id: "Fever & Chills", label: "Fever & Chills", icon: Droplet, color: "#e11d48", bg: "#ffe4e6" },
  { id: "Severe Headache", label: "Severe Headache", icon: BrainCircuit, color: "#7c3aed", bg: "#ede9fe" },
  { id: "Cough & Cold", label: "Cough & Cold", icon: Activity, color: "#0284c7", bg: "#e0f2fe" },
  { id: "Chest Pain", label: "Chest Pain", icon: HeartPulse, color: "#dc2626", bg: "#fee2e2" },
  { id: "Abdominal Pain", label: "Abdominal Pain", icon: ShieldAlert, color: "#d97706", bg: "#fef3c7" },
  { id: "Joint / Muscle Pain", label: "Joint / Muscle Pain", icon: Zap, color: "#ea580c", bg: "#ffedd5" },
  { id: "Shortness of Breath", label: "Shortness of Breath", icon: Stethoscope, color: "#059669", bg: "#d1fae5" },
  { id: "Skin Rash", label: "Skin Rash", icon: Sparkles, color: "#9333ea", bg: "#f3e8ff" },
];

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
  const [consultationType, setConsultationType] = useState("allopathic");

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
  const [showBookingModal, setShowBookingModal] = useState(false);
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
  const [recordingStream, setRecordingStream] = useState(null);
  const [ttsAudio, setTtsAudio] = useState(null);
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const ttsAudioRef = useRef(null);
  const ttsObjectUrlRef = useRef(null);

  const stopTtsPlayback = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.onended = null;
      ttsAudioRef.current.onerror = null;
      ttsAudioRef.current = null;
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = null;
    }
    setTtsAudio(null);
    setIsPlayingTts(false);
  };

  useEffect(() => () => stopTtsPlayback(), []);

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
          if (!selectedAppointmentId && appointmentIdFromUrl) {
            setSelectedAppointmentId(appointmentIdFromUrl);
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
    let activeComplaint = "";
    if (customComplaint.trim()) {
      activeComplaint = customComplaint.trim();
    } else if (chiefComplaint) {
      activeComplaint = chiefComplaint;
    }

    if (!activeComplaint.trim()) {
      setError("Please select a symptom or describe your health concern to begin.");
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
        doctorId: selectedDoctorId || undefined,
        language: activeLang,
        consultation_type: consultationType,
        consultationType: consultationType,
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
    stopTtsPlayback();
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
      setRecordingStream(stream);
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
      setRecordingStream(null);
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

        if (res.audioBase64 && !sessionDone) {
          const objectUrl = URL.createObjectURL(base64ToAudioBlob(res.audioBase64));
          const audio = new Audio(objectUrl);
          ttsObjectUrlRef.current = objectUrl;
          ttsAudioRef.current = audio;
          setTtsAudio(audio);
          setIsPlayingTts(true);
          audio.onended = stopTtsPlayback;
          audio.onerror = stopTtsPlayback;
          await audio.play();
        }

        if (sessionDone) {
          setIsCompleted(true);
          setSummary(finalSummary || "");
          setConversationHistory(newHistory);
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

  const handleCreateBooking = async (event) => {
    event.preventDefault();
    if (!selectedDoctorId || !sessionId) {
      setError("Please select a doctor before confirming the appointment.");
      return;
    }
    setBookingSubmitting(true);
    try {
      await createAppointment({
        doctorId: selectedDoctorId,
        scheduledAt: new Date(bookingDate).toISOString(),
        durationMinutes: 30,
        appointmentType: bookingType,
        reason: chiefComplaint || "Clinical Consultation",
        notes: summary,
        sessionId,
      }, token);
      setShowBookingModal(false);
      navigate("/patient/dashboard?bookingSuccess=1");
    } catch (bookingError) {
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

              <div className={styles.consultationPathwaySection} style={{ marginBottom: "24px", marginTop: "16px" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
                  {t("assessment.selectPathway", "Select Assessment Pathway:")}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setConsultationType("allopathic")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: consultationType === "allopathic" ? "2px solid #087b6d" : "1px solid #e2e8f0",
                      background: consultationType === "allopathic" ? "#f0fdf4" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: consultationType === "allopathic" ? "#087b6d" : "#f1f5f9",
                      color: consultationType === "allopathic" ? "#ffffff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <Stethoscope size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.925rem", color: consultationType === "allopathic" ? "#0f172a" : "#334155" }}>
                        Modern Allopathic
                      </div>
                      <div style={{ fontSize: "0.775rem", color: "#64748b" }}>
                        Standard clinical triage & symptom breakdown
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultationType("ayush")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: consultationType === "ayush" ? "2px solid #16a34a" : "1px solid #e2e8f0",
                      background: consultationType === "ayush" ? "#f0fdf4" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: consultationType === "ayush" ? "#16a34a" : "#f1f5f9",
                      color: consultationType === "ayush" ? "#ffffff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      <Leaf size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.925rem", color: consultationType === "ayush" ? "#0f172a" : "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                        AYUSH / Ayurvedic
                        <span style={{ fontSize: "0.7rem", background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>AYUSH</span>
                      </div>
                      <div style={{ fontSize: "0.775rem", color: "#64748b" }}>
                        Holistic Dashavidha Pariksha assessment
                      </div>
                    </div>
                  </button>
                </div>
              </div>

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
                        setChiefComplaint(chiefComplaint === item.id ? "" : item.id);
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
                  <span>
                    {chiefComplaint
                      ? `Additional details for ${chiefComplaint} (Optional):`
                      : t("assessment.customComplaintPrompt", "Or describe your symptoms in your own words:")}
                  </span>
                  <small>{t("common.optional", "Optional")}</small>
                </label>
                <div className={styles.customInputBox}>
                  <FileText size={16} className={styles.customIcon} />
                  <input
                    type="text"
                    className={styles.customInput}
                    placeholder={
                      chiefComplaint
                        ? `e.g., Since 2-3 days, mild fever, worse at night...`
                        : t("assessment.customComplaintPlaceholder", "e.g., Throbbing temple headache since this morning, mild nausea...")
                    }
                    value={customComplaint}
                    onChange={(e) => {
                      setCustomComplaint(e.target.value);
                    }}
                  />
                  {customComplaint && (
                    <button type="button" onClick={() => setCustomComplaint("")} className={styles.clearBtn} aria-label="Clear input">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Doctor Selection — Full Directory */}
              {doctors.length > 0 && (
                <div className={styles.apptLinkRow}>
                  <label><User size={14} /> {t("assessment.selectDoctor", "Select Doctor")}:</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => {
                      const docId = e.target.value;
                      setSelectedDoctorId(docId);
                      // Clear linked appointment if new doctor doesn't match
                      if (selectedAppointmentId) {
                        const linkedAppt = appointments.find((a) => String(a.id) === String(selectedAppointmentId));
                        const linkedDocId = linkedAppt?.doctor?.id || linkedAppt?.doctorId;
                        if (String(linkedDocId) !== String(docId)) {
                          setSelectedAppointmentId("");
                        }
                      }
                    }}
                  >
                    <option value="">{t("assessment.anyDoctor", "-- Any Available Doctor --")}</option>
                    {doctors.map((doc) => {
                      const docName = doc.name || `Dr. ${doc.firstName || ""} ${doc.lastName || ""}`.trim();
                      const spec = doc.specialization || "General Medicine";
                      return (
                        <option key={doc.id} value={doc.id}>
                          {docName} — {spec}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Appointment Link — filtered to selected doctor if any */}
              {appointments.length > 0 && (
                <div className={styles.apptLinkRow}>
                  <label><Calendar size={14} /> {t("assessment.selectApptOptional", "Link with Upcoming Appointment")}:</label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => {
                      const apptId = e.target.value;
                      setSelectedAppointmentId(apptId);
                      // Auto-select the doctor from this appointment
                      if (apptId) {
                        const appt = appointments.find((a) => String(a.id) === String(apptId));
                        const docId = appt?.doctor?.id || appt?.doctorId;
                        if (docId) setSelectedDoctorId(String(docId));
                      }
                    }}
                  >
                    <option value="">{t("assessment.noLinkedAppt", "-- None (General Intake / Unlinked) --")}</option>
                    {appointments
                      .filter((appt) => {
                        if (!selectedDoctorId) return true;
                        const docId = appt.doctor?.id || appt.doctorId;
                        return String(docId) === String(selectedDoctorId);
                      })
                      .map((appt) => {
                        const docName =
                          appt.doctor?.name ||
                          (appt.doctor?.firstName ? `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName || ""}`.trim() : "") ||
                          (appt.doctor_first_name ? `Dr. ${appt.doctor_first_name} ${appt.doctor_last_name || ""}`.trim() : "") ||
                          "Attending Doctor";

                        const spec = appt.doctor?.specialization || appt.specialization || "General Medicine";
                        const rawDate = appt.scheduledAt || appt.scheduled_at;
                        const dateObj = rawDate ? new Date(rawDate) : null;
                        const isValidDate = dateObj && !isNaN(dateObj.getTime());
                        const formattedDate = isValidDate
                          ? dateObj.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Scheduled";

                        const reasonText = appt.reason ? ` • ${appt.reason}` : "";

                        return (
                          <option key={appt.id} value={appt.id}>
                            {docName} ({spec}) — {formattedDate}{reasonText}
                          </option>
                        );
                      })}
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
                    {(isRecording || isProcessingVoice || isPlayingTts) && (
                      <VoiceOrb
                        className={styles.voiceOrb}
                        state={isRecording ? "listening" : isPlayingTts ? "speaking" : "thinking"}
                        mediaStream={isRecording ? recordingStream : null}
                        audioSource={isPlayingTts ? ttsAudio : null}
                      />
                    )}
                    {!isRecording ? (
                      <button
                        type="button"
                        className={styles.voiceBtn}
                        onClick={handleStartRecording}
                        disabled={loading || isProcessingVoice || isPlayingTts}
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
            <div className={styles.completionCard}>
              <div className={styles.completionIcon}>
                <CheckCircle2 size={32} />
              </div>
              <h2>{t("assessment.assessmentComplete", "Assessment Complete!")}</h2>
              <p className={styles.completionSub}>
                {t("assessment.assessmentSuccess", "Your structured clinical history has been successfully created and attached to your record.")}
              </p>

              {summary && (
                <div className={styles.summaryBox}>
                  <strong>{t("assessment.viewSummary", "Clinical Intake Summary for Doctor:")}</strong>
                  <p>{summary}</p>
                </div>
              )}

              <div className={styles.completionActions}>
                {!appointmentIdFromUrl ? (
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className={styles.startBtn}
                    style={{ width: "auto", padding: "0 24px" }}
                  >
                    {targetDoctor ? `Book with Dr. ${targetDoctor.firstName} ${targetDoctor.lastName}` : "Book an Appointment"}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/patient/appointments")}
                    className={styles.startBtn}
                    style={{ width: "auto", padding: "0 24px" }}
                  >
                    {t("navigation.appointments", "View Appointments")}
                  </button>
                )}
                <button
                  onClick={() => navigate("/patient/dashboard")}
                  className={styles.startBtn}
                  style={{ width: "auto", padding: "0 24px" }}
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
                  <strong>{t("assessment.step3Title", "Doctor Ready Briefing")}</strong>
                  <p>{t("assessment.step3Desc", "A structured note is attached to your clinical record.")}</p>
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
          <form className={styles.bookingModal} onSubmit={handleCreateBooking}>
            <h2>Book an Appointment</h2>
            <p>{targetDoctor ? `Booking with Dr. ${targetDoctor.firstName} ${targetDoctor.lastName}` : "Choose a convenient time for your consultation."}</p>
            <label>
              Select doctor
              <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} required>
                <option value="">Choose a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name || `Dr. ${doctor.firstName || ""} ${doctor.lastName || ""}`.trim()} {doctor.specialization ? `- ${doctor.specialization}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date and time
              <input type="datetime-local" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} required />
            </label>
            <label>
              Consultation type
              <select value={bookingType} onChange={(event) => setBookingType(event.target.value)}>
                <option value="in_person">In-person consultation</option>
                <option value="video">Teleconsultation</option>
              </select>
            </label>
            <div className={styles.bookingActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowBookingModal(false)}>Cancel</button>
              <button type="submit" className={styles.startBtn} disabled={bookingSubmitting}>{bookingSubmitting ? "Booking..." : "Confirm Booking"}</button>
            </div>
          </form>
        </div>
      )}
    </motion.main>
  );
}
