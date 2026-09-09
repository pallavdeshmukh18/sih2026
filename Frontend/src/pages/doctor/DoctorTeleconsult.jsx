import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, 
  Phone, 
  Check, 
  X, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope, 
  MessageSquare, 
  FileText, 
  Radio, 
  Pill,
  Send,
  Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { 
  fetchTeleconsultSessions, 
  respondToTeleconsult, 
  joinTeleconsultSession,
  fetchTeleconsultMessages, 
  sendTeleconsultMessage 
} from "../../services/api";
import TeleconsultRoom from "../../components/teleconsult/TeleconsultRoom";
import styles from "./DoctorTeleconsult.module.css";

export default function DoctorTeleconsult() {
  const { token, user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Action Loading states
  const [processingId, setProcessingId] = useState(null);

  // Active Agora Live Call State
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  // Chat Review Modal State
  const [activeChatSession, setActiveChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Fetch Doctor Teleconsult Sessions
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
      console.error("Failed to fetch doctor teleconsult sessions:", err);
      setError("Unable to load teleconsultation queue.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000); // Live poll for patient call requests
    return () => clearInterval(interval);
  }, [loadSessions]);

  // Respond to Patient Call Request (Approve or Reject)
  const handleRespond = async (sessionId, action) => {
    setProcessingId(sessionId);
    try {
      const res = await respondToTeleconsult(sessionId, action, "", token);
      if (res && res.success) {
        toast.success(`Call request ${action === "approve" ? "approved" : "declined"} successfully.`);
        loadSessions();
      }
    } catch (err) {
      console.error(`Error ${action}ing call request:`, err);
      toast.error(err.message || `Failed to ${action} call request.`);
    } finally {
      setProcessingId(null);
    }
  };

  // Start / Join Call Session
  const handleStartCall = async (session) => {
    setIsJoining(true);
    try {
      const res = await joinTeleconsultSession(session.id, token);
      if (res && res.success) {
        setActiveCallSession({
          sessionId: session.id,
          agoraConfig: res.agora,
          callType: session.callType,
          peer: session.patient,
        });
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      toast.error(err.message || "Failed to start consultation room.");
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
      console.error("Failed to load chat messages:", err);
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

  // Categories
  const pendingRequests = useMemo(() => sessions.filter((s) => s.status === "pending_approval"), [sessions]);
  const approvedCalls = useMemo(() => sessions.filter((s) => s.status === "approved" || s.status === "in_call"), [sessions]);
  const completedCalls = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);

  // Render Live Agora Room
  if (activeCallSession) {
    return (
      <TeleconsultRoom
        sessionId={activeCallSession.sessionId}
        agoraConfig={activeCallSession.agoraConfig}
        callType={activeCallSession.callType}
        peer={activeCallSession.peer}
        isDoctor={true}
        token={token}
        onCallEnded={() => {
          setActiveCallSession(null);
          loadSessions();
          toast.success("Consultation recorded and completed.");
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>CLINICAL TELECONSULTATIONS</div>
          <h1>Teleconsultation & Call Triage</h1>
          <p>Review patient video/voice call requests, approve consultations, and launch high-definition encrypted rooms.</p>
        </div>
      </header>

      {/* Metrics Row */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconAmber}`}><Clock size={20} /></div>
          <div>
            <strong>{String(pendingRequests.length).padStart(2, "0")}</strong>
            <span>Pending Triage</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconSky}`}><Video size={20} /></div>
          <div>
            <strong>{String(approvedCalls.length).padStart(2, "0")}</strong>
            <span>Approved & Active</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconTeal}`}><CheckCircle2 size={20} /></div>
          <div>
            <strong>{String(completedCalls.length).padStart(2, "0")}</strong>
            <span>Completed Calls</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconPurple}`}><User size={20} /></div>
          <div>
            <strong>{String(sessions.length).padStart(2, "0")}</strong>
            <span>Total Patients</span>
          </div>
        </div>
      </section>

      {/* 1. Pending Triage Queue (Requires Doctor Approval) */}
      <section className={styles.card} style={pendingRequests.length > 0 ? { border: "2px solid #f59e0b" } : {}}>
        <div className={styles.cardHeader} style={pendingRequests.length > 0 ? { background: "#fffbeb" } : {}}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", color: pendingRequests.length > 0 ? "#b45309" : "#0f172a" }}>
              <Clock size={18} /> Incoming Call Requests (Triage)
            </h2>
            <p>Patients requesting immediate or scheduled remote video/voice consultation.</p>
          </div>
          <span className={`${styles.badge} ${styles.badgePending}`}>
            {pendingRequests.length} Pending
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            No pending teleconsultation requests at the moment.
          </div>
        ) : (
          <div className={styles.queueGrid}>
            {pendingRequests.map((session) => (
              <div key={session.id} className={`${styles.queueCard} ${styles.queueCardPending}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div className={styles.patientAvatar}>
                      {session.patient?.firstName ? session.patient.firstName[0] : "P"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                        {session.patient?.name || "Patient"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {session.patient?.gender ? `${session.patient.gender} · ` : ""}
                        {session.patient?.phone || "No phone listed"}
                      </span>
                    </div>
                  </div>

                  <span className={`${styles.badge} ${styles.badgePending}`}>
                    {session.callType === "video" ? <Video size={12} /> : <Phone size={12} />}
                    {session.callType === "video" ? "Video Call" : "Voice Call"}
                  </span>
                </div>

                <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                  <div style={{ fontWeight: "600", color: "#0f172a", marginBottom: "2px" }}>Health Concern:</div>
                  <div style={{ color: "#334155" }}>{session.reason}</div>
                  {session.patientNotes && (
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
                      <strong>Patient Note:</strong> {session.patientNotes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => handleRespond(session.id, "reject")}
                    disabled={processingId === session.id}
                  >
                    <X size={15} /> Decline
                  </button>
                  <button
                    className={styles.approveBtn}
                    onClick={() => handleRespond(session.id, "approve")}
                    disabled={processingId === session.id}
                  >
                    <Check size={16} /> Approve Call
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Approved / Active Calls (Ready to Start) */}
      {approvedCalls.length > 0 && (
        <section className={styles.card} style={{ border: "2px solid #0284c7" }}>
          <div className={styles.cardHeader} style={{ background: "#f0f9ff" }}>
            <div>
              <h2 style={{ color: "#0369a1", display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={18} color="#0284c7" /> Approved Consultations (Ready to Start)
              </h2>
              <p style={{ color: "#0284c7" }}>Launch live Agora encrypted video or audio room with the patient.</p>
            </div>
          </div>

          <div className={styles.queueGrid}>
            {approvedCalls.map((session) => (
              <div key={session.id} className={`${styles.queueCard} ${styles.queueCardApproved}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div className={styles.patientAvatar}>
                      {session.patient?.firstName ? session.patient.firstName[0] : "P"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                        {session.patient?.name || "Patient"}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {session.patient?.phone || "Patient"}
                      </span>
                    </div>
                  </div>

                  <span className={`${styles.badge} ${styles.badgeApproved}`}>
                    {session.callType === "video" ? <Video size={12} /> : <Phone size={12} />}
                    {session.callType === "video" ? "Video Call" : "Voice Call"}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#334155" }}>
                  <strong>Reason:</strong> {session.reason}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className={styles.startCallBtn}
                    onClick={() => handleStartCall(session)}
                    disabled={isJoining}
                  >
                    {session.callType === "video" ? <Video size={16} /> : <Phone size={16} />}
                    {isJoining ? "Starting..." : `Start ${session.callType === "video" ? "Video" : "Voice"} Consultation`}
                  </button>

                  <button
                    style={{ padding: "0 14px", borderRadius: "10px", background: "#f1f5f9", border: "1px solid #cbd5e1", cursor: "pointer" }}
                    onClick={() => handleOpenChat(session)}
                    title="Open Chat"
                  >
                    <MessageSquare size={16} color="#0f172a" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Completed Teleconsultation History */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>Teleconsultation History</h2>
            <p>Review past completed remote visits, issued prescriptions, and notes.</p>
          </div>
        </div>

        {completedCalls.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            No completed teleconsultations recorded yet.
          </div>
        ) : (
          <div className={styles.queueGrid}>
            {completedCalls.map((session) => (
              <div key={session.id} className={styles.queueCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div className={styles.patientAvatar}>
                      {session.patient?.firstName ? session.patient.firstName[0] : "P"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                        {session.patient?.name || "Patient"}
                      </strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {session.patient?.phone || "Record"}
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.badge} ${styles.badgeCompleted}`}>
                    Completed
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#334155" }}>
                  <strong>Concern:</strong> {session.reason}
                </div>

                {session.prescription && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", color: "#065f46" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                      <Pill size={13} /> Issued Prescription:
                    </strong>
                    <span style={{ whiteSpace: "pre-line" }}>{session.prescription}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#94a3b8" }}>
                  <span>{new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                  {session.durationSeconds > 0 && <span>Duration: {Math.ceil(session.durationSeconds / 60)}m</span>}
                </div>

                <button
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  onClick={() => handleOpenChat(session)}
                >
                  <MessageSquare size={14} /> Open Chat & Records
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Chat Review Modal */}
      <AnimatePresence>
        {activeChatSession && (
          <div className={styles.modalBackdrop} onClick={() => setActiveChatSession(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "grid", placeItems: "center" }}>
            <motion.div
              style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", height: "600px", padding: "20px", display: "flex", flexDirection: "column" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                    Patient: {activeChatSession.patient?.name}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                    Secure direct chat & follow-up
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
                          background: isMe ? "#0284c7" : "#f1f5f9",
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
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message to patient..."
                />
                <button type="submit" style={{ padding: "10px 18px", borderRadius: "10px", background: "#0284c7", color: "white", border: "none", fontWeight: "600", fontSize: "13px", cursor: "pointer" }} disabled={!chatInput.trim() || isSendingChat}>
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
