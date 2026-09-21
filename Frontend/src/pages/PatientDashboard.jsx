import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock3, FileImage, FileText, Heart, MapPin, MoreVertical, Pill, Scale, Users, Waves, Footprints } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n";
import { getPatientAppointments, uploadMedicalDocument } from "../services/api";
import { formatDoctorName, transliterateName } from "../utils/transliterate";
import heroImage from "../assets/patient-dashboard-mountain-hero.png";
import styles from "./PatientDashboard.module.css";

const records = [
  { name: "Blood Test Report", date: "12 Sep 2026", type: "Lab Report", icon: FileText, tone: "red" },
  { name: "Prescription - Dr. Sharma", date: "10 Sep 2026", type: "Prescription", icon: FileText, tone: "blue" },
  { name: "Chest X-Ray", date: "28 Aug 2026", type: "Imaging", icon: FileImage, tone: "purple" },
];
const prescriptions = [
  { name: "Amlodipine 5mg", dose: "1 tablet", frequency: "Once daily" },
  { name: "Atorvastatin 10mg", dose: "1 tablet", frequency: "Once daily" },
  { name: "Montelukast 10mg", dose: "1 tablet", frequency: "At night" },
];

export default function PatientDashboard() {
  const { user, token } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPatientAppointments(token, "upcoming").then((res) => res.success && setAppointments(Array.isArray(res.appointments) ? res.appointments : [])).catch(() => {});
  }, [token]);

  const uploadRecord = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return toast.error("Please choose a PDF, JPG, or PNG file.");
    const data = new FormData();
    data.append("file", file); data.append("patientId", user?.id); data.append("documentType", "other");
    setUploading(true);
    try { await uploadMedicalDocument(data, token); toast.success(t("dashboard.uploadSuccess", "Medical record uploaded.")); }
    catch (error) { toast.error(error.message || "Upload failed."); }
    finally { setUploading(false); event.target.value = ""; }
  };

  const firstName = transliterateName(user?.firstName || user?.name || "Nisarg", language);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const active = appointments.find((a) => ["scheduled", "confirmed", "upcoming"].includes(a.status?.toLowerCase())) || appointments[0];
  const appointmentDate = active?.scheduledAt || active?.scheduled_at ? new Date(active.scheduledAt || active.scheduled_at) : new Date("2026-09-10T10:30:00");
  const doctor = active ? formatDoctorName({ firstName: active.doctor?.firstName || active.doctor_first_name || "Rajesh", lastName: active.doctor?.lastName || active.doctor_last_name || "Sharma" }, language) : "Dr. Rajesh Sharma";
  const openUploadPicker = () => document.getElementById("patient-record-upload")?.click();
  const actions = [
    { label: "Book Appointment", copy: "Find and schedule with trusted doctors", icon: CalendarDays, tone: "mint", onClick: () => navigate("/patient/doctor") },
    { label: "Upload Record", copy: uploading ? "Uploading your record…" : "Add reports, prescriptions and more", icon: FileText, tone: "blue", onClick: openUploadPicker },
    { label: "View Prescriptions", copy: "Access your current and past prescriptions", icon: Pill, tone: "rose", onClick: () => navigate("/patient/history") },
    { label: "Find Doctors", copy: "Search by specialty, location or symptoms", icon: Users, tone: "lilac", onClick: () => navigate("/patient/doctor") },
  ];

  return <div className={`${styles.page} workspacePage`}>
    <section className={styles.hero} style={{ "--hero-image": `url(${heroImage})` }}>
      <div className={styles.heroCopy}><span>{greeting}</span><h1>Take charge of your health, <em>{firstName}.</em></h1><p>Book appointments, access your records and get better care — all in one place.</p></div>
      <blockquote>“A healthier<br />tomorrow is a<br />brighter you.”<i /></blockquote>
    </section>
    <section className={styles.actionGrid}>
      {actions.map(({ label, copy, icon: Icon, tone, onClick }) => <button key={label} className={styles[tone]} onClick={onClick} disabled={uploading && label === "Upload Record"}><span className={styles.actionIcon}><Icon /></span><span className={styles.actionText}><strong>{label}</strong><small>{copy}</small></span><span className={styles.actionArrow}><ArrowRight /></span></button>)}
      <input id="patient-record-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadRecord} hidden />
    </section>
    <section className={styles.dashboardGrid}>
      <article className={`${styles.panel} ${styles.appointmentPanel}`}>
        <PanelHeader title="Your Next Appointment" link="/patient/appointments" label="View All" />
        <div className={styles.appointmentBody}>
          <time><small>{appointmentDate.toLocaleString("en", { month: "short" })}</small><strong>{String(appointmentDate.getDate()).padStart(2, "0")}</strong><span>{appointmentDate.toLocaleString("en", { weekday: "short" })}</span></time>
          <div className={styles.doctorInfo}><strong>{doctor}</strong><small>{active?.doctor?.specialization || active?.specialization || "Cardiology"} <b>•</b> {active?.location || "MediKiosk Clinic, Mumbai"}</small><span><Clock3 /> {appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <b>(in 2 days)</b></span><span><MapPin /> {active?.location || "MediKiosk Clinic, Mumbai"}</span></div>
          <div className={styles.appointmentActions}><button onClick={() => navigate("/patient/appointments")}>View Details</button><button onClick={() => navigate("/patient/schedule")}>Reschedule</button></div>
        </div>
      </article>
      <article className={`${styles.panel} ${styles.overviewPanel}`}><PanelHeader title="Health Overview" link="/patient/assessment" label="View Details" /><div className={styles.metrics}><Metric icon={Heart} value="72 bpm" label="Heart Rate" tone="metricRed" /><Metric icon={Waves} value="98 %" label={<>SpO<sub>2</sub></>} tone="metricOrange" /><Metric icon={Scale} value="65 kg" label="Weight" tone="metricGreen" /><Metric icon={Footprints} value="4,320" label="Steps Today" tone="metricGreen" /></div></article>
      <article className={`${styles.panel} ${styles.recordsPanel}`}><PanelHeader title="Recent Records" link="/patient/documents" label="View All" /><div className={styles.rows}>{records.map(({ name, date, type, icon: Icon, tone }) => <div className={styles.recordRow} key={name}><span className={`${styles.fileIcon} ${styles[tone]}`}><Icon /></span><strong>{name}</strong><span>{date} <b>•</b> {type}</span><button onClick={() => navigate("/patient/documents")}>View</button><MoreVertical /></div>)}</div></article>
      <article className={`${styles.panel} ${styles.prescriptionsPanel}`}><PanelHeader title="Prescriptions" link="/patient/history" label="View All" /><div className={styles.rows}>{prescriptions.map(({ name, dose, frequency }) => <Link className={styles.prescriptionRow} to="/patient/history" key={name}><span><Pill /></span><strong>{name}</strong><small>{dose} <b>•</b> {frequency}</small><ArrowRight /></Link>)}</div></article>
    </section>
  </div>;
}

function PanelHeader({ title, link, label }) { return <header className={styles.panelHeader}><h2>{title}</h2><Link to={link}>{label} <ArrowRight /></Link></header>; }
function Metric({ icon: Icon, value, label, tone }) { return <div className={`${styles.metric} ${styles[tone]}`}><Icon /><strong>{value}</strong><span>{label}</span></div>; }
