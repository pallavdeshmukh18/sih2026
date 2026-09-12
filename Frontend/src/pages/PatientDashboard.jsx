import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarDays, Download, FileText, MoreVertical,
  Pill, Share2, ShieldCheck, Sparkles, Trash2, X, Info, Calendar, Stethoscope, MapPin, User
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { getPatientAppointments, uploadMedicalDocument, cancelAppointment } from "../services/api";
import { formatDoctorName, transliterateName } from "../utils/transliterate";
import careImage from "../assets/indian-care-dashboard.png";
import gatewayBanner from "../assets/patient-gateway-banner.png";
import ClinicalSummaryCard from "../components/common/ClinicalSummaryCard";
import styles from "./PatientDashboard.module.css";

const actionCards = [
  { label: "Book Appointment", copy: "Find and schedule with top doctors", icon: CalendarDays, to: "/patient/doctor", tone: "mint" },
  { label: "Upload Records", copy: "Keep all your reports in one place", icon: FileText, action: "upload", tone: "sand" },
  { label: "View Prescriptions", copy: "Access your past prescriptions", icon: Pill, to: "/patient/history", tone: "rose" },
  { label: "AI Health Assistant", copy: "Get quick health insights", icon: Sparkles, to: "/patient/assessment", tone: "lilac" },
];

const healthTips = [
  { icon: "🍊", title: "Stay Hydrated", text: "Drinking enough water helps improve energy, digestion and skin health." },
  { icon: "🚶", title: "Daily Movement", text: "Aim for at least 30 minutes of physical activity every day." },
  { icon: "😴", title: "Quality Sleep", text: "Getting 7-8 hours of sleep helps your body recover and boosts immunity." },
  { icon: "🥗", title: "Balanced Diet", text: "Incorporate more fruits and vegetables into your daily meals." },
  { icon: "🧘", title: "Mental Health", text: "Take a few minutes each day to practice deep breathing or meditation." },
];

export default function PatientDashboard() {
  const { user, token } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const fetchAppointments = () => {
    if (!token) return;
    getPatientAppointments(token, "upcoming").then((res) => {
      if (res.success && Array.isArray(res.appointments)) setAppointments(res.appointments);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchAppointments();
  }, [token]);

  const handleCancelAppointment = async (event, apptId) => {
    event.stopPropagation();
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(apptId, token);
      toast.success("Appointment cancelled successfully.");
      setSelectedAppt(null);
      setAppointments((prev) => prev.filter((a) => a.id !== apptId));
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment.");
    }
  };

  const uploadRecord = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Please choose a PDF, JPG, or PNG file.");
      return;
    }
    const data = new FormData();
    data.append("file", file);
    data.append("patientId", user?.id);
    data.append("documentType", "other");
    setUploading(true);
    try {
      await uploadMedicalDocument(data, token);
      toast.success(t("dashboard.uploadSuccess", "Medical record uploaded."));
    } catch (error) {
      toast.error(error.message || "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const actionCards = [
    { label: t("dashboard.bookAppointment", "Book Appointment"), copy: t("dashboard.bookAppointmentDesc", "Find and schedule with top doctors"), icon: CalendarDays, to: "/patient/doctor", tone: "mint" },
    { label: t("dashboard.uploadRecords", "Upload Records"), copy: t("dashboard.uploadRecordsDesc", "Keep all your reports in one place"), icon: FileText, action: "upload", tone: "sand" },
    { label: t("dashboard.viewPrescriptions", "View Prescriptions"), copy: t("dashboard.viewPrescriptionsDesc", "Access your past prescriptions"), icon: Pill, to: "/patient/history", tone: "rose" },
    { label: t("dashboard.aiHealthAssistant", "AI Health Assistant"), copy: t("dashboard.aiHealthAssistantDesc", "Get quick health insights"), icon: Sparkles, to: "/patient/assessment", tone: "lilac" },
  ];

  const upcomingStatuses = new Set(["scheduled", "confirmed", "upcoming"]);
  const uniqueAppointments = Array.from(new Map((appointments || []).map(item => [item.id, item])).values());
  const activeAppointments = uniqueAppointments.filter((item) => upcomingStatuses.has(item.status?.toLowerCase()));
  const displayedAppointments = activeAppointments.slice(0, 3);
  const firstName = user?.firstName || user?.name || "Patient";

  const currentHour = new Date().getHours();
  const greetingText = currentHour < 12
    ? t("dashboard.greetingMorning", "Good Morning")
    : currentHour < 17
    ? t("dashboard.greetingAfternoon", "Good Afternoon")
    : t("dashboard.greetingEvening", "Good Evening");

  const nextTip = () => setTipIndex((prev) => (prev + 1) % healthTips.length);
  const prevTip = () => setTipIndex((prev) => (prev - 1 + healthTips.length) % healthTips.length);

  return (
    <div className={`${styles.page} workspacePage`}>
      <section className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <header className={styles.welcome}>
            <div>
              <h1>{greetingText}, {transliterateName(firstName, language)} <span>👋</span></h1>
              <p>{t("dashboard.greetingSub", "Take charge of your health, one step at a time.")}</p>
            </div>
            <blockquote>{t("dashboard.quote", "“A healthier you builds a brighter tomorrow.”")}</blockquote>
            <img className={styles.welcomeArt} src={gatewayBanner} alt="" aria-hidden="true" />
          </header>

          <section className={styles.profileBanner}>
            <img src={careImage} alt="Doctor providing attentive care" />
            <div className={styles.profileContent}>
              <span>{t("dashboard.nextStep", "Next step")}</span>
              <h2>{t("dashboard.completeProfileTitle", "Complete Your Health Profile")}</h2>
              <div className={styles.progress}><i /><span>60%</span></div>
              <p>{t("dashboard.completeProfileDesc", "Help your doctor understand you better with a complete medical profile.")}</p>
              <div className={styles.bannerActions}>
                <Link to="/patient/account" className={styles.completeBtn}>
                  {t("dashboard.completeNow", "Complete Now")} <ArrowRight />
                </Link>
                <Link to="/patient/assessment" className={styles.assessmentBtn}>
                  <Sparkles size={14} /> Clinical Assessment
                </Link>
              </div>
            </div>
            <em>{t("dashboard.profileTagline", "Small Details. Bigger Care.")}</em>
          </section>

          <section className={styles.actionGrid}>
            {actionCards.map(({ label, copy, icon: Icon, to, action, tone }) => {
              const body = <><Icon /><ArrowRight className={styles.actionArrow} /><strong>{label}</strong><small>{action === "upload" && uploading ? t("dashboard.uploadingRecord", "Uploading your record…") : copy}</small></>;
              return action === "upload"
                ? <button key={label} className={styles[tone]} onClick={() => fileInputRef.current?.click()} disabled={uploading}>{body}</button>
                : <Link key={label} className={styles[tone]} to={to}>{body}</Link>;
            })}
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadRecord} hidden />
          </section>

          <section className={styles.explore}>
            <span>
              {t("dashboard.exploreBanner", "Healthcare that understands you.")}<br />
              <strong>{t("dashboard.exploreBannerSub", "For a healthier India.")}</strong>
            </span>
            <button onClick={() => navigate("/patient/assessment")}>
              {t("dashboard.exploreFeatures", "Explore Features")} <ArrowRight />
            </button>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>{t("dashboard.upcomingAppointments", "Upcoming Appointments")}</h2>
              <Link to="/patient/appointments">{t("dashboard.viewAll", "View All")} <ArrowRight /></Link>
            </div>
            <div className={styles.appointments}>
              {displayedAppointments.map((appointment) => {
                const rawDate = appointment.scheduledAt || appointment.scheduled_at;
                const date = rawDate ? new Date(rawDate) : new Date();
                const isValidDate = !isNaN(date.getTime());
                const docObj = appointment.doctor || {};
                const docFirstName = docObj.firstName || appointment.doctor_first_name || appointment.doctorFirstName || "Doctor";
                const docLastName = docObj.lastName || appointment.doctor_last_name || appointment.doctorLastName || "";
                const docSpec = docObj.specialization || appointment.specialization || appointment.department || t("dashboard.generalPhysician", "General Physician");
                const docNameFormatted = formatDoctorName({ firstName: docFirstName, lastName: docLastName }, language);

                return (
                  <article
                    key={appointment.id}
                    onClick={() => setSelectedAppt(appointment)}
                    style={{ cursor: "pointer", position: "relative" }}
                  >
                    <time>
                      <small>{isValidDate ? date.toLocaleString(language || "en", { month: "short" }) : "---"}</small>
                      <strong>{isValidDate ? String(date.getDate()).padStart(2, "0") : "--"}</strong>
                    </time>
                    <div>
                      <strong>{docNameFormatted}</strong>
                      <small>{docSpec}</small>
                      <span>
                        {isValidDate ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"} &nbsp;•&nbsp; {appointment.location || t("dashboard.clinicDefault", "MediKiosk Clinic")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCancelAppointment(e, appointment.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "6px",
                        marginLeft: "auto",
                      }}
                      title="Cancel Appointment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })}
              {displayedAppointments.length === 0 && <div style={{ textAlign: "center", padding: "20px 0", color: "#617471", fontSize: "13px" }}>{t("dashboard.noAppointments", "No upcoming appointments.")}</div>}
            </div>
          </section>

          {/* Appointment Details Modal */}
          {selectedAppt && (
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
            }} onClick={() => setSelectedAppt(null)}>
              <div style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "28px",
                maxWidth: "500px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0"
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                    Appointment Details
                  </h3>
                  <button onClick={() => setSelectedAppt(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                    <X size={20} />
                  </button>
                </div>

                {(() => {
                  const rawDate = selectedAppt.scheduledAt || selectedAppt.scheduled_at;
                  const d = rawDate ? new Date(rawDate) : new Date();
                  const docObj = selectedAppt.doctor || {};
                  const docName = formatDoctorName({ firstName: docObj.firstName || selectedAppt.doctor_first_name, lastName: docObj.lastName || selectedAppt.doctor_last_name }, language);
                  const spec = docObj.specialization || selectedAppt.specialization || "General Medicine";

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "12px", padding: "16px" }}>
                        <strong style={{ fontSize: "16px", color: "#0d9488", display: "block" }}>{docName}</strong>
                        <span style={{ fontSize: "13px", color: "#475569" }}>{spec}</span>
                      </div>

                      <div style={{ fontSize: "13px", color: "#334155", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div>📅 <strong>Scheduled Date:</strong> {!isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "full" }) : "TBD"}</div>
                        <div>⏰ <strong>Time Slot:</strong> {!isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}</div>
                        <div>🏥 <strong>Location:</strong> {selectedAppt.location || "MediKiosk Clinic, Mumbai"}</div>
                        <div>🩺 <strong>Consultation Type:</strong> {selectedAppt.appointmentType === "teleconsultation" ? "Video Call (Teleconsultation)" : "In-Person Visit"}</div>
                        <div>📌 <strong>Reason:</strong> {selectedAppt.reason || "General Medical Checkup"}</div>
                        {selectedAppt.notes && (
                          <div style={{ marginTop: "8px" }}>
                            <strong style={{ fontSize: "13px", color: "#334155", display: "block", marginBottom: "6px" }}>📝 Clinical Notes & AI Intake Summary:</strong>
                            <ClinicalSummaryCard
                              summary={selectedAppt.notes}
                              chiefComplaint={selectedAppt.reason}
                              createdAt={selectedAppt.createdAt || selectedAppt.scheduledAt}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                        <button
                          type="button"
                          onClick={(e) => handleCancelAppointment(e, selectedAppt.id)}
                          style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#ef4444",
                            padding: "10px 18px",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <Trash2 size={15} /> Cancel Appointment
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAppt(null)}
                          style={{
                            background: "#0d9488",
                            color: "#ffffff",
                            border: "none",
                            padding: "10px 20px",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
            </div>
            <div className={styles.quickActions}>
              <button onClick={() => navigate("/patient/medical-id")}><Share2 /><span>{t("dashboard.shareRecords", "Share Records")}</span></button>
              <button onClick={() => navigate("/patient/documents")}><Download /><span>{t("dashboard.downloadSummary", "Download Summary")}</span></button>
              <button onClick={() => navigate("/patient/assessment")}><Activity /><span>{t("dashboard.addVitals", "Add Vitals")}</span></button>
              <button onClick={() => navigate("/patient/history")}><ShieldCheck /><span>{t("dashboard.insuranceClaims", "Insurance Claims")}</span></button>
            </div>
          </section>

          <section className={`${styles.card} ${styles.tipCard}`}>
            <div className={styles.cardHeader}>
              <h2>{t("dashboard.healthTips", "Health Tips")}</h2>
              <small>
                {tipIndex + 1} / {healthTips.length} &nbsp; 
                <span style={{ cursor: 'pointer' }} onClick={prevTip}>‹</span> &nbsp; 
                  <span style={{ cursor: "pointer" }} onClick={nextTip}>›</span>
              </small>
            </div>
            <div>
              <span>{healthTips[tipIndex].icon}</span>
              <p><strong>{t(`dashboard.tip${tipIndex + 1}Title`, healthTips[tipIndex].title)}</strong>{t(`dashboard.tip${tipIndex + 1}Desc`, healthTips[tipIndex].text)}</p>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
