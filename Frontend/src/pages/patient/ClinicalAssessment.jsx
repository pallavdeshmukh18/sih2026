import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  startClinicalSession,
  sendClinicalTextTurn,
  finalizeClinicalSession,
  getPatientAppointments,
} from "../../services/api";
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Sparkles, Stethoscope } from "lucide-react";
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

  useEffect(() => {
    async function loadAppointments() {
      if (!token) return;
      try {
        const res = await getPatientAppointments(token);
        if (res.success && Array.isArray(res.appointments) && res.appointments.length > 0) {
          setAppointments(res.appointments);
          if (!selectedAppointmentId) {
            setSelectedAppointmentId(res.appointments[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load patient appointments for assessment:", err.message);
      }
    }
    loadAppointments();
  }, [token]);

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
      const payload = {
        chiefComplaint: activeComplaint,
        appointmentId: selectedAppointmentId || undefined,
        language: currentLanguage || "en",
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

  const handleSendResponse = async (answerText) => {
    const textToSend = answerText || customAnswerText;
    if (!textToSend.trim() || !sessionId || loading) return;

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
        if (res.isCompleted) {
          setIsCompleted(true);
          setSummary(res.summary || "");
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
        setSummary(res.summary || "");
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

          <label className={styles.label}>Or describe in your own words:</label>
          <input
            type="text"
            className={styles.inputField}
            placeholder={t("assessment.customComplaintPlaceholder")}
            value={customComplaint}
            onChange={(e) => {
              setCustomComplaint(e.target.value);
              setChiefComplaint("");
            }}
          />

          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? t("assessment.starting") : t("assessment.beginAssessment")} <Sparkles size={16} />
          </button>
        </form>
      )}

      {sessionId && !isCompleted && (
        <div className={styles.chatWindow}>
          <div className={styles.questionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0d9488", fontSize: "12px", fontWeight: "700", marginBottom: "8px" }}>
              <Stethoscope size={16} /> CLINICAL AI QUESTION
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
                    disabled={loading}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Custom typed response option */}
            <div className={styles.customAnswerSection}>
              <span className={styles.customAnswerLabel}>Or type a specific response:</span>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  className={styles.inputField}
                  style={{ marginBottom: 0 }}
                  placeholder="Type your answer here..."
                  value={customAnswerText}
                  onChange={(e) => setCustomAnswerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendResponse();
                    }
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.primaryBtn}
                  style={{ width: "auto", padding: "0 20px" }}
                  onClick={() => handleSendResponse()}
                  disabled={loading || !customAnswerText.trim()}
                >
                  <Send size={16} />
                </button>
              </div>
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
              {isFinalizing ? "Finalizing..." : "Complete Assessment Now"}
            </button>
          </div>

          {conversationHistory.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.historyTitle}>Intake Transcript</div>
              {conversationHistory.map((msg, idx) => (
                <div key={idx} className={styles.chatTurn}>
                  {msg.role === "system" ? (
                    <span className={styles.systemMsg}>Doctor AI: {msg.content}</span>
                  ) : (
                    <div className={styles.patientMsg}>You: {msg.content}</div>
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
          <h2>Assessment Complete!</h2>
          <p style={{ color: "#475569", fontSize: "14px" }}>
            Your structured clinical history has been successfully created and attached to your record.
          </p>

          {summary && (
            <div className={styles.summaryBox}>
              <strong>Clinical Intake Summary for Doctor:</strong>
              <p style={{ marginTop: "8px" }}>{summary}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button
              onClick={() => navigate("/patient/dashboard")}
              className={styles.primaryBtn}
              style={{ width: "auto", padding: "12px 24px" }}
            >
              Return to Dashboard
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
              View History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
