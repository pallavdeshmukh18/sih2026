import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  FileText,
  MessageSquare,
  MoreVertical,
  Pill,
  Star,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Eye,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDoctorQueue } from "../services/api";
import PatientHistoryModal from "../components/doctor/PatientHistoryModal";
import doctorHero from "../assets/doctor-dashboard-hero-v2.png";
import styles from "./DoctorDashboard.module.css";

const quickActions = [
  { label: "View Appointments", icon: CalendarDays, tone: "mint", path: "/doctor/appointments" },
  { label: "Search Patient", icon: UserRound, tone: "blue", path: "/doctor/patients" },
  { label: "Live Teleconsults", icon: Video, tone: "rose", path: "/doctor/teleconsult" },
  { label: "Create Prescription", icon: Pill, tone: "lilac", path: "/doctor/patients" },
];

function patientDetails(item) {
  const patient = item.patient || {};
  const firstName = patient.firstName || item.patient_first_name || item.firstName || "Patient";
  const lastName = patient.lastName || item.patient_last_name || item.lastName || "";
  const scheduled = item.scheduledAt || item.scheduled_at;
  const apptType = item.appointmentType || item.appointment_type || item.callType || "in_person";
  const isVirtual = ["video", "teleconsultation", "virtual"].includes(apptType?.toLowerCase());
  return {
    id: item.appointmentId || item.id,
    patientId: patient.id || item.patient_id || item.patientId || item.userId,
    name: item.name || `${firstName} ${lastName}`.trim(),
    initials: `${firstName[0] || "P"}${lastName[0] || ""}`,
    time: scheduled ? new Date(scheduled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    reason: item.reason || item.chiefComplaint || item.intake?.chiefComplaint || "General consultation",
    age: item.age || "—",
    gender: item.gender || patient.gender || "",
    status: item.appointmentStatus || item.status || "scheduled",
    isVirtual,
    appointmentType: apptType,
  };
}

function createCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevious = new Date(year, month, 0).getDate();
  return Array.from({ length: 35 }, (_, index) => {
    if (index < firstDay) return { day: daysInPrevious - firstDay + index + 1, outside: true };
    const day = index - firstDay + 1;
    if (day > daysInMonth) return { day: day - daysInMonth, outside: true };
    return { day, outside: false };
  });
}

export default function DoctorDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState(null);

  const loadQueue = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchDoctorQueue(token);
      setQueue(Array.isArray(response?.queue) ? response.queue : []);
    } catch (error) {
      console.error("Failed to fetch doctor queue:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const patients = useMemo(() => queue.map(patientDetails), [queue]);
  const completedCount = patients.filter((patient) => patient.status === "completed").length;
  const pendingCount = patients.filter((patient) => !["completed", "cancelled"].includes(patient.status)).length;
  const priorityCount = queue.filter((item) => item.redFlags?.length || item.intake?.redFlags?.length).length;
  const calendarDays = createCalendar(calendarDate);
  const today = new Date();
  const doctorName = user?.lastName || user?.firstName || "Doctor";

  const metrics = [
    { value: patients.length, label: "Today's Appointments", icon: CalendarDays, tone: "mint", note: pendingCount ? `${pendingCount} remaining` : "All clear" },
    { value: new Set(patients.map((patient) => patient.name)).size, label: "Patients Today", icon: Users, tone: "blue", note: "In your care list" },
    { value: priorityCount, label: "Priority Reviews", icon: FileText, tone: "sand", note: priorityCount ? "Needs attention" : "No urgent flags" },
    { value: 0, label: "Unread Messages", icon: MessageSquare, tone: "rose", note: "Inbox is clear" },
  ];

  const changeMonth = (difference) => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + difference, 1));

  if (loading) return <div className={styles.loading}><div /><div /></div>;

  return (
    <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.layout}>
        <section className={styles.mainColumn}>
          <header className={styles.hero}>
            <img src={doctorHero} alt="Doctor reviewing a digital care plan" />
            <div className={styles.heroCopy}><span>Doctor portal</span><h1>Good Morning, Dr. {doctorName}</h1><p>Here’s what’s happening with your practice today.</p></div>
            <blockquote>“Compassion today,<br />healthier tomorrows.”</blockquote>
          </header>

          <section className={styles.metrics}>
            {metrics.map(({ value, label, icon: Icon, tone, note }) => (
              <article key={label}><span className={styles[tone]}><Icon /></span><small>{note}</small><strong>{value}</strong><p>{label}</p></article>
            ))}
          </section>

          <section className={styles.quickPanel}>
            <h2>Quick Actions</h2>
            <div>{quickActions.map(({ label, icon: Icon, tone, path }) => <button key={label} className={styles[tone]} onClick={() => navigate(path)}><Icon /><span>{label}</span><ArrowRight /></button>)}</div>
          </section>

          <div className={styles.lowerGrid}>
            <section className={styles.card}>
              <header><div><h2>Today’s Schedule</h2><p>Your appointments for today</p></div><button onClick={() => navigate("/doctor/appointments")}>View All <ArrowRight /></button></header>
              <div className={styles.scheduleList}>
                {patients.length ? patients.slice(0, 6).map((patient, index) => (
                  <div
                    key={patient.id || index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: "1px solid #f1f5f9",
                      background: "#ffffff",
                      gap: "12px",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, cursor: patient.patientId ? "pointer" : "default" }}
                      onClick={() => {
                        if (patient.patientId) {
                          setSelectedPatientForHistory({ patientId: patient.patientId, patientName: patient.name });
                        }
                      }}
                    >
                      <time style={{ fontSize: "12px", fontWeight: "700", color: "#0d9488", minWidth: "60px" }}>{patient.time}</time>
                      <span className={styles.patientAvatar}>{patient.initials}</span>
                      <span className={styles.patientIdentity}>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{patient.name}</strong>
                        <small>{patient.age}{patient.gender ? ` · ${patient.gender}` : ""}</small>
                      </span>
                      <span className={styles.reason} style={{ flex: 1 }}>{patient.reason}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {patient.isVirtual && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "700", background: "#f3e8ff", color: "#7e22ce", padding: "3px 8px", borderRadius: "6px" }}>
                          <Video size={12} /> Teleconsult
                        </span>
                      )}
                      <span className={`${styles.status} ${styles[patient.status]}`}>{patient.status.replaceAll("_", " ")}</span>
                      
                      {patient.patientId && (
                        <button
                          type="button"
                          onClick={() => setSelectedPatientForHistory({ patientId: patient.patientId, patientName: patient.name })}
                          title="View Patient Medical History & Clinical Triage"
                          style={{
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            color: "#166534",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <Eye size={13} /> Records
                        </button>
                      )}

                      {patient.isVirtual && (
                        <button
                          type="button"
                          onClick={() => navigate("/doctor/teleconsult")}
                          title="Join Live Teleconsultation Room"
                          style={{
                            background: "#0284c7",
                            border: "none",
                            color: "#ffffff",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <Video size={13} /> Call
                        </button>
                      )}
                    </div>
                  </div>
                )) : <div className={styles.empty}><CalendarDays /><strong>No appointments today</strong><span>New bookings will appear here automatically.</span></div>}
              </div>
            </section>

            <section className={styles.card}>
              <header><div><h2>Recent Patients</h2><p>Recently consulted patients</p></div><button onClick={() => navigate("/doctor/patients")}>View All <ArrowRight /></button></header>
              <div className={styles.recentList}>
                {patients.length ? patients.slice(0, 5).map((patient, index) => (
                  <div
                    key={patient.id || index}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", border: "1px solid #f1f5f9" }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: patient.patientId ? "pointer" : "default" }}
                      onClick={() => {
                        if (patient.patientId) {
                          setSelectedPatientForHistory({ patientId: patient.patientId, patientName: patient.name });
                        }
                      }}
                    >
                      <span className={styles.patientAvatar}>{patient.initials}</span>
                      <span>
                        <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{patient.name}</strong>
                        <small style={{ color: "#64748b" }}>{patient.reason} · {patient.time}</small>
                      </span>
                    </div>
                    {patient.patientId && (
                      <button
                        type="button"
                        onClick={() => setSelectedPatientForHistory({ patientId: patient.patientId, patientName: patient.name })}
                        title="View Patient History"
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px"
                        }}
                      >
                        <Eye size={12} /> View History
                      </button>
                    )}
                  </div>
                )) : <div className={styles.empty}><UserRound /><strong>No recent patients</strong><span>Your consultation history will appear here.</span></div>}
              </div>
            </section>
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={`${styles.card} ${styles.calendarCard}`}>
            <header><h2>Your Schedule</h2><button onClick={() => navigate("/doctor/appointments")}>View Appointments <ArrowRight /></button></header>
            <div className={styles.calendar}>
              <div className={styles.calendarHead}><strong>{calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong><div><button onClick={() => changeMonth(-1)}><ChevronLeft /></button><button onClick={() => changeMonth(1)}><ChevronRight /></button></div></div>
              <div className={styles.week}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
              <div className={styles.days}>{calendarDays.map(({ day, outside }, index) => <button key={`${day}-${index}`} className={`${outside ? styles.outside : ""} ${!outside && day === today.getDate() && calendarDate.getMonth() === today.getMonth() && calendarDate.getFullYear() === today.getFullYear() ? styles.today : ""}`}>{day}</button>)}</div>
            </div>
            <div className={styles.miniSchedule}>{patients.slice(0, 3).map((patient, index) => <button key={patient.id || index} onClick={() => { if (patient.patientId) setSelectedPatientForHistory({ patientId: patient.patientId, patientName: patient.name }); }}><i className={styles[`dot${index + 1}`]} /><time>{patient.time}</time><span><strong>{patient.name}</strong><small>{patient.reason}</small></span><ChevronRight /></button>)}{!patients.length && <p>No scheduled appointments.</p>}</div>
          </section>

          <section className={`${styles.card} ${styles.practiceCard}`}>
            <header><h2>Practice Overview</h2><select aria-label="Practice overview period"><option>This Week</option><option>This Month</option></select></header>
            <div><article><strong>{completedCount}</strong><span>Consultations</span><TrendingUp /></article><article><strong>{patients.length}</strong><span>New Patients</span><Users /></article><article><strong>{Math.max(completedCount, 0)}</strong><span>Prescriptions</span><FileText /></article><article><strong>4.8</strong><span>Patient Rating</span><Star /></article></div>
          </section>

          <section className={styles.encouragement}><span><CalendarDays /></span><div><strong>Keep Making a Difference</strong><small>Your care changes lives.</small></div></section>
        </aside>
      </div>

      {/* Patient Unified Medical History & AI Triage Modal */}
      {selectedPatientForHistory && (
        <PatientHistoryModal
          patientId={selectedPatientForHistory.patientId}
          patientName={selectedPatientForHistory.patientName}
          onClose={() => setSelectedPatientForHistory(null)}
        />
      )}
    </motion.main>
  );
}
