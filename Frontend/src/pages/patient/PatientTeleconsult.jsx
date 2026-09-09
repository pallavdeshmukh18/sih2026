import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, 
  Phone, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Stethoscope, 
  User, 
  MessageSquare, 
  X, 
  ShieldCheck, 
  Radio, 
  ArrowRight,
  Pill,
  FileText
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { 
  fetchTeleconsultSessions, 
  requestTeleconsult, 
  joinTeleconsultSession, 
  fetchPublicDoctors, 
  fetchTeleconsultMessages, 
  sendTeleconsultMessage 
} from "../../services/api";
import TeleconsultRoom from "../../components/teleconsult/TeleconsultRoom";
import styles from "./PatientTeleconsult.module.css";

export default function PatientTeleconsult() {
  const { token, user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [callType, setCallType] = useState("video"); // 'video' | 'voice'
  const [reason, setReason] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Agora Live Call State
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  // Async Chat Drawer State (for review/chat outside of call)
  const [activeChatSession, setActiveChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Load patient teleconsultation sessions
  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchTeleconsultSessions(token);
      if (res && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.error("Failed to load teleconsult sessions:", err);
      setError("Unable to load teleconsultation history. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
    const pollInterval = setInterval(loadSessions, 5000); // Polling for live doctor approval
    return () => clearInterval(pollInterval);
  }, [loadSessions]);

  // Load verified doctors for request modal
  useEffect(() => {
    if (isModalOpen && doctors.length === 0) {
      const loadDoctors = async () => {
        try {
          const res = await fetchPublicDoctors(token);
          if (res && res.doctors) {
            setDoctors(res.doctors);
            if (res.doctors.length > 0) {
              setSelectedDoctorId(res.doctors[0].id);
            }
          }
        } catch (err) {
          console.error("Error loading doctors:", err);
        }
      };
      loadDoctors();
    }
  }, [isModalOpen, doctors.length, token]);

  // Submit Call Request
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !reason.trim()) {
      toast.error("Please select a doctor and state your reason for consultation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestTeleconsult(
        {
          doctorId: selectedDoctorId,
          callType,
          reason: reason.trim(),
          patientNotes: patientNotes.trim() || null,
        },
        token
      );

      if (res && res.success) {
        toast.success("Call request submitted! Awaiting doctor approval.");
        setIsModalOpen(false);
        setReason("");
        setPatientNotes("");
        loadSessions();
      }
    } catch (err) {
      console.error("Failed to submit request:", err);
      toast.error(err.message || "Failed to submit teleconsultation request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join Call Handler
  const handleJoinCall = async (session) => {
    setIsJoining(true);
    try {
      const res = await joinTeleconsultSession(session.id, token);
      if (res && res.success) {
        setActiveCallSession({
          sessionId: session.id,
          agoraConfig: res.agora,
          callType: session.callType,
          peer: session.doctor,
        });
      }
    } catch (err) {
      console.error("Join call error:", err);
      toast.error(err.message || "Failed to join live call room.");
    } finally {
      setIsJoining(false);
    }
  };

  // Open Chat Drawer
  const handleOpenChat = async (session) => {
    setActiveChatSession(session);
    try {
      const res = await fetchTeleconsultMessages(session.id, token);
      if (res && res.success) {
        setChatMessages(res.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  // Send Message in Drawer
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !activeChatSession || isSendingChat) return;

    const text = chatInput.trim();
    setChatInput("");
    setIsSendingChat(true);
    try {
      const res = await sendTeleconsultMessage(activeChatSession.id, text, "text", token);
      if (res && res.success && res.message) {
        setChatMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message.");
    } finally {
      setIsSendingChat(false);
    }
  };

  // Stats calculation
  const approvedCalls = useMemo(() => sessions.filter((s) => s.status === "approved" || s.status === "in_call"), [sessions]);
  const pendingRequests = useMemo(() => sessions.filter((s) => s.status === "pending_approval"), [sessions]);
  const completedCalls = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);

  // Render Active Agora Call Room
  if (activeCallSession) {
    return (
      <TeleconsultRoom
        sessionId={activeCallSession.sessionId}
        agoraConfig={activeCallSession.agoraConfig}
        callType={activeCallSession.callType}
        peer={activeCallSession.peer}
        isDoctor={false}
        token={token}
        onCallEnded={() => {
          setActiveCallSession(null);
          loadSessions();
          toast.success("Consultation finished successfully.");
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>VIRTUAL HEALTHCARE</div>
          <h1>Teleconsultations & Live Calls</h1>
          <p>Connect with your verified doctors for real-time video or audio consultations and secure direct messaging.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Request Teleconsultation
        </button>
      </header>

      {/* Stats Overview */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconTeal}`}><Video size={20} /></div>
          <div>
            <strong>{String(approvedCalls.length).padStart(2, "0")}</strong>
            <span>Approved & Ready</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconAmber}`}><Clock size={20} /></div>
          <div>
            <strong>{String(pendingRequests.length).padStart(2, "0")}</strong>
            <span>Pending Approvals</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconSky}`}><CheckCircle2 size={20} /></div>
          <div>
            <strong>{String(completedCalls.length).padStart(2, "0")}</strong>
            <span>Completed Calls</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconPurple}`}><Stethoscope size={20} /></div>
          <div>
            <strong>{String(sessions.length).padStart(2, "0")}</strong>
            <span>Total Requests</span>
          </div>
        </div>
      </section>

      {/* Approved / Active Ready to Join Section */}
      {approvedCalls.length > 0 && (
        <section className={styles.card} style={{ border: "2px solid #10b981" }}>
          <div className={styles.cardHeader} style={{ background: "#f0fdf4" }}>
            <div>
              <h2 style={{ color: "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={18} color="#10b981" className={styles.pulsingIcon} /> Approved Calls Ready to Join
              </h2>
              <p style={{ color: "#15803d" }}>Doctor has approved your request. Click Join to start the live encrypted room.</p>
            </div>
          </div>

          <div className={styles.callsGrid}>
            {approvedCalls.map((session) => (
              <div key={session.id} className={`${styles.callItem} ${styles.callItemApproved}`}>
                <div className={styles.itemHeader}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div className={styles.doctorAvatar}>
                      {session.doctor?.firstName ? session.doctor.firstName[0] : "DR"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                        {session.doctor?.name || "Medical Specialist"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {session.doctor?.specialization || "Clinical Care"}
                      </span>
                    </div>
                  </div>
                  <span className={`${styles.badge} ${styles.badgeApproved}`}>
                    {session.callType === "video" ? <Video size={12} /> : <Phone size={12} />}
                    {session.callType === "video" ? "Video Call" : "Voice Call"}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <strong>Reason:</strong> {session.reason}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className={styles.joinCallBtn}
                    onClick={() => handleJoinCall(session)}
                    disabled={isJoining}
                  >
                    {session.callType === "video" ? <Video size={16} /> : <Phone size={16} />}
                    {isJoining ? "Connecting..." : `Join ${session.callType === "video" ? "Video" : "Voice"} Call Now`}
                  </button>
                  <button
                    className={styles.chatBtn}
                    style={{ width: "48px" }}
                    onClick={() => handleOpenChat(session)}
                    title="Open Chat"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Doctor Approvals */}
      {pendingRequests.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Pending Requests</h2>
              <p>Waiting for the doctor to review and accept your call request.</p>
            </div>
            <span className={`${styles.badge} ${styles.badgePending}`}>
              {pendingRequests.length} Pending
            </span>
          </div>

          <div className={styles.callsGrid}>
            {pendingRequests.map((session) => (
              <div key={session.id} className={styles.callItem}>
                <div className={styles.itemHeader}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div className={styles.doctorAvatar}>
                      {session.doctor?.firstName ? session.doctor.firstName[0] : "DR"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>
                        {session.doctor?.name || "Medical Specialist"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {session.doctor?.specialization || "General Medicine"}
                      </span>
                    </div>
                  </div>
                  <span className={`${styles.badge} ${styles.badgePending}`}>
                    Awaiting Approval
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#475569" }}>
                  <strong>Health Concern:</strong> {session.reason}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#94a3b8" }}>
                  <span>Requested: {new Date(session.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ textTransform: "capitalize" }}>{session.callType} Call</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past Teleconsultation History */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>Teleconsultation History</h2>
            <p>Past completed sessions, doctor advice, and chat transcripts.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            Loading teleconsultations...
          </div>
        ) : error ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#dc2626", fontSize: "13px" }}>
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "50px", textAlign: "center", color: "#64748b" }}>
            <Video size={36} color="#94a3b8" style={{ marginBottom: "12px" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a", margin: 0 }}>No Teleconsultations Yet</h3>
            <p style={{ fontSize: "13px", margin: "6px 0 16px 0" }}>Request a remote video or voice consultation with any of our verified doctors.</p>
            <button className={styles.primaryBtn} style={{ margin: "0 auto" }} onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Request First Call
            </button>
          </div>
        ) : (
          <div className={styles.callsGrid}>
            {sessions.map((session) => {
              const isCompleted = session.status === "completed";
              const isRejected = session.status === "rejected";

              return (
                <div key={session.id} className={styles.callItem}>
                  <div className={styles.itemHeader}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <div className={styles.doctorAvatar}>
                        {session.doctor?.firstName ? session.doctor.firstName[0] : "DR"}
                      </div>
                      <div>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                          {session.doctor?.name || "Doctor"}
                        </strong>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {session.doctor?.specialization || "Specialist"}
                        </div>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${
                      session.status === "approved" ? styles.badgeApproved :
                      session.status === "pending_approval" ? styles.badgePending :
                      session.status === "in_call" ? styles.badgeInCall :
                      isCompleted ? styles.badgeCompleted : styles.badgeRejected
                    }`}>
                      {session.status.replace("_", " ")}
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "#334155" }}>
                    <strong>Concern:</strong> {session.reason}
                  </div>

                  {session.prescription && (
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", color: "#065f46" }}>
                      <strong style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                        <Pill size={13} /> Prescription:
                      </strong>
                      <span style={{ whiteSpace: "pre-line" }}>{session.prescription}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#94a3b8" }}>
                    <span>{new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                    {session.durationSeconds > 0 && <span>Duration: {Math.ceil(session.durationSeconds / 60)}m</span>}
                  </div>

                  <button className={styles.chatBtn} onClick={() => handleOpenChat(session)}>
                    <MessageSquare size={14} /> View Chat & Notes
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Request Call Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", fontFamily: "var(--font-serif)" }}>
                    Request Teleconsultation Call
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Doctor will review your health concern and approve the call.
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRequestSubmit}>
                {/* Select Doctor */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Select Doctor</label>
                  <select
                    className={styles.select}
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    required
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialization} ({doc.department || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Call Format (Video vs Voice) */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Consultation Format</label>
                  <div className={styles.callTypeSelector}>
                    <div
                      className={`${styles.callTypeOption} ${callType === "video" ? styles.callTypeOptionSelected : ""}`}
                      onClick={() => setCallType("video")}
                    >
                      <Video size={22} />
                      <strong style={{ fontSize: "13px" }}>HD Video Call</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Camera + Audio</span>
                    </div>

                    <div
                      className={`${styles.callTypeOption} ${callType === "voice" ? styles.callTypeOptionSelected : ""}`}
                      onClick={() => setCallType("voice")}
                    >
                      <Phone size={22} />
                      <strong style={{ fontSize: "13px" }}>Voice Call</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Crystal Clear Audio</span>
                    </div>
                  </div>
                </div>

                {/* Primary Health Concern */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Reason for Call / Symptoms</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Follow-up on blood pressure and persistent cough"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>

                {/* Additional Patient Notes */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Additional Notes for Doctor (Optional)</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Any medications currently taking or specific questions..."
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{ padding: "10px 18px", borderRadius: "10px", background: "#f1f5f9", border: "1px solid #cbd5e1", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Send Call Request"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Consultation Chat & Notes Modal Drawer */}
      <AnimatePresence>
        {activeChatSession && (
          <div className={styles.modalBackdrop} onClick={() => setActiveChatSession(null)}>
            <motion.div
              className={styles.modalContent}
              style={{ maxWidth: "480px", height: "600px", display: "flex", flexDirection: "column" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                    Chat with {activeChatSession.doctor?.name}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                    Direct secure messages & medical advice
                  </p>
                </div>
                <button onClick={() => setActiveChatSession(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  <X size={20} />
                </button>
              </div>

              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" }}>
                {chatMessages.length === 0 ? (
                  <div style={{ margin: "auto", color: "#94a3b8", fontSize: "13px", textAlign: "center" }}>
                    No messages in this consultation thread.
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.isMe;
                    if (msg.senderRole === "system") {
                      return (
                        <div key={msg.id} style={{ alignSelf: "center", background: "#f1f5f9", color: "#64748b", fontSize: "11px", padding: "4px 10px", borderRadius: "12px" }}>
                          {msg.message}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                          background: isMe ? "#0d9488" : "#f1f5f9",
                          color: isMe ? "#ffffff" : "#0f172a",
                          padding: "10px 14px",
                          borderRadius: "14px",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "2px", fontWeight: "600" }}>
                          {isMe ? "You" : msg.senderName}
                        </div>
                        <div>{msg.message}</div>
                        <div style={{ fontSize: "9px", opacity: 0.7, textAlign: "right", marginTop: "4px" }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <input
                  type="text"
                  className={styles.input}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message to doctor..."
                />
                <button type="submit" className={styles.primaryBtn} disabled={!chatInput.trim() || isSendingChat}>
                  Send
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
