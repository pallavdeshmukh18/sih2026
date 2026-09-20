import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Calendar, Search, Filter, Stethoscope, CheckCircle2, 
    XCircle, Clock, Plus, User, ArrowUpDown, RefreshCw, AlertTriangle, CalendarDays
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { 
    fetchReceptionistAppointments, 
    checkInAppointment, 
    fetchPublicDoctors,
    bookReceptionistAppointment,
    cancelReceptionistAppointment,
    rescheduleReceptionistAppointment,
    fetchAvailableDoctorSlots,
    createAppointment 
} from "../../services/api";
import toast from "react-hot-toast";
import DoctorScheduleModal from "../../components/DoctorScheduleModal";
import styles from "./ReceptionistAppointments.module.css";

const STANDARD_TIME_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

export default function ReceptionistAppointments() {
    const { token } = useAuth();
    const todayStr = new Date().toISOString().split("T")[0];

    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selectedDoctor, setSelectedDoctor] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Schedule modal for doctor timetable
    const [scheduleDoctor, setScheduleDoctor] = useState(null);

    // Booking Modal states
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        patientId: "",
        doctorId: "",
        date: todayStr,
        slotTime: "09:30",
        reason: "",
    });
    const [bookingBookedSlots, setBookingBookedSlots] = useState([]);
    const [submittingBooking, setSubmittingBooking] = useState(false);

    // Reschedule Modal states
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [rescheduleDoctorId, setRescheduleDoctorId] = useState("");
    const [rescheduleDate, setRescheduleDate] = useState(todayStr);
    const [rescheduleSlot, setRescheduleSlot] = useState("09:30");
    const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState([]);
    const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
    const [submittingReschedule, setSubmittingReschedule] = useState(false);

    // Cancel Modal states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [submittingCancel, setSubmittingCancel] = useState(false);

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

    // Confirm / Check-in
    const handleCheckIn = async (appointmentId) => {
        try {
            await checkInAppointment(appointmentId, token);
            toast.success("Appointment confirmed & patient checked into live queue!");
            setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: "confirmed" } : a));
        } catch (err) {
            toast.error(err.message || "Check-in failed.");
        }
    };

    // Load slot availability for Reschedule
    const loadRescheduleSlots = async (doctorId, date, excludeApptId) => {
        if (!doctorId || !date) return;
        setLoadingRescheduleSlots(true);
        try {
            const appts = await fetchReceptionistAppointments({ doctorId, date }, token);
            const booked = (appts?.appointments || [])
                .filter(a => a.status !== 'cancelled' && a.id !== excludeApptId)
                .map(a => {
                    const d = new Date(a.scheduledAt);
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                });
            setRescheduleBookedSlots(booked);
        } catch (err) {
            setRescheduleBookedSlots([]);
        } finally {
            setLoadingRescheduleSlots(false);
        }
    };

    // Open Reschedule Modal
    const handleOpenReschedule = (appt) => {
        setRescheduleTarget(appt);
        const apptDate = appt.scheduledAt ? new Date(appt.scheduledAt) : new Date();
        const dateStr = apptDate.toISOString().split("T")[0];
        const hours = String(apptDate.getHours()).padStart(2, "0");
        const minutes = String(apptDate.getMinutes()).padStart(2, "0");
        const timeStr = `${hours}:${minutes}`;

        const docId = appt.doctor?.id || (doctors[0]?.id || "");
        setRescheduleDoctorId(docId);
        setRescheduleDate(dateStr);
        setRescheduleSlot(timeStr);
        setShowRescheduleModal(true);
        loadRescheduleSlots(docId, dateStr, appt.id);
    };

    // Change Doctor or Date in Reschedule Modal
    const handleRescheduleDoctorChange = (newDocId) => {
        setRescheduleDoctorId(newDocId);
        loadRescheduleSlots(newDocId, rescheduleDate, rescheduleTarget?.id);
    };

    const handleRescheduleDateChange = (newDate) => {
        setRescheduleDate(newDate);
        loadRescheduleSlots(rescheduleDoctorId, newDate, rescheduleTarget?.id);
    };

    // Submit Reschedule
    const handleConfirmReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleTarget || !rescheduleDoctorId || !rescheduleDate || !rescheduleSlot) {
            toast.error("Please select a doctor, date, and valid time slot.");
            return;
        }

        setSubmittingReschedule(true);
        try {
            const scheduledAt = `${rescheduleDate}T${rescheduleSlot}:00`;
            await rescheduleReceptionistAppointment(rescheduleTarget.id, {
                scheduledAt,
                doctorId: rescheduleDoctorId,
            }, token);

            toast.success("Appointment rescheduled successfully!");
            setShowRescheduleModal(false);
            setRescheduleTarget(null);
            loadAppointments();
        } catch (err) {
            toast.error(err.message || "Failed to reschedule appointment.");
        } finally {
            setSubmittingReschedule(false);
        }
    };

    // Open Cancel Modal
    const handleOpenCancel = (appt) => {
        setCancelTarget(appt);
        setShowCancelModal(true);
    };

    // Submit Cancellation
    const handleConfirmCancel = async () => {
        if (!cancelTarget) return;
        setSubmittingCancel(true);
        try {
            await cancelReceptionistAppointment(cancelTarget.id, token);
            toast.success("Appointment cancelled successfully.");
            setAppointments(prev => prev.map(a => a.id === cancelTarget.id ? { ...a, status: "cancelled" } : a));
            setShowCancelModal(false);
            setCancelTarget(null);
        } catch (err) {
            toast.error(err.message || "Failed to cancel appointment.");
        } finally {
            setSubmittingCancel(false);
        }
    };

    // Load slot availability for Booking Modal
    const loadBookingSlots = async (doctorId, date) => {
        if (!doctorId || !date) return;
        try {
            const appts = await fetchReceptionistAppointments({ doctorId, date }, token);
            const booked = (appts?.appointments || [])
                .filter(a => a.status !== 'cancelled')
                .map(a => {
                    const d = new Date(a.scheduledAt);
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                });
            setBookingBookedSlots(booked);
        } catch {
            setBookingBookedSlots([]);
        }
    };

    const handleOpenBooking = () => {
        const defaultDocId = doctors[0]?.id || "";
        setBookingForm({
            patientId: "",
            doctorId: defaultDocId,
            date: todayStr,
            slotTime: "10:00",
            reason: "",
        });
        if (defaultDocId) {
            loadBookingSlots(defaultDocId, todayStr);
        }
        setShowBookingModal(true);
    };

    // Create Booking
    const handleCreateBooking = async (e) => {
        e.preventDefault();
        if (!bookingForm.patientId || !bookingForm.doctorId || !bookingForm.date || !bookingForm.slotTime) {
            toast.error("Please fill in all required booking fields.");
            return;
        }

        setSubmittingBooking(true);
        try {
            const scheduledAt = `${bookingForm.date}T${bookingForm.slotTime}:00`;
            await bookReceptionistAppointment({
                patientId: bookingForm.patientId.trim(),
                doctorId: bookingForm.doctorId,
                scheduledAt,
                reason: bookingForm.reason || "General Consultation",
            }, token);

            toast.success("Appointment booked successfully!");
            setShowBookingModal(false);
            setBookingForm({ patientId: "", doctorId: "", date: todayStr, slotTime: "10:00", reason: "" });
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
                    <h1 className={styles.title}>Manage Appointments</h1>
                    <p className={styles.subtitle}>Book, reschedule, cancel, confirm appointments; doctor/date/time slots</p>
                </div>
                <div className={styles.headerButtons}>
                    <button onClick={loadAppointments} className={styles.secondaryBtn}>
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                    <button onClick={handleOpenBooking} className={styles.primaryBtn} style={{ background: "#0284c7" }}>
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
                            <option value="confirmed">Confirmed / Checked In</option>
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
                                    <th style={{ textAlign: "right" }}>Appointment Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(appt => {
                                    const isCheckedIn = appt.status === "confirmed" || appt.status === "checked_in";
                                    const isCompleted = appt.status === "completed";
                                    const isCancelled = appt.status === "cancelled";
                                    const isScheduled = appt.status === "scheduled";
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
                                                    {isCheckedIn ? "Confirmed" : isCompleted ? "Completed" : isCancelled ? "Cancelled" : "Scheduled"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div className={styles.actionBtnGroup}>
                                                    {/* Confirm / Check-in */}
                                                    {isScheduled && (
                                                        <button 
                                                            className={styles.confirmBtn}
                                                            onClick={() => handleCheckIn(appt.id)}
                                                            title="Confirm and check in patient"
                                                        >
                                                            <CheckCircle2 size={13} />
                                                            Confirm
                                                        </button>
                                                    )}

                                                    {isCheckedIn && (
                                                        <span className={styles.inQueueText} title="Confirmed and in queue">
                                                            <CheckCircle2 size={14} color="#16a34a" />
                                                            Confirmed
                                                        </span>
                                                    )}

                                                    {/* Reschedule Button */}
                                                    {!isCompleted && !isCancelled && (
                                                        <button 
                                                            className={styles.rescheduleBtn}
                                                            onClick={() => handleOpenReschedule(appt)}
                                                            title="Reschedule appointment date or time"
                                                        >
                                                            <Clock size={13} />
                                                            Reschedule
                                                        </button>
                                                    )}

                                                    {/* Cancel Button */}
                                                    {!isCompleted && !isCancelled && (
                                                        <button 
                                                            className={styles.cancelBtn}
                                                            onClick={() => handleOpenCancel(appt)}
                                                            title="Cancel appointment"
                                                        >
                                                            <XCircle size={13} />
                                                            Cancel
                                                        </button>
                                                    )}

                                                    {isCancelled && (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                            Cancelled
                                                        </span>
                                                    )}

                                                    {isCompleted && (
                                                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                                                            Completed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reschedule Modal */}
            {showRescheduleModal && rescheduleTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowRescheduleModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className={styles.modalHeader}>
                            <h2>Reschedule Appointment</h2>
                            <button className={styles.closeBtn} onClick={() => setShowRescheduleModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleConfirmReschedule} className={styles.modalForm}>
                            <div className={styles.rescheduleInfoBox}>
                                <div className={styles.rescheduleInfoRow}>
                                    <span>Patient:</span>
                                    <strong>{rescheduleTarget.patient?.name} ({rescheduleTarget.patient?.phone || "No phone"})</strong>
                                </div>
                                <div className={styles.rescheduleInfoRow}>
                                    <span>Currently with:</span>
                                    <span>{rescheduleTarget.doctor?.name}</span>
                                </div>
                                <div className={styles.rescheduleInfoRow}>
                                    <span>Current schedule:</span>
                                    <span>{new Date(rescheduleTarget.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Consulting Doctor <span>*</span></label>
                                <select 
                                    value={rescheduleDoctorId}
                                    onChange={e => handleRescheduleDoctorChange(e.target.value)}
                                    required
                                >
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>New Date <span>*</span></label>
                                <input 
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={e => handleRescheduleDateChange(e.target.value)}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <div className={styles.slotSectionHeader}>
                                    <label style={{ margin: 0 }}>Select Time Slot <span>*</span></label>
                                    <div className={styles.slotLegend}>
                                        <span><span className={styles.slotLegendDot} style={{ background: "#0284c7" }}></span> Selected</span>
                                        <span><span className={styles.slotLegendDot} style={{ background: "#cbd5e1" }}></span> Booked</span>
                                    </div>
                                </div>
                                {loadingRescheduleSlots ? (
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>Checking doctor availability...</p>
                                ) : (
                                    <div className={styles.slotGrid}>
                                        {STANDARD_TIME_SLOTS.map(slot => {
                                            const isBooked = rescheduleBookedSlots.includes(slot);
                                            const isSelected = rescheduleSlot === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    disabled={isBooked}
                                                    onClick={() => setRescheduleSlot(slot)}
                                                    className={`
                                                        ${styles.slotButton} 
                                                        ${isSelected ? styles.slotButtonActive : ''} 
                                                        ${isBooked ? styles.slotButtonBooked : ''}
                                                    `}
                                                >
                                                    {slot}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.secondaryBtn} onClick={() => setShowRescheduleModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.primaryBtn} disabled={submittingReschedule} style={{ background: "#0284c7" }}>
                                    {submittingReschedule ? "Rescheduling..." : "Confirm Reschedule"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelModal && cancelTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowCancelModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className={styles.modalHeader}>
                            <h2 style={{ color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
                                <AlertTriangle size={20} color="#b91c1c" />
                                Cancel Appointment
                            </h2>
                            <button className={styles.closeBtn} onClick={() => setShowCancelModal(false)}>✕</button>
                        </div>
                        <div className={styles.dangerConfirmBox}>
                            <p style={{ margin: 0 }}>
                                Are you sure you want to cancel the appointment for <strong>{cancelTarget.patient?.name}</strong> with <strong>{cancelTarget.doctor?.name}</strong> scheduled on <strong>{new Date(cancelTarget.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</strong>?
                            </p>
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setShowCancelModal(false)}>
                                Keep Appointment
                            </button>
                            <button 
                                type="button" 
                                className={styles.cancelBtn} 
                                onClick={handleConfirmCancel}
                                disabled={submittingCancel}
                                style={{ padding: "8px 16px", fontSize: "13px" }}
                            >
                                {submittingCancel ? "Cancelling..." : "Yes, Cancel Appointment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {showBookingModal && (
                <div className={styles.modalOverlay} onClick={() => setShowBookingModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className={styles.modalHeader}>
                            <h2>Book Doctor Appointment</h2>
                            <button className={styles.closeBtn} onClick={() => setShowBookingModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateBooking} className={styles.modalForm}>
                            <div className={styles.formGroup}>
                                <label>Patient Name, Phone, or ID <span>*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Archana Ghugarkar or 9876543210"
                                    value={bookingForm.patientId}
                                    onChange={e => setBookingForm({ ...bookingForm, patientId: e.target.value })}
                                    required
                                />
                                <small style={{ fontSize: "11px", color: "#64748b" }}>
                                    Enter existing patient's name, phone, or ID. New patient names are auto-registered.
                                </small>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Select Doctor <span>*</span></label>
                                <select 
                                    value={bookingForm.doctorId}
                                    onChange={e => {
                                        const docId = e.target.value;
                                        setBookingForm({ ...bookingForm, doctorId: docId });
                                        loadBookingSlots(docId, bookingForm.date);
                                    }}
                                    required
                                >
                                    <option value="">-- Choose Doctor --</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Appointment Date <span>*</span></label>
                                <input 
                                    type="date" 
                                    value={bookingForm.date}
                                    onChange={e => {
                                        const d = e.target.value;
                                        setBookingForm({ ...bookingForm, date: d });
                                        loadBookingSlots(bookingForm.doctorId, d);
                                    }}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <div className={styles.slotSectionHeader}>
                                    <label style={{ margin: 0 }}>Available Time Slot <span>*</span></label>
                                    <div className={styles.slotLegend}>
                                        <span><span className={styles.slotLegendDot} style={{ background: "#0284c7" }}></span> Selected</span>
                                        <span><span className={styles.slotLegendDot} style={{ background: "#cbd5e1" }}></span> Booked</span>
                                    </div>
                                </div>
                                <div className={styles.slotGrid}>
                                    {STANDARD_TIME_SLOTS.map(slot => {
                                        const isBooked = bookingBookedSlots.includes(slot);
                                        const isSelected = bookingForm.slotTime === slot;
                                        return (
                                            <button
                                                key={slot}
                                                type="button"
                                                disabled={isBooked}
                                                onClick={() => setBookingForm(prev => ({ ...prev, slotTime: slot }))}
                                                className={`
                                                    ${styles.slotButton} 
                                                    ${isSelected ? styles.slotButtonActive : ''} 
                                                    ${isBooked ? styles.slotButtonBooked : ''}
                                                `}
                                            >
                                                {slot}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Reason for Visit</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Follow-up consultation, Fever"
                                    value={bookingForm.reason}
                                    onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.secondaryBtn} onClick={() => setShowBookingModal(false)}>Cancel</button>
                                <button type="submit" className={styles.primaryBtn} disabled={submittingBooking} style={{ background: "#0284c7" }}>
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
                    const slotDate = slotTime ? new Date(slotTime) : new Date();
                    const dateStr = slotDate.toISOString().split("T")[0];
                    const hours = String(slotDate.getHours()).padStart(2, "0");
                    const minutes = String(slotDate.getMinutes()).padStart(2, "0");
                    setBookingForm(prev => ({
                        ...prev,
                        doctorId: doc.id,
                        date: dateStr,
                        slotTime: `${hours}:${minutes}`,
                    }));
                    loadBookingSlots(doc.id, dateStr);
                    setShowBookingModal(true);
                }}
            />
        </motion.div>
    );
}
