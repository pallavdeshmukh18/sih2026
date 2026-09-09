import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarDays, Download, FileText, MoreVertical,
  Pill, Share2, ShieldCheck, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { getPatientAppointments, uploadMedicalDocument } from "../services/api";
import { formatDoctorName, transliterateName } from "../utils/transliterate";
import careImage from "../assets/indian-care-dashboard.png";
import gatewayBanner from "../assets/patient-gateway-banner.png";
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

  useEffect(() => {
    if (!token) return;
    getPatientAppointments(token).then((res) => {
      if (res.success && Array.isArray(res.appointments)) setAppointments(res.appointments);
    }).catch(() => {});
  }, [token]);

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

  const displayedAppointments = appointments.slice(0, 3);
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
                const date = new Date(appointment.scheduled_at);
                return (
                  <article key={appointment.id}>
                    <time>
                      <small>{date.toLocaleString(language || "en", { month: "short" })}</small>
                      <strong>{String(date.getDate()).padStart(2, "0")}</strong>
                    </time>
                    <div>
                      <strong>{formatDoctorName({ firstName: appointment.doctor_first_name, lastName: appointment.doctor_last_name }, language)}</strong>
                      <small>{appointment.specialization || appointment.department || t("dashboard.generalPhysician", "General Physician")}</small>
                      <span>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &nbsp;•&nbsp; {appointment.location || t("dashboard.clinicDefault", "MediKiosk Clinic")}</span>
                    </div>
                    <MoreVertical />
                  </article>
                );
              })}
              {displayedAppointments.length === 0 && <div style={{ textAlign: "center", padding: "20px 0", color: "#617471", fontSize: "13px" }}>{t("dashboard.noAppointments", "No upcoming appointments.")}</div>}
            </div>
          </section>

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
