import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, MapPin, PlusCircle, Stethoscope, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { getPatientAppointments } from "../../services/api";
import heroImage from "../../assets/schedule-hero.png";
import styles from "./PatientSchedule.module.css";

const fallbackAppointments = [
  { id: "sample-1", scheduled_at: "2026-10-15T10:00:00", doctor_first_name: "Sarah", doctor_last_name: "Jenkins", specialization: "Cardiology", location: "MediKiosk Clinic, Mumbai" },
  { id: "sample-2", scheduled_at: "2026-10-22T14:30:00", doctor_first_name: "Robert", doctor_last_name: "Miles", specialization: "Dental consultation", location: "Apollo Hospitals, Navi Mumbai" },
];
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sameMonth = (left, right) => left.getMonth() === right.getMonth() && left.getFullYear() === right.getFullYear();
const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const buildCalendar = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1);
    return { date, current: sameMonth(date, month) };
  });
};

export default function PatientSchedule() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 15));
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderAt, setReminderAt] = useState("");

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    getPatientAppointments(token).then((response) => {
      if (!active || !response.success || !Array.isArray(response.appointments)) return;
      setAppointments(response.appointments);
      const firstUpcoming = [...response.appointments].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
      if (firstUpcoming) {
        const date = new Date(firstUpcoming.scheduled_at);
        setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setSelectedDate(date);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  const displayedAppointments = appointments.length ? appointments : fallbackAppointments;
  const calendarDays = useMemo(() => buildCalendar(month), [month]);
  const eventsByDate = useMemo(() => {
    const grouped = {};
    displayedAppointments.forEach((appointment) => {
      const key = dateKey(new Date(appointment.scheduled_at));
      (grouped[key] ||= []).push({ ...appointment, kind: "appointment" });
    });
    reminders.forEach((reminder) => {
      const key = dateKey(new Date(reminder.scheduled_at));
      (grouped[key] ||= []).push({ ...reminder, kind: "reminder" });
    });
    return grouped;
  }, [displayedAppointments, reminders]);
  const selectedEvents = eventsByDate[dateKey(selectedDate)] || [];
  const upcoming = useMemo(() => [...displayedAppointments].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).slice(0, 3), [displayedAppointments]);

  const changeMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const goToday = () => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };
  const openReminder = () => {
    const local = new Date(selectedDate);
    local.setHours(9, 0, 0, 0);
    setReminderAt(new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setReminderTitle("");
    setShowReminder(true);
  };
  const addReminder = (event) => {
    event.preventDefault();
    setReminders((current) => [...current, { id: `reminder-${Date.now()}`, scheduled_at: reminderAt, specialization: reminderTitle, title: reminderTitle }]);
    const date = new Date(reminderAt);
    setSelectedDate(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setShowReminder(false);
    toast.success("Reminder added to your schedule.");
  };

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <header className={styles.hero}><img src={heroImage} alt="Care calendar with clock and reminder bell" /><div className={styles.heroCopy}><span>CARE CALENDAR</span><h1>Your Schedule</h1><p>Keep track of your appointments, reminders, and follow-ups.</p></div><blockquote>“Small<br />Details.<br /><b>Bigger Care.</b>”</blockquote><button onClick={openReminder}><PlusCircle /> Add Reminder</button></header>

    <div className={styles.scheduleLayout}>
      <section className={styles.calendarCard}>
        <header><div><h2>{month.toLocaleString("en", { month: "long", year: "numeric" })}</h2><p>Select a date to view your scheduled care.</p></div><nav><button onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></button><button onClick={goToday}>Today</button><button onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></button></nav></header>
        <div className={styles.calendar}><div className={styles.week}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className={styles.days}>{calendarDays.map(({ date, current }) => {
          const dayEvents = eventsByDate[dateKey(date)] || [];
          const selected = dateKey(date) === dateKey(selectedDate);
          return <button key={date.toISOString()} className={`${!current ? styles.outside : ""} ${selected ? styles.selected : ""} ${dayEvents.length ? styles.hasEvent : ""}`} onClick={() => { setSelectedDate(date); if (!current) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}><span>{date.getDate()}</span>{dayEvents.slice(0, 2).map((entry) => <small className={entry.kind === "reminder" ? styles.reminderEvent : ""} key={entry.id}>{entry.kind === "reminder" ? entry.title : entry.specialization || "Appointment"}<i>{formatTime(entry.scheduled_at)}</i></small>)}</button>;
        })}</div></div>
      </section>

      <aside className={styles.sideColumn}>
        <section className={styles.selectedDay}><span><CalendarDays /></span><div><h2>{selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</h2><p>{selectedEvents.length ? `You have ${selectedEvents.length} scheduled care event${selectedEvents.length === 1 ? "" : "s"}.` : "No appointments scheduled for this day."}</p></div></section>
        <section className={styles.upcoming}><header><h2>Upcoming Appointments</h2><button onClick={() => navigate("/patient/appointments")}>View All <ArrowRight /></button></header>{upcoming.map((appointment) => { const date = new Date(appointment.scheduled_at); return <button className={styles.appointment} key={appointment.id} onClick={() => { setSelectedDate(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}><time><strong>{date.getDate()}</strong><small>{date.toLocaleString("en", { month: "short" })}</small></time><span><b>Dr. {appointment.doctor_first_name || "Care"} {appointment.doctor_last_name || "Provider"}</b><small>{appointment.specialization || "General consultation"}</small><em><MapPin />{appointment.location || "MediKiosk Clinic"}</em></span><i><Clock3 />{formatTime(appointment.scheduled_at)}</i></button>; })}</section>
        <section className={styles.quickActions}><h2>Quick Actions</h2><div><button onClick={() => navigate("/patient/doctor")}><span><CalendarDays /></span>Book Appointment</button><button onClick={openReminder}><span><Bell /></span>Add Reminder</button><button onClick={() => navigate("/patient/doctor")}><span><Users /></span>Find Doctors</button><button onClick={() => navigate("/patient/history")}><span><FileText /></span>View Records</button></div></section>
        <section className={styles.journey}><Stethoscope /><blockquote>Stay on top<br />of your health journey.</blockquote></section>
      </aside>
    </div>

    <AnimatePresence>{showReminder && <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReminder(false)}><motion.section className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}><header><div><span>CARE REMINDER</span><h2>Add to your schedule</h2></div><button onClick={() => setShowReminder(false)}><X /></button></header><form onSubmit={addReminder}><label>Reminder title<input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="e.g. Take medication" required /></label><label>Date and time<input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} required /></label><button><Bell /> Save Reminder</button></form></motion.section></motion.div>}</AnimatePresence>
  </motion.main>;
}
