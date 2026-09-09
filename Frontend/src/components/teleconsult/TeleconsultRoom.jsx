import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  FileText, 
  Send, 
  ShieldCheck, 
  Clock, 
  User, 
  Share2, 
  X,
  Stethoscope,
  Pill,
  Sparkles,
  AlertCircle,
  Radio,
  Volume2
} from "lucide-react";
import useAgoraRTC from "../../hooks/useAgoraRTC";
import { 
  fetchTeleconsultMessages, 
  sendTeleconsultMessage, 
  endTeleconsultSession 
} from "../../services/api";
import styles from "./TeleconsultRoom.module.css";

/**
 * Dedicated Remote Video Track Player Subcomponent
 */
function RemoteVideoPlayer({ user }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (user?.videoTrack && containerRef.current) {
      user.videoTrack.play(containerRef.current);
    }
    return () => {
      user?.videoTrack?.stop();
    };
  }, [user, user?.videoTrack]);

  return <div ref={containerRef} className={styles.videoElement} style={{ width: "100%", height: "100%" }} />;
}

/**
 * Dedicated Local Video Track Player Subcomponent
 */
function LocalVideoPlayer({ videoTrack }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (videoTrack && containerRef.current) {
      videoTrack.play(containerRef.current);
    }
    return () => {
      videoTrack?.stop();
    };
  }, [videoTrack]);

  return <div ref={containerRef} className={styles.localPipVideo} style={{ width: "100%", height: "100%" }} />;
}

export default function TeleconsultRoom({
  sessionId,
  agoraConfig, // { appId, token, uid, channelName }
  callType = "video",
  peer, // { name, specialization, role }
  isDoctor = false,
  token,
  onCallEnded,
}) {
  const {
    joined,
    connecting,
    connectionState,
    error: agoraError,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    remoteUsers,
    localVideoTrack,
    joinChannel,
    leaveChannel,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useAgoraRTC();

  // Call duration timer
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  // Side Drawer & Tabs
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'clinical'
  const [unreadCount, setUnreadCount] = useState(0);

  // In-Call Chat State
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Doctor Clinical Notes & Prescription State
  const [doctorNotes, setDoctorNotes] = useState("");
  const [prescription, setPrescription] = useState("");

  const chatBottomRef = useRef(null);

  // Join Agora Channel on mount
  useEffect(() => {
    if (agoraConfig && sessionId) {
      console.log(`[TeleconsultRoom] Initializing Agora connection for channel: ${agoraConfig.channelName}, uid: ${agoraConfig.uid}`);
      joinChannel({
        appId: agoraConfig.appId,
        channelName: agoraConfig.channelName,
        token: agoraConfig.token,
        uid: agoraConfig.uid,
        callType,
      });
    }
  }, [agoraConfig, sessionId, callType, joinChannel]);

  // Duration timer
  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [joined]);

  const formattedDuration = useMemo(() => {
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [durationSeconds]);

  // Poll in-call messages every 2.5 seconds
  useEffect(() => {
    if (!sessionId || !token) return;

    const loadMessages = async () => {
      try {
        const res = await fetchTeleconsultMessages(sessionId, token);
        if (res && res.success && res.messages) {
          setMessages(res.messages);
        }
      } catch (err) {
        console.error("Failed to load in-call messages:", err);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 2500);
    return () => clearInterval(interval);
  }, [sessionId, token]);

  // Auto scroll chat
  useEffect(() => {
    if (isDrawerOpen && activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isDrawerOpen, activeTab]);

  // Send message handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isSendingMsg) return;

    const text = chatInput.trim();
    setChatInput("");
    setIsSendingMsg(true);

    try {
      const res = await sendTeleconsultMessage(sessionId, text, "text", token);
      if (res && res.success && res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      console.error("Failed to send in-call message:", err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  // End Call Handler
  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      await leaveChannel();
      await endTeleconsultSession(
        sessionId,
        {
          doctorNotes: doctorNotes || null,
          prescription: prescription || null,
        },
        token
      );
    } catch (err) {
      console.error("Error ending consultation:", err);
    } finally {
      setIsEnding(false);
      onCallEnded && onCallEnded();
    }
  };

  const peerInitials = peer?.name
    ? peer.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "DR";

  const remoteUserWithVideo = remoteUsers.find((u) => u.hasVideo || u.videoTrack);
  const isRemoteUserConnected = remoteUsers.length > 0;

  return (
    <div className={styles.roomContainer}>
      {/* Top Header Bar */}
      <header className={styles.topBar}>
        <div className={styles.peerInfo}>
          <div className={styles.peerAvatar}>{peerInitials}</div>
          <div className={styles.peerDetails}>
            <h2>{peer?.name || "Consultation Participant"}</h2>
            <p>
              {peer?.specialization ? `${peer.specialization} · ` : ""}
              {callType === "video" ? "HD Video Call" : "Voice Call"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className={styles.callStatusBadge}>
            <div className={styles.pulsingDot} />
            <span>
              {connecting
                ? "Connecting..."
                : joined
                ? isRemoteUserConnected
                  ? `Live · ${formattedDuration}`
                  : `Waiting for ${isDoctor ? "Patient" : "Doctor"} · ${formattedDuration}`
                : "Initializing"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#94a3b8" }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>
      </header>

      {/* Error Alert Banner if any */}
      {agoraError && (
        <div style={{ background: "#7f1d1d", color: "#fecaca", padding: "10px 20px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", zIndex: 30, borderBottom: "1px solid #b91c1c" }}>
          <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
          <span>{agoraError}</span>
        </div>
      )}

      {/* Main Call Stage & Video Grid */}
      <div className={styles.mainStage}>
        <div className={styles.videoGrid}>
          {/* Remote Video / Audio View */}
          <div className={styles.remoteVideoContainer}>
            {remoteUserWithVideo ? (
              <RemoteVideoPlayer key={remoteUserWithVideo.uid} user={remoteUserWithVideo} />
            ) : isRemoteUserConnected ? (
              <div className={styles.remotePlaceholder}>
                <div className={styles.voiceAvatarLarge} style={{ border: "4px solid #10b981" }}>
                  {peerInitials}
                </div>
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: "0 0 6px 0" }}>
                    {peer?.name || "Participant"}
                  </h3>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.2)", padding: "4px 12px", borderRadius: "12px", color: "#34d399", fontSize: "13px", fontWeight: "600" }}>
                    <Volume2 size={16} /> Audio Connected
                  </div>
                </div>
              </div>
            ) : (
              /* Waiting for the other participant to click Join Call */
              <div className={styles.remotePlaceholder}>
                <div className={styles.voiceAvatarLarge} style={{ animation: "pulse 2s infinite" }}>
                  {peerInitials}
                </div>
                <div style={{ maxWidth: "420px", padding: "0 20px" }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", margin: "0 0 8px 0" }}>
                    You are in the room!
                  </h3>
                  <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                    Waiting for <strong>{peer?.name || "the other participant"}</strong> to join. Their live video and voice stream will connect automatically.
                  </p>
                  <div style={{ marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "6px 14px", borderRadius: "16px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                    <Radio size={14} /> Room ID: {agoraConfig?.channelName}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Local Floating Picture-in-Picture Tile */}
          <div className={styles.localPip}>
            {!isVideoMuted && localVideoTrack ? (
              <LocalVideoPlayer videoTrack={localVideoTrack} />
            ) : (
              <div className={styles.localPipMuted}>
                <VideoOff size={24} />
                <span>Camera Off</span>
              </div>
            )}
            <div className={styles.pipBadge}>You {isAudioMuted ? "(Muted)" : ""}</div>
          </div>

          {/* Floating Control Dock */}
          <div className={styles.controlDock}>
            {/* Mic Toggle */}
            <button
              className={`${styles.dockBtn} ${isAudioMuted ? styles.dockBtnDanger : ""}`}
              onClick={toggleAudio}
              title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Camera Toggle */}
            <button
              className={`${styles.dockBtn} ${isVideoMuted ? styles.dockBtnDanger : ""}`}
              onClick={toggleVideo}
              title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            {/* Screen Share */}
            <button
              className={`${styles.dockBtn} ${isScreenSharing ? styles.dockBtnActive : ""}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            >
              <Share2 size={19} />
            </button>

            {/* Chat Drawer Toggle */}
            <button
              className={`${styles.dockBtn} ${isDrawerOpen && activeTab === "chat" ? styles.dockBtnActive : ""}`}
              onClick={() => {
                if (isDrawerOpen && activeTab === "chat") {
                  setIsDrawerOpen(false);
                } else {
                  setIsDrawerOpen(true);
                  setActiveTab("chat");
                }
              }}
              title="Open Chat"
            >
              <MessageSquare size={19} />
              {unreadCount > 0 && <span className={styles.badgeUnread}>{unreadCount}</span>}
            </button>

            {/* Doctor EHR / Clinical Notes Drawer Toggle */}
            {isDoctor && (
              <button
                className={`${styles.dockBtn} ${isDrawerOpen && activeTab === "clinical" ? styles.dockBtnActive : ""}`}
                onClick={() => {
                  if (isDrawerOpen && activeTab === "clinical") {
                    setIsDrawerOpen(false);
                  } else {
                    setIsDrawerOpen(true);
                    setActiveTab("clinical");
                  }
                }}
                title="Clinical Notes & Prescription"
              >
                <FileText size={19} />
              </button>
            )}

            {/* End Call Button */}
            <button
              className={`${styles.dockBtn} ${styles.dockBtnDanger}`}
              onClick={handleEndCall}
              disabled={isEnding}
              title="End Consultation"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>

        {/* Side Drawer (Chat & Clinical Notes) */}
        <AnimatePresence>
          {isDrawerOpen && (
            <motion.aside
              className={styles.sideDrawer}
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Drawer Tabs */}
              <div className={styles.drawerTabs}>
                <button
                  className={`${styles.drawerTabBtn} ${activeTab === "chat" ? styles.drawerTabBtnActive : ""}`}
                  onClick={() => setActiveTab("chat")}
                >
                  <MessageSquare size={15} /> Consultation Chat
                </button>
                {isDoctor && (
                  <button
                    className={`${styles.drawerTabBtn} ${activeTab === "clinical" ? styles.drawerTabBtnActive : ""}`}
                    onClick={() => setActiveTab("clinical")}
                  >
                    <Stethoscope size={15} /> Notes & Rx
                  </button>
                )}
                <button
                  style={{ background: "none", border: "none", color: "#94a3b8", padding: "0 12px", cursor: "pointer" }}
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Chat View */}
              {activeTab === "chat" && (
                <>
                  <div className={styles.chatMessages}>
                    {messages.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#64748b", fontSize: "13px", margin: "auto" }}>
                        No messages yet. Send a secure message to start chatting.
                      </div>
                    ) : (
                      messages.map((msg) => {
                        if (msg.senderRole === "system") {
                          return (
                            <div key={msg.id} className={styles.chatBubbleSystem}>
                              {msg.message}
                            </div>
                          );
                        }

                        if (msg.messageType === "prescription") {
                          return (
                            <div key={msg.id} className={`${styles.chatBubble} ${styles.chatBubblePrescription}`}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "12px", marginBottom: "4px" }}>
                                <Pill size={14} /> Medical Prescription
                              </div>
                              <p style={{ margin: 0, whiteSpace: "pre-line" }}>{msg.message}</p>
                              <div className={styles.chatMeta}>
                                <span>{msg.senderName}</span>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            </div>
                          );
                        }

                        const isMe = msg.isMe;
                        return (
                          <div
                            key={msg.id}
                            className={`${styles.chatBubble} ${isMe ? styles.chatBubbleMe : styles.chatBubblePeer}`}
                          >
                            <div style={{ fontWeight: "600", fontSize: "11px", marginBottom: "2px", opacity: 0.85 }}>
                              {isMe ? "You" : msg.senderName}
                            </div>
                            <div>{msg.message}</div>
                            <div className={styles.chatMeta}>
                              <span />
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form className={styles.chatInputArea} onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      className={styles.chatInput}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a secure message..."
                    />
                    <button type="submit" className={styles.chatSendBtn} disabled={!chatInput.trim() || isSendingMsg}>
                      <Send size={16} />
                    </button>
                  </form>
                </>
              )}

              {/* Doctor Clinical Notes & Prescription View */}
              {activeTab === "clinical" && isDoctor && (
                <div className={styles.clinicalDrawerContent}>
                  <div>
                    <label className={styles.label}>Consultation Clinical Notes</label>
                    <textarea
                      className={styles.textarea}
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      placeholder="Clinical observations, diagnosis, and care plan..."
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Digital Prescription / Advice</label>
                    <textarea
                      className={styles.textarea}
                      style={{ height: "120px" }}
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      placeholder="e.g. Paracetamol 500mg (1-0-1 for 3 days), Warm saline gargles"
                    />
                  </div>

                  <div style={{ background: "rgba(13, 148, 136, 0.1)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(13, 148, 136, 0.2)", fontSize: "12px", color: "#cbd5e1" }}>
                    <div style={{ fontWeight: "600", color: "#2dd4bf", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={14} /> Auto-Saved on End
                    </div>
                    Clinical notes and digital prescription are securely stored in the patient's longitudinal record once you finish the call.
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
