import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Activity, 
  FileText, 
  Pill, 
  AlertTriangle, 
  ShieldAlert, 
  Calendar, 
  Phone, 
  Mail, 
  Droplet, 
  Stethoscope, 
  Video, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  HeartPulse,
  Leaf
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchPatientUnifiedHistory } from "../../services/api";
import ClinicalSummaryRenderer from "../common/ClinicalSummaryRenderer";
import styles from "./PatientHistoryModal.module.css";

export default function PatientHistoryModal({ patientId, patientName, onClose, initialTab = "ai_triage" }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    if (!patientId || !token) return;
    let isMounted = true;
    setLoading(true);
    setError("");

    fetchPatientUnifiedHistory(patientId, token)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && res.unifiedHistory) {
          setHistoryData(res.unifiedHistory);
        } else {
          throw new Error(res?.message || "Failed to load patient history.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load patient unified history:", err);
        setError(err.message || "Unable to retrieve patient health record.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [patientId, token]);

  const patient = historyData?.patient || {};
  const fullName = patient.first_name || patient.firstName
    ? `${patient.first_name || patient.firstName} ${patient.last_name || patient.lastName || ""}`.trim()
    : patientName || "Patient";
  
  const dob = patient.date_of_birth || patient.dateOfBirth;
  const age = dob ? Math.floor((new Date() - new Date(dob)) / 31557600000) : null;
  const gender = patient.gender || "Not specified";
  const bloodGroup = patient.blood_group || patient.bloodGroup || null;
  const abhaId = patient.abha_id || patient.abhaId || null;
  const phone = patient.phone || null;
  const email = patient.email || null;

  const clinicalSessions = historyData?.clinicalSessions || [];
  const medicalHistory = historyData?.medicalHistory || [];
  const documents = historyData?.documents || [];
  const pastConsultations = historyData?.pastConsultations || [];
  const teleconsultSessions = historyData?.teleconsultSessions || [];

  // Group medical history by category
  const allergies = medicalHistory.filter((m) => m.category === "allergy" || m.category === "allergies");
  const chronicConditions = medicalHistory.filter((m) => m.category === "condition" || m.category === "chronic_disease");
  const medications = medicalHistory.filter((m) => m.category === "medication" || m.category === "prescription");
  const surgeries = medicalHistory.filter((m) => m.category === "surgery" || m.category === "surgeries");
  const otherHistory = medicalHistory.filter((m) => !["allergy", "allergies", "condition", "chronic_disease", "medication", "prescription", "surgery", "surgeries"].includes(m.category));

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.patientMeta}>
            <div className={styles.avatar}>
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.info}>
              <h2>
                {fullName}
                {bloodGroup && (
                  <span className={`${styles.badge} ${styles.badgeBlood}`}>
                    <Droplet size={11} /> {bloodGroup}
                  </span>
                )}
              </h2>
              <div className={styles.badgesRow}>
                <span className={styles.badge}>
                  <User size={11} /> {age ? `${age} yrs` : "Age N/A"} • {gender}
                </span>
                {abhaId && (
                  <span className={`${styles.badge} ${styles.badgeAbha}`}>
                    ABHA: {abhaId}
                  </span>
                )}
                {phone && (
                  <span className={styles.badge}>
                    <Phone size={11} /> {phone}
                  </span>
                )}
                {email && (
                  <span className={styles.badge}>
                    <Mail size={11} /> {email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>

        {/* Tabs Bar */}
        <nav className={styles.tabsBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === "ai_triage" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("ai_triage")}
          >
            <Sparkles size={14} />
            AI Intake & Triage
            <span className={styles.tabCount}>{clinicalSessions.length}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "profile" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <HeartPulse size={14} />
            Medical Profile
            <span className={styles.tabCount}>{medicalHistory.length}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "consultations" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("consultations")}
          >
            <Stethoscope size={14} />
            Past Consultations
            <span className={styles.tabCount}>{pastConsultations.length}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "teleconsult" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("teleconsult")}
          >
            <Video size={14} />
            Teleconsultations
            <span className={styles.tabCount}>{teleconsultSessions.length}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "documents" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            <FileText size={14} />
            Documents & Reports
            <span className={styles.tabCount}>{documents.length}</span>
          </button>
        </nav>

        {/* Modal Content */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingWrap}>
              <Loader2 size={32} className={styles.spin} style={{ margin: "0 auto 12px" }} />
              <p>Loading patient health history and clinical records...</p>
            </div>
          ) : error ? (
            <div className={styles.errorAlert}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: AI Clinical Intake & Triage */}
              {activeTab === "ai_triage" && (
                <div>
                  {clinicalSessions.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Sparkles size={36} style={{ opacity: 0.4 }} />
                      <strong>No Clinical Triage Sessions</strong>
                      <p>Patient has not completed an AI pre-consultation intake assessment yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {clinicalSessions.map((session) => {
                        let redFlags = [];
                        try {
                          if (session.current_state?.red_flags) redFlags = session.current_state.red_flags;
                        } catch (e) {}

                        const isAyush = session.consultation_type === "ayush" || session.consultationType === "ayush";
                        const sessionDate = session.created_at || session.createdAt;

                        return (
                          <div key={session.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                              <div>
                                <div className={styles.cardTitle}>
                                  {isAyush ? (
                                    <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                      <Leaf size={15} /> AYUSH / Ayurvedic Assessment
                                    </span>
                                  ) : (
                                    <span style={{ color: "#0d9488", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                      <Stethoscope size={15} /> Clinical Intake Assessment
                                    </span>
                                  )}
                                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
                                    • {session.chief_complaint || "General Health Review"}
                                  </span>
                                </div>
                              </div>
                              <div className={styles.cardDate}>
                                <Clock size={12} />
                                {sessionDate ? new Date(sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                              </div>
                            </div>

                            {redFlags.length > 0 && !session.summary?.includes("Critical Alerts") && !session.summary?.includes("Red Flags") && (
                              <div className={styles.redFlagBox}>
                                <ShieldAlert size={16} />
                                <div>
                                  <strong>Clinical Flags Detected:</strong> {redFlags.join(", ")}
                                </div>
                              </div>
                            )}

                            {session.summary ? (
                              <ClinicalSummaryRenderer summary={session.summary} />
                            ) : (
                              <div style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
                                Intake session in progress or pending summary finalization.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Medical Profile & Health History */}
              {activeTab === "profile" && (
                <div className={styles.profileGrid}>
                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <AlertTriangle size={15} color="#dc2626" />
                      Allergies ({allergies.length})
                    </div>
                    {allergies.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>No known allergies recorded</span>
                    ) : (
                      <div className={styles.tagList}>
                        {allergies.map((a, i) => (
                          <span key={i} className={`${styles.tag} ${styles.tagAllergy}`}>
                            {a.condition_name || a.name} {a.severity ? `(${a.severity})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <Activity size={15} color="#d97706" />
                      Chronic Conditions ({chronicConditions.length})
                    </div>
                    {chronicConditions.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>No chronic conditions recorded</span>
                    ) : (
                      <div className={styles.tagList}>
                        {chronicConditions.map((c, i) => (
                          <span key={i} className={`${styles.tag} ${styles.tagCondition}`}>
                            {c.condition_name || c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <Pill size={15} color="#0369a1" />
                      Active Medications ({medications.length})
                    </div>
                    {medications.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>No active medications recorded</span>
                    ) : (
                      <div className={styles.tagList}>
                        {medications.map((m, i) => (
                          <span key={i} className={`${styles.tag} ${styles.tagMed}`}>
                            {m.condition_name || m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <Stethoscope size={15} color="#7e22ce" />
                      Past Surgeries / Procedures ({surgeries.length})
                    </div>
                    {surgeries.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>No surgeries recorded</span>
                    ) : (
                      <div className={styles.tagList}>
                        {surgeries.map((s, i) => (
                          <span key={i} className={`${styles.tag} ${styles.tagSurgery}`}>
                            {s.condition_name || s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {otherHistory.length > 0 && (
                    <div className={styles.profileSection} style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.profileSectionTitle}>
                        <FileText size={15} color="#475569" />
                        Other Medical History Notes ({otherHistory.length})
                      </div>
                      <div className={styles.tagList}>
                        {otherHistory.map((o, i) => (
                          <span key={i} className={styles.tag} style={{ background: "#f1f5f9", color: "#334155" }}>
                            {o.condition_name || o.name || o.category}: {o.notes || "Recorded"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Past Consultations */}
              {activeTab === "consultations" && (
                <div>
                  {pastConsultations.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Stethoscope size={36} style={{ opacity: 0.4 }} />
                      <strong>No Past Consultations</strong>
                      <p>There are no completed clinical consultations on file for this patient.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {pastConsultations.map((c) => (
                        <div key={c.id} className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                              <CheckCircle2 size={15} color="#16a34a" />
                              Consultation with Dr. {c.doctor_first_name} {c.doctor_last_name || ""}
                            </div>
                            <div className={styles.cardDate}>
                              <Calendar size={12} />
                              {c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Completed"}
                            </div>
                          </div>
                          {c.diagnosis && (
                            <div style={{ marginBottom: "8px", fontSize: "13px" }}>
                              <strong style={{ color: "#0f172a" }}>Diagnosis:</strong> {c.diagnosis}
                            </div>
                          )}
                          {c.clinical_notes && (
                            <div style={{ marginTop: "6px" }}>
                              <strong style={{ fontSize: "12.5px", color: "#0f766e", display: "block", marginBottom: "4px" }}>Doctor Clinical Notes:</strong>
                              <ClinicalSummaryRenderer summary={c.clinical_notes} />
                            </div>
                          )}
                          {c.treatment_notes && (
                            <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
                              <strong style={{ display: "block", marginBottom: "4px" }}>Treatment Plan:</strong>
                              <ClinicalSummaryRenderer summary={c.treatment_notes} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Teleconsultations */}
              {activeTab === "teleconsult" && (
                <div>
                  {teleconsultSessions.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Video size={36} style={{ opacity: 0.4 }} />
                      <strong>No Teleconsultation History</strong>
                      <p>Patient has not completed any remote video or voice calls yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {teleconsultSessions.map((session) => (
                        <div key={session.id} className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                              <Video size={15} color="#0284c7" />
                              {session.call_type === "video" ? "Video Call" : "Voice Consultation"}
                              <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", background: session.status === "completed" ? "#dcfce7" : "#fef3c7", color: session.status === "completed" ? "#166534" : "#854d0e", fontWeight: "700" }}>
                                {session.status?.toUpperCase()}
                              </span>
                            </div>
                            <div className={styles.cardDate}>
                              <Clock size={12} />
                              {session.scheduled_at ? new Date(session.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                            </div>
                          </div>
                          <div style={{ fontSize: "13px", color: "#334155", marginBottom: "6px" }}>
                            <strong>Reason for Call:</strong> {session.reason || "General Teleconsultation"}
                          </div>
                          {session.doctor_notes && (
                            <div style={{ marginTop: "6px" }}>
                              <strong style={{ fontSize: "12.5px", color: "#0369a1", display: "block", marginBottom: "4px" }}>Doctor Clinical Notes:</strong>
                              <ClinicalSummaryRenderer summary={session.doctor_notes} />
                            </div>
                          )}
                          {session.prescription && (
                            <div style={{ marginTop: "8px", fontSize: "12px", color: "#0369a1", background: "#f0f9ff", padding: "8px 12px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                              <strong>Prescription / Advised Care:</strong> {session.prescription}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Documents & Reports */}
              {activeTab === "documents" && (
                <div>
                  {documents.length === 0 ? (
                    <div className={styles.emptyState}>
                      <FileText size={36} style={{ opacity: 0.4 }} />
                      <strong>No Documents Uploaded or Consented</strong>
                      <p>No medical records or OCR lab reports are currently shared for this patient.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {documents.map((doc) => (
                        <div key={doc.id} className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                              <FileText size={15} color="#0d9488" />
                              {doc.file_name || doc.title || "Clinical Document"}
                            </div>
                            <div className={styles.cardDate}>
                              <Calendar size={12} />
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                            </div>
                          </div>
                          {doc.doc_summary && (
                            <div style={{ marginBottom: "8px" }}>
                              <strong style={{ fontSize: "12.5px", color: "#0f766e", display: "block", marginBottom: "4px" }}>AI Document Summary:</strong>
                              <ClinicalSummaryRenderer summary={doc.doc_summary} />
                            </div>
                          )}
                          {doc.extracted_text && (
                            <div style={{ fontSize: "12px", color: "#475569", background: "#f1f5f9", padding: "10px", borderRadius: "8px" }}>
                              <strong>Extracted OCR Text:</strong>
                              <p style={{ margin: "4px 0 0 0", maxHeight: "100px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                                {doc.extracted_text}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>
            Close Record
          </button>
        </footer>
      </div>
    </div>
  );
}
