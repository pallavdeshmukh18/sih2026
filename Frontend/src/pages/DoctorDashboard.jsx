import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarDays, CheckCircle2, ChevronRight, Clock3, Search, Sparkles, Stethoscope, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDoctorQueue } from "../services/api";
import PatientQueue from "../components/doctor/PatientQueue";
import ClinicalSummary from "../components/doctor/ClinicalSummary";
import careIllustration from "../assets/indian-care-sidebar.png";
import styles from "./DoctorDashboard.module.css";

const calendarDays = ["31", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "1", "2", "3", "4"];

export default function DoctorDashboard() {
    const { user, token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [queue, setQueue] = useState([]);
    const [activePatient, setActivePatient] = useState(null);

    const loadQueue = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetchDoctorQueue(token);
            if (res && res.queue) {
                setQueue(res.queue);
                if (res.queue.length > 0) {
                    setActivePatient((prev) => {
                        if (!prev) return res.queue[0];
                        const found = res.queue.find(q => (q.appointmentId || q.id) === (prev.appointmentId || prev.id));
                        return found || res.queue[0];
                    });
                }
            }
        } catch (err) {
            console.error("Failed to fetch doctor queue:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    const waitingCount = queue.filter(a => a.appointmentStatus !== 'completed' && a.appointmentStatus !== 'cancelled').length;
    const completedCount = queue.filter(a => a.appointmentStatus === 'completed').length;
    const priorityCount = queue.filter(a => (a.intake?.redFlags && a.intake.redFlags.length > 0) || (a.redFlags && a.redFlags.length > 0)).length;
    const totalToday = queue.length;

    const workload = [
        { label: "Waiting", value: String(waitingCount).padStart(2, "0"), detail: `${priorityCount} priority`, icon: Users, tone: "sage" },
        { label: "Today", value: String(totalToday).padStart(2, "0"), detail: queue[0]?.scheduledAt ? `Next ${new Date(queue[0].scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "On schedule", icon: CalendarDays, tone: "blue" },
        { label: "Priority", value: String(priorityCount).padStart(2, "0"), unit: "cases", detail: priorityCount > 0 ? "Urgent review" : "Standard", icon: Clock3, tone: "amber" },
        { label: "Completed", value: String(completedCount).padStart(2, "0"), detail: totalToday > 0 ? `${Math.round((completedCount / totalToday) * 100)}% of list` : "0% of list", icon: CheckCircle2, tone: "purple" },
    ];

    if (isLoading) return <div className={styles.loading}><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /></div>;

    const doctorName = user?.lastName ? `Dr. ${user.lastName}` : `Dr. ${user?.firstName || "Doctor"}`;
    const todayFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

    return <motion.div className={styles.dashboard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
        <aside className={styles.storyPanel}>
            <div className={styles.storyCopy}><span>CARE, WITH CONTEXT</span><h2>Clinical care,<br />grounded in trust.</h2><p>A thoughtful workspace for focused, patient-first practice.</p></div>
            <img src={careIllustration} alt="Doctor consultation" />
            <div className={styles.storyBadge}><Stethoscope size={16} /><div><strong>Care rooted in trust</strong><small>Thoughtful, private and patient-first</small></div></div>
        </aside>

        <main className={styles.mainColumn}>
            <header className={styles.pageHeader}>
                <div><span className={styles.eyebrow}>{todayFormatted}</span><h1>Good morning, {doctorName}</h1><p>Here is your clinical overview for today.</p></div>
                <div className={styles.headerActions}><button aria-label="Search"><Search size={17} /></button><button aria-label="Clinical activity"><Activity size={17} /></button></div>
            </header>
            <section className={styles.brief}>
                <div className={styles.briefIcon}><Sparkles size={18} /></div>
                <div>
                    <span>CARE TEAM BRIEF</span>
                    <h2>{waitingCount > 0 ? `${waitingCount} patient${waitingCount > 1 ? 's are' : ' is'} ready for review.` : 'All patient consultations up to date.'}</h2>
                    <p>{priorityCount > 0 ? `${priorityCount} case${priorityCount > 1 ? 's have' : ' has'} clinical red flags requiring immediate evaluation.` : 'No critical red-flag alerts detected in current queue.'}</p>
                </div>
                <span className={styles.live}>LIVE</span>
            </section>
            <section className={styles.metrics} aria-label="Today’s clinical workload">
                {workload.map(({ label, value, unit, detail, icon: Icon, tone }) => <article key={label} className={styles.metric}><div className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={15} /></div><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></article>)}
            </section>
            <div className={styles.sectionHeading}><div><span>PATIENT CARE</span><h2>Today’s triage queue</h2></div><button onClick={loadQueue}>Refresh <ChevronRight size={13} /></button></div>
            <section className={styles.workspace}>
                <PatientQueue 
                    activePatientId={activePatient?.appointmentId || activePatient?.id} 
                    onSelectPatient={setActivePatient} 
                    queue={queue}
                    loading={isLoading}
                />
                <ClinicalSummary 
                    key={activePatient?.appointmentId || activePatient?.id || "empty"} 
                    patient={activePatient}
                    onConsultationCompleted={loadQueue}
                />
            </section>
        </main>

        <aside className={styles.schedulePanel}>
            <div className={styles.duty}><span></span><div><strong>On duty</strong><small>{user?.department || "General Medicine"} · 08:00–16:00</small></div></div>
            <span className={styles.eyebrow}>CARE CALENDAR</span><h2>Your schedule</h2>
            <div className={styles.calendar}><div className={styles.calendarHead}><strong>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><div><button>‹</button><button>›</button></div></div><div className={styles.week}>{["S","M","T","W","T","F","S"].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}</div><div className={styles.days}>{calendarDays.map((day, i) => <span key={`${day}-${i}`} className={day === String(new Date().getDate()) ? styles.today : i === 0 || i > 30 ? styles.mutedDay : ""}>{day}</span>)}</div></div>
            
            {queue.slice(0, 3).map((appt) => (
                <div 
                    key={appt.appointmentId || appt.id} 
                    className={styles.appointment}
                    onClick={() => setActivePatient(appt)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className={styles.appointmentIcon}><Stethoscope size={15} /></div>
                    <div>
                        <strong>{appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName || ''}`.trim() : (appt.name || 'Patient')}</strong>
                        <small>{appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:30 AM'} · {appt.reason || appt.intake?.chiefComplaint || 'Consultation'}</small>
                    </div>
                    <ChevronRight size={15} />
                </div>
            ))}
            {queue.length === 0 && (
                <div style={{ padding: '16px 0', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>
                    No upcoming appointments scheduled
                </div>
            )}
            <div className={styles.wellbeing}><span>HEALTH & CARE</span><strong>Thoughtful Consultation</strong><p>A calm minute keeps care attentive.</p></div>
        </aside>
    </motion.div>;
}
