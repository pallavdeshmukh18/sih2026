import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarDays, Download, Droplets, FileImage,
  FileText, FlaskConical, Heart, MoreVertical, Pill, Share2, ShieldCheck,
  Sparkles, Thermometer,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { deleteMedicalDocument, getPatientAppointments, getPatientDocuments, uploadMedicalDocument } from "../services/api";
import DocumentDetailModal from "../components/DocumentDetailModal";
import careImage from "../assets/indian-care-dashboard.png";
import gatewayBanner from "../assets/patient-gateway-banner.png";
import styles from "./PatientDashboard.module.css";

const actionCards = [
  { label: "Book Appointment", copy: "Find and schedule with top doctors", icon: CalendarDays, to: "/patient/doctor", tone: "mint" },
  { label: "Upload Records", copy: "Keep all your reports in one place", icon: FileText, action: "upload", tone: "sand" },
  { label: "View Prescriptions", copy: "Access your past prescriptions", icon: Pill, to: "/patient/history", tone: "rose" },
  { label: "AI Health Assistant", copy: "Get quick health insights", icon: Sparkles, to: "/patient/assessment", tone: "lilac" },
];

const vitals = [
  { label: "Heart Rate", value: "72 bpm", icon: Heart, tone: "heart" },
  { label: "Weight", value: "68 kg", icon: Activity, tone: "weight" },
  { label: "SpO₂", value: "98%", icon: Droplets, tone: "oxygen" },
  { label: "Temperature", value: "36.6 °C", icon: Thermometer, tone: "temperature" },
];

const fallbackAppointments = [
  { id: "sample-1", scheduled_at: "2026-09-14T11:00:00", doctor_first_name: "Ananya", doctor_last_name: "Sharma", specialization: "General Physician", location: "MediKiosk Clinic, Mumbai" },
  { id: "sample-2", scheduled_at: "2026-09-28T16:30:00", doctor_first_name: "Rohan", doctor_last_name: "Mehta", specialization: "Dermatologist", location: "Apollo Hospital, Navi Mumbai" },
  { id: "sample-3", scheduled_at: "2026-10-03T12:00:00", doctor_first_name: "Sneha", doctor_last_name: "Kulkarni", specialization: "Nutritionist", location: "Online Consultation" },
];

export default function PatientDashboard() {
  const { user, token } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const preferred = user?.onboarding?.preferredLanguage || user?.onboarding?.preferred_language || user?.preferredLanguage;
    if (preferred && preferred !== language) changeLanguage(preferred);
  }, [user, language, changeLanguage]);

  useEffect(() => {
    if (!token) return;
    getPatientAppointments(token).then((res) => {
      if (res.success && Array.isArray(res.appointments)) setAppointments(res.appointments);
    }).catch(() => {});
    if (user?.id) {
      getPatientDocuments(user.id, token).then((res) => {
        if (res.success && Array.isArray(res.documents)) setDocuments(res.documents.slice(0, 5));
      }).catch(() => {});
    }
  }, [token, user?.id]);

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
      const res = await getPatientDocuments(user.id, token);
      if (res.success) setDocuments(res.documents.slice(0, 5));
      toast.success("Medical record uploaded.");
    } catch (error) {
      toast.error(error.message || "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteRecord = async (id) => {
    await deleteMedicalDocument(id, token);
    setDocuments((current) => current.filter((document) => document.id !== id));
    setSelectedDoc(null);
  };

  const displayedAppointments = appointments.length ? appointments.slice(0, 3) : fallbackAppointments;
  const firstName = user?.firstName || user?.name || "Patient";

  return (
    <div className={`${styles.page} workspacePage`}>
      <section className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <header className={styles.welcome}>
            <div><h1>Good Morning, {firstName} <span>👋</span></h1><p>Take charge of your health, one step at a time.</p></div>
            <blockquote>“A healthier you<br />builds a brighter tomorrow.”</blockquote>
            <img className={styles.welcomeArt} src={gatewayBanner} alt="" aria-hidden="true" />
          </header>

          <section className={styles.profileBanner}>
            <img src={careImage} alt="Doctor providing attentive care" />
            <div className={styles.profileContent}>
              <span>Next step</span><h2>Complete Your Health Profile</h2>
              <div className={styles.progress}><i /><span>60%</span></div>
              <p>Help your doctor understand you better with a complete medical profile.</p>
              <Link to="/patient/account">Complete Now <ArrowRight /></Link>
            </div>
            <em>Small Details.<br />Bigger Care.</em>
          </section>

          <section className={styles.actionGrid}>
            {actionCards.map(({ label, copy, icon: Icon, to, action, tone }) => {
              const body = <><Icon /><ArrowRight className={styles.actionArrow} /><strong>{label}</strong><small>{action === "upload" && uploading ? "Uploading your record…" : copy}</small></>;
              return action === "upload"
                ? <button key={label} className={styles[tone]} onClick={() => fileInputRef.current?.click()} disabled={uploading}>{body}</button>
                : <Link key={label} className={styles[tone]} to={to}>{body}</Link>;
            })}
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadRecord} hidden />
          </section>

          <div className={styles.lowerGrid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}><h2>Your Health Overview</h2><Link to="/patient/history">View Detailed Reports <ArrowRight /></Link></div>
              <div className={styles.vitals}>
                {vitals.map(({ label, value, icon: Icon, tone }) => <article key={label}><Icon className={styles[tone]} /><strong>{value}</strong><small>{label}</small><span className={styles.sparkline}>⌁</span></article>)}
              </div>
              <div className={styles.stable}><span>❧</span><div><strong>Your vitals look stable!</strong><small>Keep maintaining a healthy lifestyle.</small></div><small>Last updated<br />Sep 10, 2026</small></div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}><h2>Recent Reports</h2><Link to="/patient/documents">View All <ArrowRight /></Link></div>
              <div className={styles.reports}>
                {documents.length ? documents.slice(0, 4).map((doc) => (
                  <button key={doc.id} onClick={() => setSelectedDoc(doc)}><span><FileText /></span><div><strong>{doc.file_name}</strong><small>{new Date(doc.created_at).toLocaleDateString()} · {doc.document_type || "Medical record"}</small></div><MoreVertical /></button>
                )) : ["Blood Test Report", "Chest X-Ray", "Prescription - Dr. Mehta", "Discharge Summary"].map((name, index) => (
                  <button key={name}><span>{index === 1 ? <FileImage /> : index === 0 ? <FlaskConical /> : <FileText />}</span><div><strong>{name}</strong><small>{["12 Sep 2026 · PDF", "28 Aug 2026 · PNG", "15 Aug 2026 · PDF", "10 Jul 2026 · PDF"][index]}</small></div><MoreVertical /></button>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.explore}><span>Healthcare that understands you.<br /><strong>For a healthier India.</strong></span><button onClick={() => navigate("/patient/assessment")}>Explore Features <ArrowRight /></button></section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2>Upcoming Appointments</h2><Link to="/patient/appointments">View All <ArrowRight /></Link></div>
            <div className={styles.appointments}>
              {displayedAppointments.map((appointment) => {
                const date = new Date(appointment.scheduled_at);
                return <article key={appointment.id}><time><small>{date.toLocaleString("en", { month: "short" })}</small><strong>{String(date.getDate()).padStart(2, "0")}</strong></time><div><strong>Dr. {appointment.doctor_first_name} {appointment.doctor_last_name}</strong><small>{appointment.specialization || appointment.department || "General Physician"}</small><span>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &nbsp;•&nbsp; {appointment.location || "MediKiosk Clinic"}</span></div><MoreVertical /></article>;
              })}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}><h2>Quick Actions</h2></div>
            <div className={styles.quickActions}>
              <button><Share2 /><span>Share Records</span></button><button><Download /><span>Download Summary</span></button><button><Activity /><span>Add Vitals</span></button><button><ShieldCheck /><span>Insurance Claims</span></button>
            </div>
          </section>

          <section className={`${styles.card} ${styles.tipCard}`}>
            <div className={styles.cardHeader}><h2>Health Tips</h2><small>1 / 5 &nbsp; ‹ &nbsp; ›</small></div>
            <div><span>🍊</span><p><strong>Stay Hydrated</strong>Drinking enough water helps improve energy, digestion and skin health.</p></div>
          </section>
        </aside>
      </section>
      {selectedDoc && <DocumentDetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} onDelete={deleteRecord} />}
    </div>
  );
}
