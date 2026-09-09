import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  startClinicalSession,
  sendClinicalTextTurn,
  sendClinicalVoiceTurn,
  finalizeClinicalSession,
  getPatientAppointments,
  getPatientMedicalHistory,
  fetchPublicDoctors,
  createAppointment,
  deleteClinicalSession,
} from "../../services/api";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Sparkles, Stethoscope, Mic, Square, Loader2, Calendar, User, Clock, Check, Trash2 } from "lucide-react";
import { useLanguage } from "../../i18n";
import ClinicalSummaryCard from "../../components/common/ClinicalSummaryCard";
import styles from "./ClinicalAssessment.module.css";

const COMMON_CHIEF_COMPLAINTS = [
  "Fever & Chills",
  "Severe Headache",
  "Cough & Cold",
  "Chest Pain",
  "Abdominal Pain",
  "Joint / Muscle Pain",
  "Shortness of Breath",
  "Skin Rash",
];

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

  // Voice Input States
  const [sessionLanguage, setSessionLanguage] = useState(currentLanguage || "en");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [micError, setMicError] = useState(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

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

  const [pastAssessments, setPastAssessments] = useState([]);
  const [assessmentMode, setAssessmentMode] = useState("new"); // "new" | "existing"
  const [selectedPastAssessment, setSelectedPastAssessment] = useState(null);

  // Target Doctor & Direct Booking state
  const doctorIdFromUrl = searchParams.get("doctorId");
  const complaintFromUrl = searchParams.get("complaint");
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

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      try {
        const [apptRes, histRes, docsRes] = await Promise.allSettled([
          getPatientAppointments(token),
          getPatientMedicalHistory(token),
          doctorIdFromUrl ? fetchPublicDoctors(token) : Promise.resolve(null)
        ]);

        if (apptRes.status === "fulfilled" && apptRes.value?.success && Array.isArray(apptRes.value?.appointments)) {
          setAppointments(apptRes.value.appointments);
          if (!selectedAppointmentId && apptRes.value.appointments.length > 0) {
            setSelectedAppointmentId(appointmentIdFromUrl || apptRes.value.appointments[0].id);
          }
        }

        const rawAssessments = histRes.value?.history?.assessments || histRes.value?.assessments || [];
        if (histRes.status === "fulfilled" && histRes.value?.success && Array.isArray(rawAssessments)) {
          const valid = rawAssessments.filter((a) => a.summary || a.chiefComplaint);
          setPastAssessments(valid);
          if (valid.length > 0) {
            setSelectedPastAssessment(valid[0]);
          }
        }

        if (docsRes.status === "fulfilled" && docsRes.value?.success && Array.isArray(docsRes.value?.doctors)) {
          const doc = docsRes.value.doctors.find((d) => String(d.id) === String(doctorIdFromUrl));
          if (doc) setTargetDoctor(doc);
        }
      } catch (err) {
        console.warn("Could not load initial data for assessment:", err.message);
      }
    }
    loadData();
  }, [token, appointmentIdFromUrl, doctorIdFromUrl]);

  const handleSelectPastAssessment = (assessment) => {
    setSelectedPastAssessment(assessment);
  };

  const handleDeletePastAssessment = async (e, assessmentId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this past clinical assessment?")) return;
    try {
      await deleteClinicalSession(assessmentId, token);
      const updated = pastAssessments.filter((a) => a.id !== assessmentId);
      setPastAssessments(updated);
      if (selectedPastAssessment?.id === assessmentId) {
        const next = updated[0] || null;
        setSelectedPastAssessment(next);
        if (!next) setAssessmentMode("new");
      }
    } catch (err) {
      setError("Failed to delete clinical assessment. Please try again.");
    }
  };

  const handleApplyPastAssessment = () => {
    if (!selectedPastAssessment) return;
    setSessionId(selectedPastAssessment.id);
    setChiefComplaint(selectedPastAssessment.chiefComplaint || "Clinical Consultation");
    setSummary(selectedPastAssessment.summary || `Intake Summary for ${selectedPastAssessment.chiefComplaint}`);
    setConversationHistory(selectedPastAssessment.conversationHistory || []);
    setIsCompleted(true);
  };

  const handleCreateDirectBooking = async (e) => {
    e.preventDefault();
    if (!targetDoctor || (!sessionId && !selectedPastAssessment?.id)) return;
    setBookingSubmitting(true);
    try {
      const activeSessionId = sessionId || selectedPastAssessment?.id;
      const activeReason = chiefComplaint || selectedPastAssessment?.chiefComplaint || "Clinical Consultation";
      await createAppointment(
        {
          doctorId: targetDoctor.id,
          scheduledAt: new Date(bookingDate).toISOString(),
          durationMinutes: 30,
          appointmentType: bookingType,
          reason: activeReason,
          notes: summary,
          sessionId: activeSessionId
        },
        token
      );
      setShowBookingModal(false);
      navigate("/patient/dashboard?bookingSuccess=1");
    } catch (err) {
      setError(err.message || "Failed to book appointment. Please try again.");
    } finally {
      setBookingSubmitting(false);
    }
  };



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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button
          onClick={() => navigate("/patient/dashboard")}
          className={styles.backBtn}
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={18} /> {t("common.back")}
        </button>
        <div style={{ flex: 1 }}>
          <h1 className={styles.title}>{t("assessment.title")}</h1>
          <p className={styles.subtitle}>
            {t("assessment.subtitle")}
          </p>
        </div>
      </header>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!sessionId && (
        <div className={styles.startCard}>
          {pastAssessments.length > 0 && (
            <div className={styles.modeTabs}>
              <button
                type="button"
                className={`${styles.modeTab} ${assessmentMode === "new" ? styles.modeTabActive : ""}`}
                onClick={() => setAssessmentMode("new")}
              >
                <Sparkles size={15} /> {t("assessment.startNewTest", "Start New Assessment")}
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${assessmentMode === "existing" ? styles.modeTabActive : ""}`}
                onClick={() => setAssessmentMode("existing")}
              >
                <Stethoscope size={15} /> {t("assessment.loadPreviousTest", "Load Earlier Assessment")} ({pastAssessments.length})
              </button>
            </div>
          )}

          {assessmentMode === "existing" && pastAssessments.length > 0 ? (
            <div className={styles.existingAssessmentSection}>
              <label className={styles.label}>
                {t("assessment.selectPastPrompt", "Select a previous clinical assessment to load its summary for your doctor:")}
              </label>

              <div className={styles.pastAssessmentsList}>
                {pastAssessments.map((item) => {
                  const isSelected = selectedPastAssessment?.id === item.id;
                  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Recent";
                  return (
                    <div
                      key={item.id}
                      className={`${styles.pastAssessmentCard} ${isSelected ? styles.pastAssessmentCardSelected : ""}`}
                      onClick={() => handleSelectPastAssessment(item)}
                    >
                      <div className={styles.pastHeader}>
                        <span className={styles.pastTitle}>{item.chiefComplaint || "Clinical Intake Session"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={styles.pastDate}>{dateStr}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeletePastAssessment(e, item.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "4px",
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                            title="Delete this assessment"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <p className={styles.pastSnippet}>
                        Intake Assessment Session ({item.conversationHistory ? `${item.conversationHistory.length} responses` : "Completed"})
                      </p>
                    </div>
                  );
                })}
              </div>

              {selectedPastAssessment && (
                <ClinicalSummaryCard
                  summary={selectedPastAssessment.summary || ""}
                  chiefComplaint={selectedPastAssessment.chiefComplaint}
                  answeredFields={selectedPastAssessment.answeredFields}
                  redFlags={selectedPastAssessment.redFlags}
                  patientName={user?.name || user?.firstName || "Patient"}
                  style={{ marginTop: "12px" }}
                />
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleApplyPastAssessment}
                  disabled={!selectedPastAssessment}
                  style={{ flex: 1, minWidth: "200px" }}
                >
                  <CheckCircle2 size={16} /> {t("assessment.useThisSummary", "Use This Assessment Summary")}
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentMode("new")}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {t("assessment.startNewInstead", "Start New Assessment Instead")}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleStartSession}>
              {appointments.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <label className={styles.label}>{t("assessment.selectApptOptional")}:</label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => setSelectedAppointmentId(e.target.value)}
                    className={styles.inputField}
                  >
                    {appointments.map((appt) => (
                      <option key={appt.id} value={appt.id}>
                        Dr. {appt.doctor_first_name} {appt.doctor_last_name} ({appt.specialization || "General"}) - {new Date(appt.scheduled_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className={styles.label}>{t("assessment.chiefComplaintPrompt")}</label>
              <div className={styles.complaintChips}>
                {COMMON_CHIEF_COMPLAINTS.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`${styles.chip} ${chiefComplaint === item ? styles.chipActive : ""}`}
                    onClick={() => {
                      setChiefComplaint(item);
                      setCustomComplaint("");
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <label className={styles.label}>{t("assessment.customComplaintPrompt", "Or describe in your own words:")}</label>
              <input
                type="text"
                className={styles.inputField}
                placeholder={t("assessment.customComplaintPlaceholder", "e.g. Sharp pain in lower back since yesterday")}
                value={customComplaint}
                onChange={(e) => {
                  setCustomComplaint(e.target.value);
                  setChiefComplaint("");
                }}
              />

              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? t("assessment.starting", "Starting Assessment...") : t("assessment.beginAssessment", "Begin Assessment")} <Sparkles size={16} />
              </button>
            </form>
          )}
        </div>
      )}

      {sessionId && !isCompleted && (
        <div className={styles.chatWindow}>
          <div className={styles.questionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0d9488", fontSize: "12px", fontWeight: "700", marginBottom: "8px" }}>
              <Stethoscope size={16} /> {t("assessment.intakeAssistant", "CLINICAL AI QUESTION")}
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
                    {label}
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
                  className={styles.inputField}
                  style={{ marginBottom: 0 }}
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
                  className={styles.primaryBtn}
                  style={{ width: "auto", padding: "0 20px" }}
                  onClick={() => handleSendResponse()}
                  disabled={loading || isRecording || isProcessingVoice || !customAnswerText.trim()}
                >
                  <Send size={16} />
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
                    <Mic size={16} />
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
                      <Square size={12} fill="currentColor" /> {t("assessment.stopRecording") || "Stop"}
                    </button>
                  </div>
                )}

                {isProcessingVoice && (
                  <span style={{ fontSize: "13px", color: "#0d9488", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> {t("assessment.processingVoice") || "Transcribing speech..."}
                  </span>
                )}
              </div>

              {micError && (
                <div style={{ color: "#b91c1c", fontSize: "12px", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertCircle size={14} /> {micError}
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

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => handleFinalize()}
              disabled={isFinalizing}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {isFinalizing ? t("account.saving", "Finalizing...") : t("assessment.completeAssessmentNow", "Complete Assessment Now")}
            </button>
          </div>

          {conversationHistory.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.historyTitle}>{t("assessment.intakeTranscript", "Intake Transcript")}</div>
              {conversationHistory.map((msg, idx) => (
                <div key={idx} className={styles.chatTurn}>
                  {msg.role === "system" ? (
                    <span className={styles.systemMsg}>{t("assessment.doctorAi", "Doctor AI:")} {msg.content}</span>
                  ) : (
                    <div className={styles.patientMsg}>{t("assessment.you", "You:")} {msg.content}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isCompleted && (
        <div className={styles.completionCard}>
          <CheckCircle2 size={48} color="#166534" style={{ margin: "0 auto 16px" }} />
          <h2>{t("assessment.assessmentComplete", "Assessment Complete!")}</h2>
          <p style={{ color: "#475569", fontSize: "14px" }}>
            {t("assessment.assessmentSuccess", "Your structured clinical history has been successfully created and attached to your record.")}
          </p>

          {summary && (
            <ClinicalSummaryCard
              summary={summary}
              chiefComplaint={chiefComplaint}
              answeredFields={selectedPastAssessment?.answeredFields}
              redFlags={selectedPastAssessment?.redFlags}
              patientName={user?.name || user?.firstName || "Patient"}
              style={{ marginTop: "20px", textAlign: "left" }}
            />
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap" }}>
            {targetDoctor ? (
              <button
                onClick={() => setShowBookingModal(true)}
                className={styles.primaryBtn}
                style={{ width: "auto", padding: "12px 24px", background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", color: "#fff", border: "none" }}
              >
                📅 Confirm Appointment with Dr. {targetDoctor.firstName} {targetDoctor.lastName}
              </button>
            ) : (
              <button
                onClick={() => navigate("/patient/doctor")}
                className={styles.primaryBtn}
                style={{ width: "auto", padding: "12px 24px", background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", color: "#fff", border: "none" }}
              >
                📅 Select Doctor & Book Appointment
              </button>
            )}
            <button
              onClick={() => navigate("/patient/dashboard")}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#334155",
                padding: "12px 24px",
                borderRadius: "12px",
                fontSize: "14px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              {t("assessment.returnDashboard", "Return to Dashboard")}
            </button>
            <button
              onClick={() => navigate("/patient/history")}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#334155",
                padding: "12px 24px",
                borderRadius: "12px",
                fontSize: "14px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              {t("navigation.history", "View History")}
            </button>
          </div>
        </div>
      )}

      {/* Doctor Booking Modal */}
      {showBookingModal && targetDoctor && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "28px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #e2e8f0"
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
              Confirm Appointment
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
              Booking with <strong>Dr. {targetDoctor.firstName} {targetDoctor.lastName}</strong> ({targetDoctor.specialization || "General Medicine"})
            </p>

            <form onSubmit={handleCreateDirectBooking}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Select Date & Time:
                </label>
                <input
                  type="datetime-local"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className={styles.inputField}
                  required
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Consultation Type:
                </label>
                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value)}
                  className={styles.inputField}
                >
                  <option value="in_person">In-Person Consultation</option>
                  <option value="video">Teleconsultation (Video Call)</option>
                </select>
              </div>

              <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "10px", padding: "12px", marginBottom: "20px", fontSize: "12px", color: "#0f766e" }}>
                <strong>Attached Clinical Summary:</strong>
                <p style={{ margin: "4px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {summary
                    ? summary
                        .replace(/###/g, "")
                        .replace(/\*\*/g, "")
                        .replace(/\*/g, "")
                        .replace(/🩺|📋|🚨/g, "")
                        .trim()
                    : "Intake assessment ready for physician review."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                  disabled={bookingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  style={{ width: "auto", padding: "10px 24px" }}
                  disabled={bookingSubmitting}
                >
                  {bookingSubmitting ? "Booking..." : "Confirm & Complete Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
