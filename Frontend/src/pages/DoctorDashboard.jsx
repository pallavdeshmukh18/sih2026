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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDoctorQueue } from "../services/api";
import doctorHero from "../assets/doctor-dashboard-hero-v2.png";
import styles from "./DoctorDashboard.module.css";

const quickActions = [
  { label: "View Appointments", icon: CalendarDays, tone: "mint", path: "/doctor/appointments" },
  { label: "Search Patient", icon: UserRound, tone: "blue", path: "/doctor/patients" },
  { label: "Add Clinical Note", icon: ClipboardPlus, tone: "rose", path: "/doctor/patients" },
  { label: "Create Prescription", icon: Pill, tone: "lilac", path: "/doctor/patients" },
];

function patientDetails(item) {
  const patient = item.patient || {};
  const firstName = patient.firstName || item.patient_first_name || item.firstName || "Patient";
  const lastName = patient.lastName || item.patient_last_name || item.lastName || "";
  const scheduled = item.scheduledAt || item.scheduled_at;
  return {
    id: item.appointmentId || item.id,
    name: item.name || `${firstName} ${lastName}`.trim(),
    initials: `${firstName[0] || "P"}${lastName[0] || ""}`,
    time: scheduled ? new Date(scheduled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    reason: item.reason || item.chiefComplaint || item.intake?.chiefComplaint || "General consultation",
    age: item.age || "—",
    gender: item.gender || patient.gender || "",
    status: item.appointmentStatus || item.status || "scheduled",
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
                {patients.length ? patients.slice(0, 5).map((patient, index) => (
                  <button key={patient.id || index} onClick={() => navigate("/doctor/patients")}>
                    <time>{patient.time}</time><span className={styles.patientAvatar}>{patient.initials}</span><span className={styles.patientIdentity}><strong>{patient.name}</strong><small>{patient.age}{patient.gender ? ` · ${patient.gender}` : ""}</small></span><span className={styles.reason}>{patient.reason}</span><span className={`${styles.status} ${styles[patient.status]}`}>{patient.status.replaceAll("_", " ")}</span><MoreVertical />
                  </button>
                )) : <div className={styles.empty}><CalendarDays /><strong>No appointments today</strong><span>New bookings will appear here automatically.</span></div>}
              </div>
            </section>

            <section className={styles.card}>
              <header><div><h2>Recent Patients</h2><p>Recently consulted patients</p></div><button onClick={() => navigate("/doctor/patients")}>View All <ArrowRight /></button></header>
              <div className={styles.recentList}>
                {patients.length ? patients.slice(0, 5).map((patient, index) => <button key={patient.id || index} onClick={() => navigate("/doctor/patients")}><span className={styles.patientAvatar}>{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.reason} · {patient.time}</small></span><MoreVertical /></button>) : <div className={styles.empty}><UserRound /><strong>No recent patients</strong><span>Your consultation history will appear here.</span></div>}
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
            <div className={styles.miniSchedule}>{patients.slice(0, 3).map((patient, index) => <button key={patient.id || index}><i className={styles[`dot${index + 1}`]} /><time>{patient.time}</time><span><strong>{patient.name}</strong><small>{patient.reason}</small></span><ChevronRight /></button>)}{!patients.length && <p>No scheduled appointments.</p>}</div>
          </section>

          <section className={`${styles.card} ${styles.practiceCard}`}>
            <header><h2>Practice Overview</h2><select aria-label="Practice overview period"><option>This Week</option><option>This Month</option></select></header>
            <div><article><strong>{completedCount}</strong><span>Consultations</span><TrendingUp /></article><article><strong>{patients.length}</strong><span>New Patients</span><Users /></article><article><strong>{Math.max(completedCount, 0)}</strong><span>Prescriptions</span><FileText /></article><article><strong>4.8</strong><span>Patient Rating</span><Star /></article></div>
          </section>

          <section className={styles.encouragement}><span><CalendarDays /></span><div><strong>Keep Making a Difference</strong><small>Your care changes lives.</small></div></section>
        </aside>
      </div>
    </motion.main>
  );
}
