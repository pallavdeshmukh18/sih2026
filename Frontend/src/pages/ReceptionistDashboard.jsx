import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
    Users, CalendarDays, Clock3, CheckCircle2, Stethoscope, Search, 
    UserPlus, ArrowRight, Activity, Plus, RefreshCw, AlertCircle,
    Filter, X, Clock, UserCheck
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
    });
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quickSearch, setQuickSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'checked_in', 'yet_to_arrive', 'completed'
    const [doctorFilter, setDoctorFilter] = useState("all"); // 'all' or doctorId
    const [timeSlotFilter, setTimeSlotFilter] = useState("all"); // 'all', 'morning', 'afternoon', 'evening'
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

    // Queue Segment Counts
    const counts = useMemo(() => {
        let all = appointments.length;
        let checkedIn = 0;
        let yetToArrive = 0;
        let completed = 0;

        appointments.forEach(a => {
            if (a.status === "confirmed" || a.status === "checked_in") checkedIn++;
            else if (a.status === "scheduled") yetToArrive++;
            else if (a.status === "completed") completed++;
        });

        return { all, checkedIn, yetToArrive, completed };
    }, [appointments]);

    // Filtered Appointments based on Search, Status, Doctor, and Timeslot
    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            // Check-in / Arrival filter
            if (statusFilter === "checked_in" && !(a.status === "confirmed" || a.status === "checked_in")) return false;
            if (statusFilter === "yet_to_arrive" && a.status !== "scheduled") return false;
            if (statusFilter === "completed" && a.status !== "completed") return false;

            // Doctor filter
            if (doctorFilter !== "all" && a.doctor?.id !== doctorFilter) return false;

            // Timeslot filter
            if (timeSlotFilter !== "all") {
                const apptDate = new Date(a.scheduledAt);
                const hour = apptDate.getHours();
                if (timeSlotFilter === "morning" && hour >= 12) return false;
                if (timeSlotFilter === "afternoon" && (hour < 12 || hour >= 16)) return false;
                if (timeSlotFilter === "evening" && hour < 16) return false;
            }

            // Quick search
            if (quickSearch.trim()) {
                const q = quickSearch.toLowerCase();
                const matches = 
                    a.patient?.name?.toLowerCase().includes(q) ||
                    a.patient?.phone?.toLowerCase().includes(q) ||
                    a.doctor?.name?.toLowerCase().includes(q) ||
                    a.id?.toLowerCase().includes(q);
                if (!matches) return false;
            }

            return true;
        });
    }, [appointments, statusFilter, doctorFilter, timeSlotFilter, quickSearch]);

    const isFilterActive = statusFilter !== "all" || doctorFilter !== "all" || timeSlotFilter !== "all" || quickSearch.trim() !== "";

    const resetFilters = () => {
        setStatusFilter("all");
        setDoctorFilter("all");
        setTimeSlotFilter("all");
        setQuickSearch("");
    };

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

            {/* Manage Appointments Action Tab / Banner */}
            <Link to="/receptionist/appointments" className={styles.manageAppointmentsBanner}>
                <div className={styles.bannerLeft}>
                    <div className={styles.bannerIcon}>
                        <CalendarDays size={24} />
                    </div>
                    <div className={styles.bannerContent}>
                        <div className={styles.bannerTitleRow}>
                            <h2 className={styles.bannerTitle}>Manage Appointments</h2>
                            <span className={styles.bannerBadge}>OPD Hub</span>
                        </div>
                        <p className={styles.bannerSubtitle}>
                            Book, reschedule, cancel, confirm appointments; doctor/date/time slots
                        </p>
                    </div>
                </div>
                <div className={styles.bannerAction}>
                    <span>Manage Appointments</span>
                    <ArrowRight size={16} />
                </div>
            </Link>

            {/* Main Workspace Layout (2 columns: Queue + Doctor Availability) */}
            <div className={styles.workspaceGrid}>
                {/* Left: Live Today's OPD Queue */}
                <div className={styles.queueCard}>
                    <div className={styles.queueHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Today's Patient Queue</h2>
                            <p className={styles.cardSubtitle}>Search and check-in patients arriving at the clinic.</p>
                        </div>
                        <div className={styles.queueHeaderBadge}>
                            <span className={styles.livePulseDot}></span>
                            <span>Live OPD Roster</span>
                        </div>
                    </div>

                    {/* Expanded Patient Search Menu */}
                    <div className={styles.searchBox}>
                        <Search size={18} className={styles.searchIcon} />
                        <input 
                            type="text"
                            placeholder="Search patient by name, mobile number, ABHA ID, or appointment ID..."
                            value={quickSearch}
                            onChange={(e) => setQuickSearch(e.target.value)}
                        />
                        {quickSearch && (
                            <button 
                                className={styles.clearSearchBtn}
                                onClick={() => setQuickSearch("")}
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Segment Controls Strip: Status (Checked in / Yet to arrive), Doctor, Timeslots */}
                    <div className={styles.queueFilterStrip}>
                        {/* Status Pills */}
                        <div className={styles.statusPills}>
                            <button
                                className={`${styles.statusPill} ${statusFilter === "all" ? styles.statusPillActive : ""}`}
                                onClick={() => setStatusFilter("all")}
                            >
                                All <span className={styles.pillCount}>{counts.all}</span>
                            </button>
                            <button
                                className={`${styles.statusPill} ${statusFilter === "checked_in" ? styles.statusPillCheckedInActive : ""}`}
                                onClick={() => setStatusFilter("checked_in")}
                            >
                                <span className={styles.statusDotGreen}></span>
                                Checked In <span className={styles.pillCount}>{counts.checkedIn}</span>
                            </button>
                            <button
                                className={`${styles.statusPill} ${statusFilter === "yet_to_arrive" ? styles.statusPillPendingActive : ""}`}
                                onClick={() => setStatusFilter("yet_to_arrive")}
                            >
                                <span className={styles.statusDotAmber}></span>
                                Yet to Arrive <span className={styles.pillCount}>{counts.yetToArrive}</span>
                            </button>
                            <button
                                className={`${styles.statusPill} ${statusFilter === "completed" ? styles.statusPillCompletedActive : ""}`}
                                onClick={() => setStatusFilter("completed")}
                            >
                                Completed <span className={styles.pillCount}>{counts.completed}</span>
                            </button>
                        </div>

                        {/* Dropdown Filters (Doctor & Timeslot) */}
                        <div className={styles.dropdownFilters}>
                            <div className={styles.filterDropdownGroup}>
                                <Stethoscope size={14} className={styles.filterDropdownIcon} />
                                <select 
                                    value={doctorFilter}
                                    onChange={(e) => setDoctorFilter(e.target.value)}
                                    className={styles.filterSelect}
                                >
                                    <option value="all">All Doctors</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.filterDropdownGroup}>
                                <Clock size={14} className={styles.filterDropdownIcon} />
                                <select 
                                    value={timeSlotFilter}
                                    onChange={(e) => setTimeSlotFilter(e.target.value)}
                                    className={styles.filterSelect}
                                >
                                    <option value="all">All Timeslots</option>
                                    <option value="morning">Morning (Before 12 PM)</option>
                                    <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                                    <option value="evening">Evening (After 4 PM)</option>
                                </select>
                            </div>

                            {isFilterActive && (
                                <button 
                                    onClick={resetFilters} 
                                    className={styles.resetFilterBtn}
                                    title="Reset all filters"
                                >
                                    <X size={13} />
                                    Reset
                                </button>
                            )}
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
                            {isFilterActive ? (
                                <>
                                    <h3>No patients match your filters</h3>
                                    <p>Try switching filter options or clearing search keywords.</p>
                                    <button onClick={resetFilters} className={styles.emptyActionBtn} style={{ background: "#475569" }}>
                                        <X size={16} /> Reset Filters
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h3>No appointments found for today</h3>
                                    <p>Register a walk-in patient or book an appointment to begin.</p>
                                    <Link to="/receptionist/patients" className={styles.emptyActionBtn}>
                                        <Plus size={16} /> Add Walk-In Patient
                                    </Link>
                                </>
                            )}
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
                                <CalendarDays size={20} color="#0284c7" />
                                <div>
                                    <strong>Manage Appointments</strong>
                                    <small>Book, reschedule, cancel, confirm</small>
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
