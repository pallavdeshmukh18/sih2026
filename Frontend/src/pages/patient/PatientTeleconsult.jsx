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
import { Link } from "react-router-dom";
import teleconsultHero from "../../assets/teleconsult-hero.png";
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
  const { token } = useAuth();

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
  const loadSessions = useCallback(async (background = false) => {
    if (!token) return;
    if (!background) setLoading(true);
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
    if (activeCallSession) return;
    const pollInterval = setInterval(() => loadSessions(true), 5000);
    return () => clearInterval(pollInterval);
  }, [loadSessions, activeCallSession]);

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

  const pastSessions = useMemo(() => sessions.filter((s) => !["approved", "in_call", "pending_approval"].includes(s.status)), [sessions]);

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
      <header className={styles.hero}>
        <img src={teleconsultHero} alt="" />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>VIRTUAL HEALTHCARE</div>
          <h1>Teleconsultations & Live Calls</h1>
          <p>Connect with your doctors, share your concerns, and get care from the comfort of home.</p>
        </div>
        <blockquote>“Closer to care.<br />Wherever you are.”</blockquote>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.requestCard}>
            <div className={styles.requestCardLeft}>
              <span className={styles.requestCardIcon}><Video size={20} color="#087b6d" /></span>
              <div>
                <h2>Your next consultation starts here</h2>
                <p>Choose a doctor and request a video or voice call.</p>
              </div>
            </div>
            <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
              <Plus size={14} /> Request Teleconsultation
            </button>
          </section>

      {/* Stats Overview */}
      <section className={styles.stats}>
        <article className={styles.green}>
          <span><Video /></span>
          <div>
            <strong>{String(approvedCalls.length).padStart(2, "0")}</strong>
            <p>Approved & Ready</p>
          </div>
        </article>
        <article className={styles.gold}>
          <span><Clock /></span>
          <div>
            <strong>{String(pendingRequests.length).padStart(2, "0")}</strong>
            <p>Pending Approvals</p>
          </div>
        </article>
        <article className={styles.blue}>
          <span><CheckCircle2 /></span>
          <div>
            <strong>{String(completedCalls.length).padStart(2, "0")}</strong>
            <p>Completed Calls</p>
          </div>
        </article>
        <article className={styles.purple}>
          <span><Stethoscope /></span>
          <div>
            <strong>{String(sessions.length).padStart(2, "0")}</strong>
            <p>Total Requests</p>
          </div>
        </article>
      </section>

            {/* Approved / Active Ready to Join Section */}
      {approvedCalls.length > 0 && (
        <section className={styles.readyCard}>
          <div className={styles.readyHeader}>
            <div className={styles.readyPulse} />
            <div>
              <h2>Ready for your consultation</h2>
              <p>Your doctor has approved your request. Join whenever you’re ready.</p>
            </div>
          </div>
          <div className={styles.callsGrid}>
            {approvedCalls.map((session) => (
              <div key={session.id} className={styles.readyContent}>
                <div className={styles.readyDoctorInfo}>
                  <div className={styles.readyDoctorLeft}>
                    <div className={styles.readyAvatar}>
                      {session.doctor?.firstName ? session.doctor.firstName[0] : "DR"}
                    </div>
                    <div>
                      <h3>{session.doctor?.name || "Medical Specialist"}</h3>
                      <p>{session.doctor?.specialization || "Clinical Care"}</p>
                    </div>
                  </div>
                  <span className={`${styles.status} ${styles.approved}`}>
                    {session.callType === "video" ? "Video Call" : "Voice Call"}
                  </span>
                </div>
                <p className={styles.readyReason}><strong>Reason:</strong> {session.reason}</p>
                <div className={styles.readyActions}>
                  <button className={styles.joinCallBtn} onClick={() => handleJoinCall(session)} disabled={isJoining}>
                    {session.callType === "video" ? <Video size={14} /> : <Phone size={14} />}
                    {isJoining ? "Connecting..." : `Join ${session.callType === "video" ? "Video" : "Voice"} Call`}
                  </button>
                  <button className={styles.chatBtn} onClick={() => handleOpenChat(session)} title="Open Chat">
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
        <section className={styles.history}>
          <header>
            <div>
              <h2>Pending Requests</h2>
              <p>Waiting for the doctor to review and accept your call request.</p>
            </div>
          </header>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <div className={styles.doctor}>
                        <span>{session.doctor?.firstName ? session.doctor.firstName[0] : "D"}</span>
                        <div>
                          <b>{session.doctor?.name || "Doctor"}</b>
                          <small>{session.doctor?.specialization || "Specialist"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.withIcon}>
                        <Clock />
                        <span>
                          {new Date(session.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          <small>{new Date(session.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.withIcon}>
                        {session.callType === "video" ? <Video /> : <Phone />}
                        <span>{session.callType === "video" ? "Video Call" : "Voice Call"}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.withIcon}>
                        <span>{session.reason}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles.pending_approval}`}>Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

            {/* Past Teleconsultation History */}
      <section className={styles.history}>
        <header>
          <div>
            <h2>Teleconsultation History</h2>
            <p>Past completed sessions, doctor advice, and chat transcripts.</p>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "11px" }}>Loading teleconsultations...</div>
        ) : error ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#dc2626", fontSize: "11px" }}>{error}</div>
        ) : pastSessions.length === 0 ? (
          <div className={styles.empty}>
            No past consultations yet. Your completed consultations will appear here.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pastSessions.map((session) => {
                  const isCompleted = session.status === "completed";
                  const isRejected = session.status === "rejected";
                  return (
                    <tr key={session.id}>
                      <td>
                        <div className={styles.doctor}>
                          <span>{session.doctor?.firstName ? session.doctor.firstName[0] : "D"}</span>
                          <div>
                            <b>{session.doctor?.name || "Doctor"}</b>
                            <small>{session.doctor?.specialization || "Specialist"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.withIcon}>
                          <Calendar />
                          <span>
                            {new Date(session.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            <small>{session.durationSeconds ? `Duration: ${Math.ceil(session.durationSeconds / 60)}m` : "—"}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.withIcon}>
                          {session.callType === "video" ? <Video /> : <Phone />}
                          <span>{session.callType === "video" ? "Video Call" : "Voice Call"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[session.status] || styles.completed}`}>
                          {session.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <button className={styles.more} onClick={() => handleOpenChat(session)}>
                          <MessageSquare />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.quick}>
            <h2>Quick Actions</h2>
            <div>
              <button onClick={() => setIsModalOpen(true)}><span><Video /></span>Consultation</button>
              <button onClick={() => window.location.href='/patient/doctor'}><span><Stethoscope /></span>Find Doctor</button>
              <button onClick={() => window.location.href='/patient/documents'}><span><FileText /></span>Documents</button>
              <button onClick={() => window.location.href='/patient/appointments'}><span><Calendar /></span>Appointments</button>
            </div>
          </section>
        </aside>
      </div>

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
