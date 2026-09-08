import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
    Calendar, Search, Filter, Stethoscope, CheckCircle2, 
    XCircle, Clock, Plus, User, ArrowUpDown, RefreshCw 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { 
    fetchReceptionistAppointments, 
    checkInAppointment, 
    fetchPublicDoctors,
    createAppointment 
} from "../../services/api";
import toast from "react-hot-toast";
import DoctorScheduleModal from "../../components/DoctorScheduleModal";
import styles from "./ReceptionistAppointments.module.css";

export default function ReceptionistAppointments() {
    const { token } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [selectedDoctor, setSelectedDoctor] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Modal states
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [scheduleDoctor, setScheduleDoctor] = useState(null);
    const [bookingForm, setBookingForm] = useState({
        patientId: "",
        doctorId: "",
        scheduledAt: "",
        reason: "",
    });
    const [submittingBooking, setSubmittingBooking] = useState(false);

    const loadAppointments = async () => {
        setLoading(true);
        try {
            const params = {
                date: selectedDate || undefined,
                doctorId: selectedDoctor !== "all" ? selectedDoctor : undefined,
                status: selectedStatus !== "all" ? selectedStatus : undefined,
                search: searchQuery.trim() || undefined,
            };

            const [apptsRes, docsRes] = await Promise.all([
                fetchReceptionistAppointments(params, token),
                fetchPublicDoctors(token).catch(() => ({ doctors: [] })),
            ]);

            if (apptsRes?.appointments) setAppointments(apptsRes.appointments);
            if (docsRes?.doctors) setDoctors(docsRes.doctors);
        } catch (err) {
            toast.error(err.message || "Failed to load appointments.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAppointments();
    }, [selectedDate, selectedDoctor, selectedStatus, token]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAppointments();
    };

    const handleCheckIn = async (appointmentId) => {
        try {
            await checkInAppointment(appointmentId, token);
            toast.success("Patient checked in successfully!");
            setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: "confirmed" } : a));
        } catch (err) {
            toast.error(err.message || "Check-in failed.");
        }
    };

    const handleCreateBooking = async (e) => {
        e.preventDefault();
        if (!bookingForm.patientId || !bookingForm.doctorId || !bookingForm.scheduledAt) {
            toast.error("Please fill in all required booking fields.");
            return;
        }

        setSubmittingBooking(true);
        try {
            await createAppointment(bookingForm, token);
            toast.success("Appointment booked successfully!");
            setShowBookingModal(false);
            setBookingForm({ patientId: "", doctorId: "", scheduledAt: "", reason: "" });
            loadAppointments();
        } catch (err) {
            toast.error(err.message || "Failed to book appointment.");
        } finally {
            setSubmittingBooking(false);
        }
    };

    return (
        <motion.div 
            className={styles.container}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Front-Desk Appointments & OPD Schedule</h1>
                    <p className={styles.subtitle}>View, filter, and check-in patient appointments across all clinic doctors.</p>
                </div>
                <div className={styles.headerButtons}>
                    <button onClick={loadAppointments} className={styles.secondaryBtn}>
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                    <button onClick={() => setShowBookingModal(true)} className={styles.primaryBtn}>
                        <Plus size={16} />
                        Book Appointment
                    </button>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className={styles.filterCard}>
                <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                    <Search size={16} className={styles.searchIcon} />
                    <input 
                        type="text"
                        placeholder="Search patient name, phone, ABHA ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className={styles.searchBtn}>Search</button>
                </form>

                <div className={styles.filterControls}>
                    <div className={styles.controlGroup}>
                        <label>Date:</label>
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div className={styles.controlGroup}>
                        <label>Doctor:</label>
                        <select 
                            value={selectedDoctor}
                            onChange={(e) => setSelectedDoctor(e.target.value)}
                        >
                            <option value="all">All Doctors</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.controlGroup}>
                        <label>Status:</label>
                        <select 
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Checked In</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Appointments Table Card */}
            <div className={styles.tableCard}>
                {loading ? (
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <p>Loading appointments roster...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className={styles.emptyContainer}>
                        <Calendar size={40} color="#94a3b8" />
                        <h3>No appointments match your filters</h3>
                        <p>Try picking another date or clear your search query.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Patient Details</th>
                                    <th>Contact</th>
                                    <th>Consulting Doctor</th>
                                    <th>Scheduled Time</th>
                                    <th>Reason / Complaint</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right" }}>Front-Desk Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(appt => {
                                    const isCheckedIn = appt.status === "confirmed" || appt.status === "checked_in";
                                    const isCompleted = appt.status === "completed";
                                    const isCancelled = appt.status === "cancelled";
                                    const dateObj = new Date(appt.scheduledAt);
                                    const dateStr = dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
                                    const timeStr = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

                                    return (
                                        <tr key={appt.id}>
                                            <td>
                                                <div className={styles.patientCell}>
                                                    <div className={styles.avatar}>
                                                        {appt.patient?.firstName?.[0] || "P"}{appt.patient?.lastName?.[0] || ""}
                                                    </div>
                                                    <div>
                                                        <strong className={styles.nameText}>{appt.patient?.name}</strong>
                                                        <small className={styles.subText}>
                                                            {appt.patient?.gender || "N/A"} · {appt.patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(appt.patient.dateOfBirth).getFullYear()} yrs` : "Age N/A"}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.contactText}>{appt.patient?.phone || "—"}</span>
                                            </td>
                                            <td>
                                                <div 
                                                    className={styles.doctorCell}
                                                    style={{ cursor: "pointer" }}
                                                    onClick={() => {
                                                        const fullDoc = doctors.find(d => d.id === appt.doctor?.id) || appt.doctor;
                                                        setScheduleDoctor(fullDoc);
                                                    }}
                                                    title="Click to view doctor timetable & availability"
                                                >
                                                    <Stethoscope size={14} color="#0284c7" />
                                                    <div>
                                                        <strong style={{ color: "#0284c7" }}>{appt.doctor?.name}</strong>
                                                        <small>{appt.doctor?.specialization}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.timeCell}>
                                                    <strong>{timeStr}</strong>
                                                    <small>{dateStr}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.reasonText}>{appt.reason || "General Consultation"}</span>
                                            </td>
                                            <td>
                                                <span className={`
                                                    ${styles.statusBadge} 
                                                    ${isCheckedIn ? styles.statusConfirmed : isCompleted ? styles.statusCompleted : isCancelled ? styles.statusCancelled : styles.statusScheduled}
                                                `}>
                                                    {isCheckedIn ? "Checked In" : isCompleted ? "Completed" : isCancelled ? "Cancelled" : "Scheduled"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                {!isCheckedIn && !isCompleted && !isCancelled && (
                                                    <button 
                                                        className={styles.actionCheckInBtn}
                                                        onClick={() => handleCheckIn(appt.id)}
                                                    >
                                                        Check In
                                                    </button>
                                                )}
                                                {isCheckedIn && (
                                                    <span className={styles.inQueueText}>
                                                        <CheckCircle2 size={15} color="#16a34a" />
                                                        Ready
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

            {/* Booking Modal */}
            {showBookingModal && (
                <div className={styles.modalOverlay} onClick={() => setShowBookingModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Book Doctor Appointment</h2>
                            <button className={styles.closeBtn} onClick={() => setShowBookingModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateBooking} className={styles.modalForm}>
                            <div className={styles.formGroup}>
                                <label>Patient User ID (UUID) <span>*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Enter Patient UUID or lookup in Patients tab"
                                    value={bookingForm.patientId}
                                    onChange={e => setBookingForm({ ...bookingForm, patientId: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Select Doctor <span>*</span></label>
                                <select 
                                    value={bookingForm.doctorId}
                                    onChange={e => setBookingForm({ ...bookingForm, doctorId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Choose Doctor --</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Appointment Date & Time <span>*</span></label>
                                <input 
                                    type="datetime-local" 
                                    value={bookingForm.scheduledAt}
                                    onChange={e => setBookingForm({ ...bookingForm, scheduledAt: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Reason for Visit</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Chest pain, Follow-up"
                                    value={bookingForm.reason}
                                    onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.secondaryBtn} onClick={() => setShowBookingModal(false)}>Cancel</button>
                                <button type="submit" className={styles.primaryBtn} disabled={submittingBooking}>
                                    {submittingBooking ? "Booking..." : "Confirm Booking"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Doctor Live Schedule Modal */}
            <DoctorScheduleModal
                doctor={scheduleDoctor}
                isOpen={!!scheduleDoctor}
                onClose={() => setScheduleDoctor(null)}
                onBookSlot={(doc, slotTime) => {
                    setScheduleDoctor(null);
                    setBookingForm(prev => ({
                        ...prev,
                        doctorId: doc.id,
                        scheduledAt: slotTime,
                    }));
                    setShowBookingModal(true);
                }}
            />
        </motion.div>
    );
}
