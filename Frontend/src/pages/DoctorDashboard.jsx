import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarDays, CheckCircle2, ChevronRight, Clock3, Search, Sparkles, Stethoscope, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PatientQueue from "../components/doctor/PatientQueue";
import ClinicalSummary from "../components/doctor/ClinicalSummary";
import careIllustration from "../assets/indian-care-sidebar.png";
import styles from "./DoctorDashboard.module.css";

const workload = [
    { label: "Waiting", value: "04", detail: "2 priority", icon: Users, tone: "sage" },
    { label: "Today", value: "12", detail: "Next 10:30", icon: CalendarDays, tone: "blue" },
    { label: "Avg. wait", value: "21", unit: "min", detail: "↓ 4 minutes", icon: Clock3, tone: "amber" },
    { label: "Completed", value: "08", detail: "67% of list", icon: CheckCircle2, tone: "purple" },
];

const calendarDays = ["31", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "1", "2", "3", "4"];

export default function DoctorDashboard() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [activePatient, setActivePatient] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 400);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) return <div className={styles.loading}><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /></div>;

    const doctorName = user?.lastName ? `Dr. ${user.lastName}` : `Dr. ${user?.firstName || "Anand"}`;

    return <motion.div className={styles.dashboard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
        <aside className={styles.storyPanel}>
            <div className={styles.storyCopy}><span>CARE, WITH CONTEXT</span><h2>Clinical care,<br />grounded in trust.</h2><p>A thoughtful workspace for focused, patient-first practice.</p></div>
            <img src={careIllustration} alt="Indian doctor in a warm consultation with her patient" />
            <div className={styles.storyBadge}><Stethoscope size={16} /><div><strong>Care rooted in trust</strong><small>Thoughtful, private and patient-first</small></div></div>
        </aside>

        <main className={styles.mainColumn}>
            <header className={styles.pageHeader}>
                <div><span className={styles.eyebrow}>MONDAY, 7 SEPTEMBER</span><h1>Good morning, {doctorName}</h1><p>Here is your clinical overview for today.</p></div>
                <div className={styles.headerActions}><button aria-label="Search"><Search size={17} /></button><button aria-label="Clinical activity"><Activity size={17} /></button></div>
            </header>
            <section className={styles.brief}><div className={styles.briefIcon}><Sparkles size={18} /></div><div><span>CARE TEAM BRIEF</span><h2>Four patients are ready for review.</h2><p>AI summaries are ready for three patients; two cases have clinical red flags.</p></div><span className={styles.live}>LIVE</span></section>
            <section className={styles.metrics} aria-label="Today’s clinical workload">
                {workload.map(({ label, value, unit, detail, icon: Icon, tone }) => <article key={label} className={styles.metric}><div className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={15} /></div><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></article>)}
            </section>
            <div className={styles.sectionHeading}><div><span>PATIENT CARE</span><h2>Today’s triage queue</h2></div><button>View all <ChevronRight size={13} /></button></div>
            <section className={styles.workspace}><PatientQueue activePatientId={activePatient?.id} onSelectPatient={setActivePatient} /><ClinicalSummary key={activePatient?.id || "empty"} patient={activePatient} /></section>
        </main>

        <aside className={styles.schedulePanel}>
            <div className={styles.duty}><span></span><div><strong>On duty</strong><small>General medicine · 08:00–16:00</small></div></div>
            <span className={styles.eyebrow}>CARE CALENDAR</span><h2>Your schedule</h2>
            <div className={styles.calendar}><div className={styles.calendarHead}><strong>September 2026</strong><div><button>‹</button><button>›</button></div></div><div className={styles.week}>{["S","M","T","W","T","F","S"].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}</div><div className={styles.days}>{calendarDays.map((day, i) => <span key={`${day}-${i}`} className={day === "7" ? styles.today : i === 0 || i > 30 ? styles.mutedDay : ""}>{day}</span>)}</div></div>
            <div className={styles.appointment}><div className={styles.appointmentIcon}><Stethoscope size={15} /></div><div><strong>Rajesh Kumar</strong><small>10:30 AM · Consultation</small></div><ChevronRight size={15} /></div>
            <div className={`${styles.appointment} ${styles.appointmentWarm}`}><div className={styles.appointmentIcon}><Activity size={15} /></div><div><strong>Care team huddle</strong><small>12:15 PM · Ward 2</small></div><ChevronRight size={15} /></div>
            <button className={styles.scheduleLink}>See complete schedule <ChevronRight size={13} /></button>
            <div className={styles.wellbeing}><span>आज का विचार</span><strong>Pause between patients</strong><p>A calm minute keeps care attentive.</p></div>
        </aside>
    </motion.div>;
}
