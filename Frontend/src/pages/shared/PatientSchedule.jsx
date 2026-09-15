import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, MapPin, PlusCircle, Stethoscope, Users, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getPatientAppointments } from "../../services/api";
import { formatDoctorName, translateClinicalTerm } from "../../utils/transliterate";
import heroImage from "../../assets/schedule-hero.png";
import styles from "./PatientSchedule.module.css";

const fallbackAppointments = [
  { id: "sample-1", scheduled_at: "2026-10-15T10:00:00", doctor_first_name: "Sarah", doctor_last_name: "Jenkins", specialization: "Cardiology", appointment_type: "in_person", location: "MediKiosk Clinic, Mumbai" },
  { id: "sample-2", scheduled_at: "2026-10-22T14:30:00", doctor_first_name: "Robert", doctor_last_name: "Miles", specialization: "Dental consultation", appointment_type: "teleconsultation", location: "Apollo Hospitals, Navi Mumbai" },
];

const getApptDate = (app) => {
  const val = app?.scheduled_at || app?.scheduledAt;
  const d = val ? new Date(val) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};

const isTeleconsult = (app) => ["video", "teleconsultation", "virtual"].includes((app?.appointmentType || app?.appointment_type)?.toLowerCase());

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
  const { t, language } = useLanguage();
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
      const firstUpcoming = [...response.appointments].sort((a, b) => getApptDate(a) - getApptDate(b))[0];
      if (firstUpcoming) {
        const date = getApptDate(firstUpcoming);
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
      const d = getApptDate(appointment);
      const key = dateKey(d);
      const tele = isTeleconsult(appointment);
      (grouped[key] ||= []).push({
        ...appointment,
        scheduled_at: appointment.scheduled_at || appointment.scheduledAt,
        doctor_first_name: appointment.doctor?.firstName || appointment.doctor_first_name || appointment.doctorFirstName || "Doctor",
        doctor_last_name: appointment.doctor?.lastName || appointment.doctor_last_name || appointment.doctorLastName || "",
        specialization: appointment.doctor?.specialization || appointment.specialization || "General consultation",
        location: appointment.location || "MediKiosk Clinic, Mumbai",
        kind: "appointment",
        isTeleconsult: tele
      });
    });
    reminders.forEach((reminder) => {
      const key = dateKey(new Date(reminder.scheduled_at));
      (grouped[key] ||= []).push({ ...reminder, kind: "reminder" });
    });
    return grouped;
  }, [displayedAppointments, reminders]);

  const selectedEvents = eventsByDate[dateKey(selectedDate)] || [];
  const upcoming = useMemo(() => {
    return [...displayedAppointments]
      .map(app => ({
        ...app,
        scheduled_at: app.scheduled_at || app.scheduledAt,
        doctor_first_name: app.doctor?.firstName || app.doctor_first_name || app.doctorFirstName || "Doctor",
        doctor_last_name: app.doctor?.lastName || app.doctor_last_name || app.doctorLastName || "",
        specialization: app.doctor?.specialization || app.specialization || "General consultation",
        location: app.location || "MediKiosk Clinic, Mumbai",
        isTeleconsult: isTeleconsult(app)
      }))
      .sort((a, b) => getApptDate(a) - getApptDate(b))
      .slice(0, 4);
  }, [displayedAppointments]);

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
    toast.success(t("schedule.reminderAdded", "Reminder added to your schedule."));
  };

  const weekDays = [
    { key: "sun", label: t("schedule.sun", "Sun") },
    { key: "mon", label: t("schedule.mon", "Mon") },
    { key: "tue", label: t("schedule.tue", "Tue") },
    { key: "wed", label: t("schedule.wed", "Wed") },
    { key: "thu", label: t("schedule.thu", "Thu") },
    { key: "fri", label: t("schedule.fri", "Fri") },
    { key: "sat", label: t("schedule.sat", "Sat") },
  ];

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <header className={styles.hero}>
      <img src={heroImage} alt="Care calendar with clock and reminder bell" />
      <div className={styles.heroCopy}>
        <span>{t("navigation.schedule", "CARE CALENDAR")}</span>
        <h1>{t("schedule.pageTitle", "Your Care Schedule")}</h1>
        <p>{t("schedule.pageSub", "Track scheduled visits, medication reminders, and health checkups on an interactive calendar.")}</p>
      </div>
      <button onClick={openReminder}><PlusCircle /> {t("schedule.addReminder", "Add Care Reminder")}</button>
    </header>

    <div className={styles.scheduleLayout}>
      <section className={styles.calendarCard}>
        <header>
          <div>
            <h2>{month.toLocaleString(language || "en", { month: "long", year: "numeric" })}</h2>
            <p>{t("schedule.pageSub", "Track scheduled visits, medication reminders, and health checkups on an interactive calendar.")}</p>
          </div>
          <nav>
            <button onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
            <button onClick={goToday}>{t("schedule.today", "Today")}</button>
            <button onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></button>
          </nav>
        </header>
        <div className={styles.calendar}>
          <div className={styles.week}>
            {weekDays.map(({ key, label }) => <span key={key}>{label}</span>)}
          </div>
          <div className={styles.days}>
            {calendarDays.map(({ date, current }) => {
              const dayEvents = eventsByDate[dateKey(date)] || [];
              const selected = dateKey(date) === dateKey(selectedDate);
              return (
                <button
                  key={date.toISOString()}
                  className={`${!current ? styles.outside : ""} ${selected ? styles.selected : ""} ${dayEvents.length ? styles.hasEvent : ""}`}
                  onClick={() => { setSelectedDate(date); if (!current) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}
                >
                  <span>{date.getDate()}</span>
                  {dayEvents.slice(0, 2).map((entry) => (
                    <small className={entry.kind === "reminder" ? styles.reminderEvent : entry.isTeleconsult ? styles.teleconsultEvent : ""} key={entry.id}>
                      {entry.kind === "reminder"
                        ? entry.title
                        : entry.isTeleconsult
                          ? `📹 ${translateClinicalTerm(entry.specialization, "specializations", language) || "Teleconsult"}`
                          : translateClinicalTerm(entry.specialization, "specializations", language) || t("appointments.inPerson", "Appointment")}
                      <i>{formatTime(entry.scheduled_at)}</i>
                    </small>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className={styles.sideColumn}>
        <section className={styles.selectedDay}>
          <span><CalendarDays /></span>
          <div style={{ width: "100%" }}>
            <h2>{selectedDate.toLocaleDateString(language || "en", { day: "numeric", month: "long", year: "numeric" })}</h2>
            <p>{selectedEvents.length ? `${selectedEvents.length} ${t("schedule.eventsScheduled", "scheduled care events")}.` : t("schedule.noConsultationsDay", "No appointments scheduled for this day.")}</p>
            {selectedEvents.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {selectedEvents.map(evt => (
                  <div key={evt.id} style={{ fontSize: "11px", background: "rgba(255,255,255,0.7)", padding: "6px 8px", borderRadius: "6px" }}>
                    <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{evt.kind === "reminder" ? `🔔 ${evt.title}` : formatDoctorName({ firstName: evt.doctor_first_name, lastName: evt.doctor_last_name }, language)}</span>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>{formatTime(evt.scheduled_at)}</span>
                    </div>
                    {evt.isTeleconsult && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/patient/teleconsult${evt.id ? `?appointmentId=${evt.id}` : ''}`); }}
                        className={styles.joinCallBtn}
                      >
                        <Video size={11} /> Join Video Call
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className={styles.upcoming}>
          <header>
            <h2>{t("schedule.upcomingTitle", "Scheduled Consultations")}</h2>
            <button onClick={() => navigate("/patient/appointments")}>{t("dashboard.viewAll", "View All")} <ArrowRight /></button>
          </header>
          {upcoming.map((appointment) => {
            const date = getApptDate(appointment);
            return (
              <div
                className={styles.appointment}
                key={appointment.id}
                style={{ cursor: "pointer" }}
                onClick={() => { setSelectedDate(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}
              >
                <time>
                  <strong>{date.getDate()}</strong>
                  <small>{date.toLocaleString(language || "en", { month: "short" })}</small>
                </time>
                <span>
                  <b>{formatDoctorName({ firstName: appointment.doctor_first_name, lastName: appointment.doctor_last_name }, language)}</b>
                  <small>{translateClinicalTerm(appointment.specialization, "specializations", language) || t("dashboard.generalPhysician", "General consultation")}</small>
                  {appointment.isTeleconsult ? (
                    <div style={{ marginTop: "4px" }}>
                      <span className={styles.teleconsultBadge}><Video size={10} /> Video Consultation</span>
                    </div>
                  ) : (
                    <em><MapPin />{translateClinicalTerm(appointment.location, "locations", language) || t("dashboard.clinicDefault", "MediKiosk Clinic")}</em>
                  )}
                </span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <i><Clock3 />{formatTime(appointment.scheduled_at)}</i>
                  {appointment.isTeleconsult && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/patient/teleconsult${appointment.id ? `?appointmentId=${appointment.id}` : ''}`); }}
                      className={styles.joinCallBtn}
                    >
                      <Video size={11} /> Join
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
        <section className={styles.quickActions}>
          <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
          <div>
            <button onClick={() => navigate("/patient/doctor")}><span><CalendarDays /></span>{t("appointments.bookNew", "Book Appointment")}</button>
            <button onClick={openReminder}><span><Bell /></span>{t("schedule.addReminder", "Add Reminder")}</button>
            <button onClick={() => navigate("/patient/doctor")}><span><Users /></span>{t("doctors.pageTitle", "Find Doctors")}</button>
            <button onClick={() => navigate("/patient/history")}><span><FileText /></span>{t("history.timeline", "View Records")}</button>
          </div>
        </section>
        <section className={styles.journey}><Stethoscope /><blockquote>{t("schedule.journeyQuote", "Stay on top of your health journey.")}</blockquote></section>
      </aside>
    </div>

    <AnimatePresence>
      {showReminder && (
        <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReminder(false)}>
          <motion.section className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>{t("schedule.careReminderBadge", "CARE REMINDER")}</span>
                <h2>{t("schedule.addToSchedule", "Add to your schedule")}</h2>
              </div>
              <button onClick={() => setShowReminder(false)}><X /></button>
            </header>
            <form onSubmit={addReminder}>
              <label>
                {t("schedule.reminderTitle", "Reminder title")}
                <input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder={t("schedule.reminderTitlePlaceholder", "e.g. Take medication")} required />
              </label>
              <label>
                {t("schedule.reminderDate", "Date and time")}
                <input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} required />
              </label>
              <button><Bell /> {t("schedule.saveReminder", "Save Reminder")}</button>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.main>;
}

