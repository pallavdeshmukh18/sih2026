import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, MapPin, MoreHorizontal, Plus, Search, Stethoscope, UserRound, Trash2, X, Info, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getPatientAppointments, cancelAppointment } from "../../services/api";
import { formatDoctorName, translateClinicalTerm } from "../../utils/transliterate";
import heroImage from "../../assets/schedule-hero.png";
import ClinicalSummaryCard from "../../components/common/ClinicalSummaryCard";
import styles from "./Appointments.module.css";

const fallbackAppointments = [
  { id: "sample-1", scheduled_at: "2026-10-15T10:00:00", doctor_first_name: "Sarah", doctor_last_name: "Jenkins", specialization: "Cardiology", appointment_type: "in_person", location: "MediKiosk Clinic, Mumbai", status: "scheduled" },
  { id: "sample-2", scheduled_at: "2026-10-22T14:30:00", doctor_first_name: "Robert", doctor_last_name: "Miles", specialization: "Dental consultation", appointment_type: "teleconsultation", location: "Apollo Hospitals, Navi Mumbai", status: "confirmed" },
  { id: "sample-3", scheduled_at: "2026-09-05T11:15:00", doctor_first_name: "Emily", doctor_last_name: "Chen", specialization: "General consultation", appointment_type: "in_person", location: "MediKiosk Clinic, Mumbai", status: "completed" },
  { id: "sample-4", scheduled_at: "2026-08-12T09:00:00", doctor_first_name: "Sarah", doctor_last_name: "Jenkins", specialization: "Cardiology follow-up", appointment_type: "in_person", location: "MediKiosk Clinic, Mumbai", status: "completed" },
];
const upcomingStatuses = new Set(["scheduled", "confirmed", "upcoming"]);
const getApptDate = (app) => {
  const val = app?.scheduledAt || app?.scheduled_at;
  const date = val ? new Date(val) : new Date();
  return isNaN(date.getTime()) ? new Date() : date;
};
const dateKey = (value) => {
  const raw = typeof value === "object" ? (value?.scheduledAt || value?.scheduled_at) : value;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? "invalid" : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
const doctorName = (appointment, lang = "en") => {
  if (!appointment) return "Doctor";
  const doc = appointment.doctor || {};
  const fn = doc.firstName || appointment.doctor_first_name || appointment.doctorFirstName || "Doctor";
  const ln = doc.lastName || appointment.doctor_last_name || appointment.doctorLastName || "";
  return formatDoctorName({ firstName: fn, lastName: ln }, lang);
};

const buildMiniCalendar = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + days) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
};

export default function Appointments() {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 15));

  const formatStatus = (status) => {
    const s = status?.toLowerCase();
    if (upcomingStatuses.has(s)) return t("appointments.upcoming", "Upcoming");
    if (s === "completed") return t("appointments.completed", "Completed");
    if (s === "cancelled") return t("appointments.statusCancelled", "Cancelled");
    return status ? status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : t("appointments.upcoming", "Upcoming");
  };

  const [selectedApptModal, setSelectedApptModal] = useState(null);

  const fetchAppointmentsData = () => {
    if (!token) return;
    getPatientAppointments(token).then((response) => {
      if (!response.success || !Array.isArray(response.appointments)) return;
      setAppointments(response.appointments);
      const firstUpcoming = response.appointments.find((item) => upcomingStatuses.has(item.status?.toLowerCase())) || response.appointments[0];
      if (firstUpcoming) { const date = getApptDate(firstUpcoming); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedDate(date); }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchAppointmentsData();
  }, [token]);

  const handleCancelAppointment = async (e, apptId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(apptId, token);
      toast.success("Appointment cancelled successfully.");
      setSelectedApptModal(null);
      fetchAppointmentsData();
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment.");
    }
  };

  const records = appointments.length ? appointments : fallbackAppointments;
  const upcoming = records.filter((item) => upcomingStatuses.has(item.status?.toLowerCase()));
  const completed = records.filter((item) => item.status?.toLowerCase() === "completed");
  const thisWeek = upcoming.filter((item) => Math.abs(getApptDate(item) - new Date()) <= 7 * 86400000);
  const specialists = new Set(records.map((item) => item.doctorId || item.doctor_id || doctorName(item))).size;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const now = new Date();
    return records.filter((item) => {
      const status = item.status?.toLowerCase();
      if (filter === "upcoming" && !upcomingStatuses.has(status)) return false;
      if (filter !== "all" && filter !== "upcoming" && status !== filter) return false;
      if (range !== "all") { const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - Number(range)); if (getApptDate(item) < cutoff) return false; }
      return !term || [doctorName(item), item.doctor?.specialization || item.specialization, item.doctor?.department || item.department, item.location].some((value) => value?.toLowerCase().includes(term));
    });
  }, [filter, query, range, records]);
  const miniDays = useMemo(() => buildMiniCalendar(month), [month]);
  const selectedCount = records.filter((item) => dateKey(item.scheduled_at) === dateKey(selectedDate)).length;
  const eventDates = new Set(records.map((item) => dateKey(item.scheduled_at)));

  const stats = [
    { label: t("appointments.upcoming", "Upcoming visits"), value: upcoming.length, icon: CalendarDays, tone: "green" },
    { label: t("appointments.upcoming", "Upcoming this week"), value: thisWeek.length, icon: Clock3, tone: "blue" },
    { label: t("appointments.completed", "Completed visits"), value: completed.length, icon: CheckCircle2, tone: "gold" },
    { label: t("appointments.specialists", "Care specialists"), value: specialists, icon: Stethoscope, tone: "purple" },
  ];

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <header className={styles.hero}>
      <img src={heroImage} alt="Healthcare appointment calendar" />
      <div className={styles.heroCopy}>
        <span>{t("navigation.appointments", "YOUR CARE PLAN")}</span>
        <h1>{t("appointments.title", "Your Appointments")}</h1>
        <p>{t("appointments.subtitle", "View and manage your upcoming and past consultations.")}</p>
      </div>
      <button onClick={() => navigate("/patient/doctor")}><Plus /> {t("appointments.bookNew", "Book Appointment")}</button>
    </header>
    <div className={styles.layout}>
      <section className={styles.mainColumn}>
        <div className={styles.stats}>{stats.map(({ label, value, icon: Icon, tone }) => <article className={styles[tone]} key={label}><span><Icon /></span><div><strong>{value}</strong><p>{label}</p></div><ArrowRight /></article>)}</div>
        <div className={styles.controls}>
          <nav>
            {[
              ["all", t("appointments.tabAll", "All Appointments")],
              ["upcoming", t("appointments.tabUpcoming", "Upcoming")],
              ["completed", t("appointments.tabCompleted", "Completed")],
              ["cancelled", t("appointments.statusCancelled", "Cancelled")]
            ].map(([id, label]) => <button key={id} className={filter === id ? styles.active : ""} onClick={() => setFilter(id)}>{label}</button>)}
          </nav>
          <label className={styles.search}>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("appointments.searchPlaceholder", "Search appointments by doctor, specialty, or location...")} />
          </label>
          <label className={styles.range}>
            <CalendarDays />
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="all">{t("appointments.rangeAll", "All time")}</option>
              <option value="6">{t("appointments.range30Days", "Last 6 months")}</option>
              <option value="12">{t("appointments.range90Days", "Last year")}</option>
            </select>
            <ChevronDown />
          </label>
        </div>
        <section className={styles.history}>
          <header>
            <div>
              <h2>{t("appointments.title", "Your Appointment History")}</h2>
              <p>{filtered.length} {t("navigation.appointments", "appointments shown")}</p>
            </div>
          </header>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t("appointments.doctor", "Doctor")}</th>
                  <th>{t("appointments.date", "Date & Time")}</th>
                  <th>{t("doctors.consultationType", "Visit Type")}</th>
                  <th>{t("appointments.location", t("doctors.location", "Location"))}</th>
                  <th>{t("appointments.status", "Status")}</th>
                  <th>{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((appointment) => {
                  const date = getApptDate(appointment);
                  const status = formatStatus(appointment.status);
                  const isUpcoming = upcomingStatuses.has(appointment.status?.toLowerCase());

                  return (
                    <motion.tr layout key={appointment.id} onClick={() => setSelectedApptModal(appointment)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className={styles.doctor}>
                          <span>{(appointment.doctor?.firstName || appointment.doctor_first_name || "D")[0]}{(appointment.doctor?.lastName || appointment.doctor_last_name || "R")[0]}</span>
                          <div>
                            <b>{doctorName(appointment, language)}</b>
                            <small>{translateClinicalTerm(appointment.doctor?.specialization || appointment.specialization, "specializations", language) || translateClinicalTerm(appointment.doctor?.department || appointment.department, "specializations", language) || t("dashboard.generalPhysician", "General consultation")}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.withIcon}>
                          <CalendarDays />
                          <span>
                            {date.toLocaleDateString(language || "en", { day: "2-digit", month: "short", year: "numeric" })}
                            <small>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.withIcon}>
                          <Stethoscope />
                          <span>{(appointment.appointmentType || appointment.appointment_type) === "teleconsultation" ? t("appointments.teleconsultation", "Virtual") : t("appointments.inPerson", "In-person")}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.withIcon}>
                          <MapPin />
                          <span>{translateClinicalTerm(appointment.location, "locations", language) || t("dashboard.clinicDefault", "MediKiosk Clinic")}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[appointment.status?.toLowerCase() || 'upcoming']}`}>{status}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedApptModal(appointment)}
                            style={{
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              color: "#0f766e",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              whiteSpace: "nowrap"
                            }}
                          >
                            <Eye size={12} /> Details
                          </button>
                          {isUpcoming && (
                            <button
                              type="button"
                              onClick={(e) => handleCancelAppointment(e, appointment.id)}
                              style={{
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#ef4444",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                whiteSpace: "nowrap"
                              }}
                              title="Cancel Appointment"
                            >
                              <Trash2 size={12} /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className={styles.empty}>{t("appointments.noAppointments", "No appointments match your selected filters.")}</div>}
          </div>
        </section>
      </section>

      {/* Appointment Details Modal */}
      {selectedApptModal && (
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
        }} onClick={() => setSelectedApptModal(null)}>
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
              <button onClick={() => setSelectedApptModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            {(() => {
              const d = getApptDate(selectedApptModal);
              const docName = doctorName(selectedApptModal, language);
              const spec = selectedApptModal.doctor?.specialization || selectedApptModal.specialization || "General Medicine";

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "12px", padding: "16px" }}>
                    <strong style={{ fontSize: "16px", color: "#0d9488", display: "block" }}>{docName}</strong>
                    <span style={{ fontSize: "13px", color: "#475569" }}>{spec}</span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#334155", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>📅 <strong>Scheduled Date:</strong> {!isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "full" }) : "TBD"}</div>
                    <div>⏰ <strong>Time Slot:</strong> {!isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}</div>
                    <div>🏥 <strong>Location:</strong> {selectedApptModal.location || "MediKiosk Clinic, Mumbai"}</div>
                    <div>🩺 <strong>Consultation Type:</strong> {(selectedApptModal.appointmentType || selectedApptModal.appointment_type) === "teleconsultation" ? "Video Call (Teleconsultation)" : "In-Person Visit"}</div>
                    <div>📌 <strong>Reason / Complaint:</strong> {selectedApptModal.reason || "General Medical Checkup"}</div>
                    {selectedApptModal.notes && (
                      <div style={{ marginTop: "8px" }}>
                        <strong style={{ fontSize: "13px", color: "#334155", display: "block", marginBottom: "6px" }}>📝 Clinical Notes & AI Intake Summary:</strong>
                        <ClinicalSummaryCard
                          summary={selectedApptModal.notes}
                          chiefComplaint={selectedApptModal.reason}
                          createdAt={selectedApptModal.createdAt || selectedApptModal.scheduledAt}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                    {upcomingStatuses.has(selectedApptModal.status?.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={(e) => handleCancelAppointment(e, selectedApptModal.id)}
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
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedApptModal(null)}
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

      <aside className={styles.sideColumn}>
        <section className={styles.miniCalendar}>
          <header>
            <h2>{month.toLocaleString(language || "en", { month: "long", year: "numeric" })}</h2>
            <div>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
            </div>
          </header>
          <div className={styles.week}>
            {[
              t("schedule.sun", "Sun"),
              t("schedule.mon", "Mon"),
              t("schedule.tue", "Tue"),
              t("schedule.wed", "Wed"),
              t("schedule.thu", "Thu"),
              t("schedule.fri", "Fri"),
              t("schedule.sat", "Sat")
            ].map((day, index) => <span key={index}>{day}</span>)}
          </div>
          <div className={styles.monthDays}>
            {miniDays.map((date) => {
              const current = date.getMonth() === month.getMonth();
              const selected = dateKey(date) === dateKey(selectedDate);
              return (
                <button
                  key={date.toISOString()}
                  className={`${!current ? styles.outside : ""} ${selected ? styles.selected : ""} ${eventDates.has(dateKey(date)) ? styles.hasEvent : ""}`}
                  onClick={() => setSelectedDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </section>
        <button className={styles.daySummary} onClick={() => navigate("/patient/schedule")}>
          <span><Clock3 /></span>
          <div>
            <b>{selectedDate.toLocaleDateString(language || "en", { day: "numeric", month: "long", year: "numeric" })}</b>
            <small>{selectedCount} {t("navigation.appointments", "scheduled appointments")}.</small>
          </div>
          <ArrowRight />
        </button>
        <section className={styles.quick}>
          <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
          <div>
            <button onClick={() => navigate("/patient/doctor")}><span><CalendarDays /></span>{t("appointments.bookNew", "Book Appointment")}</button>
            <button onClick={() => navigate("/patient/doctor")}><span><UserRound /></span>{t("doctors.pageTitle", "Find Doctors")}</button>
            <button onClick={() => navigate("/patient/history")}><span><FileText /></span>{t("history.timeline", "View Records")}</button>
            <button onClick={() => navigate("/patient/schedule")}><span><Bell /></span>{t("schedule.addReminder", "Set Reminder")}</button>
          </div>
        </section>
        <section className={styles.journey}><blockquote>{t("schedule.journeyQuote", "Stay on top of your health journey.")}</blockquote><Stethoscope /></section>
      </aside>
    </div>
  </motion.main>;
}
