import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    Users, CalendarDays, Clock3, CheckCircle2, Stethoscope, Search, 
    UserPlus, ArrowRight, Activity, Bed, Plus, RefreshCw, AlertCircle
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { 
    fetchReceptionistStats, 
    fetchReceptionistAppointments, 
    checkInAppointment, 
    fetchPublicDoctors 
} from "../services/api";
import toast from "react-hot-toast";
import DoctorScheduleModal from "../components/DoctorScheduleModal";
import styles from "./ReceptionistDashboard.module.css";

export default function ReceptionistDashboard() {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        totalToday: 0,
        checkedIn: 0,
        waiting: 0,
        completed: 0,
        availableDoctors: 0,
        totalPatients: 0,
        bedOccupancyRate: 72,
    });
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quickSearch, setQuickSearch] = useState("");
    const [checkingInId, setCheckingInId] = useState(null);
    const [selectedDoctorForSchedule, setSelectedDoctorForSchedule] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const todayStr = new Date().toISOString().split("T")[0];
            const [statsRes, apptsRes, docsRes] = await Promise.all([
                fetchReceptionistStats(token).catch(() => ({ stats: null })),
                fetchReceptionistAppointments({ date: todayStr }, token).catch(() => ({ appointments: [] })),
                fetchPublicDoctors(token).catch(() => ({ doctors: [] })),
            ]);

            if (statsRes?.stats) setStats(statsRes.stats);
            if (apptsRes?.appointments) setAppointments(apptsRes.appointments);
            if (docsRes?.doctors) setDoctors(docsRes.doctors);
        } catch (err) {
            console.error("Failed to load front-desk data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    const handleQuickCheckIn = async (appointmentId) => {
        setCheckingInId(appointmentId);
        try {
            await checkInAppointment(appointmentId, token);
            toast.success("Patient successfully checked in! Added to doctor's live queue.");
            // Update local state
            setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: "confirmed" } : a));
            setStats(prev => ({
                ...prev,
                checkedIn: prev.checkedIn + 1,
                waiting: Math.max(0, prev.waiting - 1),
            }));
        } catch (err) {
            toast.error(err.message || "Failed to check in patient.");
        } finally {
            setCheckingInId(null);
        }
    };

    const filteredAppointments = appointments.filter(a => {
        if (!quickSearch.trim()) return true;
        const q = quickSearch.toLowerCase();
        return (
            a.patient?.name?.toLowerCase().includes(q) ||
            a.patient?.phone?.toLowerCase().includes(q) ||
            a.doctor?.name?.toLowerCase().includes(q) ||
            a.id?.toLowerCase().includes(q)
        );
    });

    const currentDateStr = new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    return (
        <motion.div 
            className={styles.dashboard}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header / Welcome Row */}
            <div className={styles.header}>
                <div>
                    <div className={styles.dateBadge}>{currentDateStr}</div>
                    <h1 className={styles.title}>
                        Front-Desk OPD Desk
                    </h1>
                    <p className={styles.subtitle}>
                        Welcome back, {user?.firstName || "Receptionist"}. Manage patient check-ins, OPD queues, and hospital flow.
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <button onClick={loadData} className={styles.secondaryBtn} title="Refresh live status">
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    <Link to="/receptionist/patients" className={styles.primaryBtn}>
                        <UserPlus size={16} />
                        Walk-In Registration
                    </Link>
                </div>
            </div>

            {/* Stats Metrics Cards */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.toneBlue}`}>
                        <CalendarDays size={20} />
                    </div>
                    <div className={styles.metricContent}>
                        <span className={styles.metricLabel}>Today's Appointments</span>
                        <strong className={styles.metricValue}>{stats.totalToday}</strong>
                        <span className={styles.metricDetail}>Scheduled OPD</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.toneGreen}`}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className={styles.metricContent}>
                        <span className={styles.metricLabel}>Checked In</span>
                        <strong className={styles.metricValue}>{stats.checkedIn}</strong>
                        <span className={styles.metricDetail}>Ready in waiting room</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.toneAmber}`}>
                        <Clock3 size={20} />
                    </div>
                    <div className={styles.metricContent}>
                        <span className={styles.metricLabel}>Pending Check-In</span>
                        <strong className={styles.metricValue}>{Math.max(0, stats.totalToday - stats.checkedIn - stats.completed)}</strong>
                        <span className={styles.metricDetail}>Awaiting arrival</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.tonePurple}`}>
                        <Stethoscope size={20} />
                    </div>
                    <div className={styles.metricContent}>
                        <span className={styles.metricLabel}>Active Doctors</span>
                        <strong className={styles.metricValue}>{stats.availableDoctors || doctors.length}</strong>
                        <span className={styles.metricDetail}>On OPD Duty</span>
                    </div>
                </div>
            </div>

            {/* Main Workspace Layout (2 columns: Queue + Doctor Availability) */}
            <div className={styles.workspaceGrid}>
                {/* Left: Live Today's OPD Queue */}
                <div className={styles.queueCard}>
                    <div className={styles.queueHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Today's Patient Queue</h2>
                            <p className={styles.cardSubtitle}>Search and check-in patients arriving at the clinic.</p>
                        </div>
                        <div className={styles.searchBox}>
                            <Search size={16} className={styles.searchIcon} />
                            <input 
                                type="text"
                                placeholder="Search by name, phone or ID..."
                                value={quickSearch}
                                onChange={(e) => setQuickSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.loadingState}>
                            <Activity size={24} className={styles.spinIcon} />
                            <span>Loading patient queue...</span>
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className={styles.emptyState}>
                            <AlertCircle size={36} color="#94a3b8" />
                            <h3>No appointments found for today</h3>
                            <p>Register a walk-in patient or book an appointment to begin.</p>
                            <Link to="/receptionist/patients" className={styles.emptyActionBtn}>
                                <Plus size={16} /> Add Walk-In Patient
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Contact</th>
                                        <th>Assigned Doctor</th>
                                        <th>Time</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: "right" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((appt, idx) => {
                                        const isCheckedIn = appt.status === "confirmed" || appt.status === "checked_in";
                                        const isCompleted = appt.status === "completed";
                                        const isCancelled = appt.status === "cancelled";
                                        const timeStr = new Date(appt.scheduledAt).toLocaleTimeString("en-IN", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true
                                        });

                                        return (
                                            <tr key={appt.id || idx}>
                                                <td>
                                                    <div className={styles.patientInfo}>
                                                        <div className={styles.avatar}>
                                                            {appt.patient?.firstName?.[0] || "P"}{appt.patient?.lastName?.[0] || ""}
                                                        </div>
                                                        <div>
                                                            <strong className={styles.patientName}>{appt.patient?.name || "Patient"}</strong>
                                                            <small className={styles.patientGender}>
                                                                {appt.patient?.gender || "N/A"} · {appt.patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(appt.patient.dateOfBirth).getFullYear()}y` : "Age N/A"}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={styles.contactPhone}>{appt.patient?.phone || "No phone"}</span>
                                                </td>
                                                <td>
                                                    <div className={styles.doctorBadge}>
                                                        <Stethoscope size={13} />
                                                        <span>{appt.doctor?.name || "Dr. On Duty"}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={styles.timeBadge}>{timeStr}</span>
                                                </td>
                                                <td>
                                                    <span className={`
                                                        ${styles.statusBadge} 
                                                        ${isCheckedIn ? styles.statusCheckedIn : isCompleted ? styles.statusCompleted : isCancelled ? styles.statusCancelled : styles.statusScheduled}
                                                    `}>
                                                        {isCheckedIn ? "Checked In" : isCompleted ? "Completed" : isCancelled ? "Cancelled" : "Scheduled"}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: "right" }}>
                                                    {!isCheckedIn && !isCompleted && !isCancelled && (
                                                        <button 
                                                            className={styles.checkInBtn}
                                                            onClick={() => handleQuickCheckIn(appt.id)}
                                                            disabled={checkingInId === appt.id}
                                                        >
                                                            {checkingInId === appt.id ? "Checking in..." : "Check In"}
                                                        </button>
                                                    )}
                                                    {isCheckedIn && (
                                                        <span className={styles.checkedInDone}>
                                                            <CheckCircle2 size={15} color="#16a34a" />
                                                            In Queue
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right: Doctor OPD Roster & Quick Actions */}
                <div className={styles.sideColumn}>
                    {/* Doctor Duty Card */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideCardHeader}>
                            <h3 className={styles.cardTitle}>Doctors on Duty</h3>
                            <Link to="/receptionist/doctor" className={styles.cardLink}>
                                Directory <ArrowRight size={13} />
                            </Link>
                        </div>
                        <div className={styles.doctorList}>
                            {doctors.slice(0, 5).map((doc, idx) => (
                                <div 
                                    key={doc.id || idx} 
                                    className={styles.doctorItem}
                                    onClick={() => setSelectedDoctorForSchedule(doc)}
                                    style={{ cursor: "pointer", transition: "background 0.2s" }}
                                    title="Click to view full day schedule & slot availability"
                                >
                                    <div className={styles.docAvatar}>
                                        <Stethoscope size={16} />
                                    </div>
                                    <div className={styles.docInfo}>
                                        <strong>{doc.name}</strong>
                                        <small>{doc.specialization} · OPD Room {idx + 101}</small>
                                    </div>
                                    <span 
                                        className={styles.docOnlineBadge} 
                                        style={{ background: "#e0f2fe", color: "#0284c7", fontWeight: "600", fontSize: "0.75rem" }}
                                    >
                                        Schedule
                                    </span>
                                </div>
                            ))}
                            {doctors.length === 0 && (
                                <p className={styles.noDataText}>No verified doctors registered yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Quick Hospital Services Card */}
                    <div className={styles.sideCard}>
                        <h3 className={styles.cardTitle}>Front-Desk Quick Actions</h3>
                        <div className={styles.quickActionsGrid}>
                            <Link to="/receptionist/patients" className={styles.quickActionCard}>
                                <UserPlus size={20} color="#0d9488" />
                                <div>
                                    <strong>Walk-In Patient</strong>
                                    <small>Instant check-in</small>
                                </div>
                            </Link>
                            <Link to="/receptionist/appointments" className={styles.quickActionCard}>
                                <CalendarDays size={20} color="#6366f1" />
                                <div>
                                    <strong>All Appointments</strong>
                                    <small>Reschedule & manage</small>
                                </div>
                            </Link>
                            <Link to="/receptionist/bed" className={styles.quickActionCard}>
                                <Bed size={20} color="#e11d48" />
                                <div>
                                    <strong>Bed Manager</strong>
                                    <small>Ward allocations</small>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Doctor Live Schedule Modal */}
            <DoctorScheduleModal 
                doctor={selectedDoctorForSchedule}
                isOpen={!!selectedDoctorForSchedule}
                onClose={() => setSelectedDoctorForSchedule(null)}
                onBookSlot={(doc, slotTime) => {
                    setSelectedDoctorForSchedule(null);
                    navigate("/receptionist/appointments");
                }}
            />
        </motion.div>
    );
}
