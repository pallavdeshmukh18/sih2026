import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Stethoscope,
  MapPin,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import {
  getPatientAppointments,
  getPatientDocuments,
  uploadMedicalDocument,
  deleteMedicalDocument,
} from "../services/api";
import DocumentDetailModal from "../components/DocumentDetailModal";
import MedicalIdCard from "../components/patient/MedicalIdCard";
import careImage from "../assets/indian-care-dashboard.png";
import styles from "./PatientDashboard.module.css";

const CALENDAR_DAYS = [
  "26","27","28","29","30","1","2","3","4","5","6","7","8","9","10",
  "11","12","13","14","15","16","17","18","19","20","21","22","23","24","25",
  "26","27","28","29","30"
];

export default function PatientDashboard() {
  const { user, token } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // 1. Appointments State
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [apptsError, setApptsError] = useState(null);

  // 2. Medical Documents / History State
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // 3. Document Detail Modal & Deletion State
  const [selectedDoc, setSelectedDoc] = useState(null);

  // 3. Document Upload State
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | processing | success | error
  const [uploadMsg, setUploadMsg] = useState("");

  // Restore preferred language from onboarding
  useEffect(() => {
    const userLang = user?.onboarding?.preferredLanguage || user?.onboarding?.preferred_language || user?.preferredLanguage;
    if (userLang && userLang !== language) {
      changeLanguage(userLang);
    }
  }, [user]);

  // Load patient appointments & medical records on mount
  useEffect(() => {
    async function loadData() {
      if (!token) return;

      // Fetch appointments
      try {
        setLoadingAppts(true);
        const apptRes = await getPatientAppointments(token);
        if (apptRes.success && Array.isArray(apptRes.appointments)) {
          setAppointments(apptRes.appointments);
        }
      } catch (err) {
        console.warn("Error loading patient appointments:", err.message);
        setApptsError("Unable to load appointments right now.");
      } finally {
        setLoadingAppts(false);
      }

      // Fetch patient documents for history preview
      if (user?.id) {
        try {
          setLoadingDocs(true);
          const docRes = await getPatientDocuments(user.id, token);
          if (docRes.success && Array.isArray(docRes.documents)) {
            setDocuments(docRes.documents.slice(0, 5)); // Recent 5 records
          }
        } catch (err) {
          console.warn("Error loading patient documents:", err.message);
        } finally {
          setLoadingDocs(false);
        }
      }
    }

    loadData();
  }, [token, user?.id]);

  // Handle Document Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setUploadStatus("error");
      setUploadMsg("Only PDF, JPG, JPEG, and PNG files are supported.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMsg(t("dashboard.uploadingMsg"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", user?.id);
    formData.append("documentType", "other");

    try {
      setTimeout(() => {
        setUploadStatus("processing");
        setUploadMsg(t("dashboard.processingMsg"));
      }, 1000);

      const res = await uploadMedicalDocument(formData, token);

      if (res.success) {
        setUploadStatus("success");
        setUploadMsg(t("dashboard.uploadSuccess"));

        // Refresh document list
        if (user?.id) {
          const docRes = await getPatientDocuments(user.id, token);
          if (docRes.success && Array.isArray(docRes.documents)) {
            setDocuments(docRes.documents.slice(0, 5));
          }
        }
      } else {
        setUploadStatus("error");
        setUploadMsg("Unable to process this record. Please try again.");
      }
    } catch (err) {
      console.error("Document upload failed:", err);
      setUploadStatus("error");
      setUploadMsg("Unable to process this record. Please try again.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Document Deletion
  const handleDeleteDocument = async (docId) => {
    try {
      await deleteMedicalDocument(docId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const patientName = user?.firstName || user?.name || "Patient";

  return (
    <div className={styles.dashboard}>
      {/* Left Wellness / Intro Banner */}
      <aside className={styles.wellness}>
        <div className={styles.wellnessCopy}>
          <span className={styles.namaste}>MEDIKIOSK CLINICAL PORTAL</span>
          <h2>
            Your health,
            <br />
            our clinical care.
          </h2>
          <p>{t("dashboard.greetingSub")}</p>
          <Link to="/patient/assessment">
            {t("dashboard.takeClinicalAssessment")} <ArrowRight size={14} />
          </Link>
        </div>
        <div className={styles.pattern} aria-hidden="true">
          ✦
        </div>
        <img
          src={careImage}
          alt="MediKiosk Clinical Consultation"
        />
        <div className={styles.imageNote}>
          <Stethoscope size={16} />
          <span>
            <strong>Clinical Care Rooted in Trust</strong>
            <small>Personal, private, and secure</small>
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.main}>
        {/* Header Greeting */}
        <header className={styles.greeting}>
          <div>
            <span>{t("dashboard.overviewTitle")}</span>
            <h1>
              {t("dashboard.greetingPrefix")}, {patientName} <i>✦</i>
            </h1>
            <p>{t("dashboard.greetingSub")}</p>
          </div>
          <div className={styles.headerActions}>
            <button aria-label="Notifications">
              <Bell size={17} />
              <i />
            </button>
          </div>
        </header>

        {/* MEDICAL ID CORE CARD */}
        <section>
          <MedicalIdCard />
        </section>

        {/* 1. CLINICAL ASSESSMENT — PRIMARY CTA CARD */}
        <section>
          <div
            style={{
              background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
              borderRadius: "18px",
              padding: "26px",
              color: "#ffffff",
              boxShadow: "0 10px 30px rgba(13, 148, 136, 0.2)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                <Sparkles size={12} /> {t("dashboard.primaryAction")}
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "24px",
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: "#ffffff",
                }}
              >
                {t("dashboard.startAssessmentTitle")}
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: "#ccfbf1",
                  maxWidth: "520px",
                  marginBottom: "20px",
                }}
              >
                {t("dashboard.startAssessmentDesc")}
              </p>
              <button
                onClick={() => navigate("/patient/assessment")}
                style={{
                  background: "#ffffff",
                  color: "#0f766e",
                  fontWeight: "700",
                  fontSize: "13px",
                  padding: "12px 24px",
                  borderRadius: "25px",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.1)",
                }}
              >
                {t("dashboard.startAssessmentBtn")} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. MEDICAL RECORD UPLOAD SECTION */}
        <section>
          <div className={styles.sectionHead}>
            <div>
              <span>{t("dashboard.docManagementTitle")}</span>
              <h2>{t("dashboard.docManagementSub")}</h2>
            </div>
          </div>
          <div
            style={{
              background: "#f8fafc",
              border: "2px dashed #cbd5e1",
              borderRadius: "16px",
              padding: "24px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <UploadCloud size={36} color="#0d9488" style={{ margin: "0 auto 10px" }} />
            <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#1e293b" }}>
              {t("dashboard.docUploadDesc")}
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0 16px" }}>
              {t("dashboard.supportedFormats")}
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: "none" }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === "uploading" || uploadStatus === "processing"}
              style={{
                background: "#0d9488",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {uploadStatus === "uploading" || uploadStatus === "processing" ? (
                <>
                  <Loader2 size={16} className="spin" /> {t("common.loading")}
                </>
              ) : (
                t("dashboard.uploadBtn")
              )}
            </button>

            {/* Status Notification Banner */}
            {uploadStatus !== "idle" && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background:
                    uploadStatus === "error"
                      ? "#fef2f2"
                      : uploadStatus === "success"
                      ? "#f0fdf4"
                      : "#eff6ff",
                  color:
                    uploadStatus === "error"
                      ? "#991b1b"
                      : uploadStatus === "success"
                      ? "#166534"
                      : "#1e40af",
                  border: `1px solid ${
                    uploadStatus === "error"
                      ? "#fecaca"
                      : uploadStatus === "success"
                      ? "#bbf7d0"
                      : "#bfdbfe"
                  }`,
                }}
              >
                {uploadStatus === "error" ? (
                  <AlertTriangle size={16} />
                ) : uploadStatus === "success" ? (
                  <CheckCircle size={16} />
                ) : (
                  <Loader2 size={16} className="spin" />
                )}
                {uploadMsg}
              </div>
            )}
          </div>
        </section>

        {/* 3. MEDICAL HISTORY PREVIEW SECTION */}
        <section className={styles.activitySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>RECORDS PREVIEW</span>
              <h2>{t("dashboard.recentHistoryTitle")}</h2>
            </div>
            <Link to="/patient/history" style={{ fontSize: "12px", fontWeight: "600", color: "#0d9488" }}>
              {t("dashboard.viewHistoryLink")} →
            </Link>
          </div>

          {loadingDocs ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              {t("common.loading")}
            </div>
          ) : documents.length === 0 ? (
            <div
              style={{
                padding: "24px",
                background: "#f8fafc",
                borderRadius: "12px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "13px",
                border: "1px solid #e2e8f0",
              }}
            >
              <FileText size={28} color="#cbd5e1" style={{ margin: "0 auto 8px" }} />
              {t("dashboard.noDocsFound")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  className={styles.docCardHover}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FileText size={20} color="#0d9488" />
                    <div>
                      <strong style={{ fontSize: "13px", color: "#1e293b", display: "block" }}>
                        {doc.file_name}
                      </strong>
                      <small style={{ fontSize: "11px", color: "#64748b" }}>
                        Uploaded {new Date(doc.created_at).toLocaleDateString()} · {doc.document_type || "Medical Record"}
                      </small>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: doc.ocr_status === "completed" ? "#dcfce7" : "#f1f5f9",
                        color: doc.ocr_status === "completed" ? "#166534" : "#475569",
                        fontWeight: "600",
                      }}
                    >
                      {doc.ocr_status === "completed" ? "Processed (OCR)" : "Uploaded"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete record "${doc.file_name}"?`)) {
                          handleDeleteDocument(doc.id);
                        }
                      }}
                      title="Delete Record"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "6px",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* OCR Document Details & Deletion Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={handleDeleteDocument}
        />
      )}

      {/* Right Side Panel — Appointments & Calendar */}
      <aside className={styles.rightPanel}>
        <div className={styles.sectionHead}>
          <div>
            <span>CARE CALENDAR</span>
            <h2>{t("dashboard.upcomingApptsTitle")}</h2>
          </div>
        </div>

        {/* Month Calendar */}
        <section className={styles.calendar}>
          <div className={styles.month}>
            <h3>September 2026</h3>
            <span>
              <button aria-label="Previous Month">
                <ChevronLeft size={13} />
              </button>
              <button aria-label="Next Month">
                <ChevronRight size={13} />
              </button>
            </span>
          </div>
          <div className={styles.week}>
            {["S", "M", "T", "W", "T", "F", "S"].map((x, i) => (
              <span key={`${x}${i}`}>{x}</span>
            ))}
          </div>
          <div className={styles.days}>
            {CALENDAR_DAYS.map((x, i) => (
              <button key={i} className={`${i < 5 ? styles.muted : ""} ${x === "7" ? styles.today : ""}`}>
                {x}
              </button>
            ))}
          </div>
        </section>

        {/* Real Appointments List */}
        <div style={{ marginTop: "16px" }}>
          {loadingAppts ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "12px" }}>
              {t("common.loading")}
            </div>
          ) : apptsError ? (
            <div style={{ padding: "14px", background: "#fef2f2", color: "#991b1b", borderRadius: "10px", fontSize: "12px" }}>
              {apptsError}
            </div>
          ) : appointments.length === 0 ? (
            <div
              style={{
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "12px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "13px",
                border: "1px solid #e2e8f0",
              }}
            >
              {t("dashboard.noApptsFound")}
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {appointments.map((appt) => {
                const apptDate = new Date(appt.scheduled_at);
                return (
                  <article key={appt.id} className={`${styles.scheduleItem} ${styles.green}`}>
                    <span className={styles.scheduleIcon}>🩺</span>
                    <div>
                      <h3>
                        Dr. {appt.doctor_first_name} {appt.doctor_last_name}
                      </h3>
                      <p>
                        {appt.specialization || appt.department || "General Physician"} ·{" "}
                        {apptDate.toLocaleDateString()} {apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <Link className={styles.more} to="/patient/appointments" style={{ marginTop: "auto" }}>
          {t("navigation.appointments")} <ArrowRight size={14} />
        </Link>
      </aside>
    </div>
  );
}

