import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  startClinicalSession,
  sendClinicalTextTurn,
  sendClinicalVoiceTurn,
  finalizeClinicalSession,
  getPatientAppointments,
} from "../../services/api";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Sparkles, Stethoscope, Mic, Square, Loader2 } from "lucide-react";
import { useLanguage } from "../../i18n";
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
        <form onSubmit={handleStartSession} className={styles.startCard}>
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
            <div className={styles.summaryBox}>
              <strong>{t("assessment.viewSummary", "Clinical Intake Summary for Doctor:")}</strong>
              <p style={{ marginTop: "8px" }}>{summary}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button
              onClick={() => navigate("/patient/dashboard")}
              className={styles.primaryBtn}
              style={{ width: "auto", padding: "12px 24px" }}
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
    </div>
  );
}
