import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Calendar, Clock, User, Stethoscope, CheckCircle2, 
    AlertCircle, Plus, X, RefreshCw, ChevronLeft, ChevronRight, Award 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchReceptionistAppointments } from "../services/api";
import toast from "react-hot-toast";
import styles from "./DoctorScheduleModal.module.css";

const STANDARD_TIME_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

export default function DoctorScheduleModal({ doctor, isOpen, onClose, onBookSlot }) {
    const { token } = useAuth();
    const todayStr = new Date().toISOString().split("T")[0];
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !doctor?.id) return;

        const loadSchedule = async () => {
            setLoading(true);
            try {
                const res = await fetchReceptionistAppointments({
                    doctorId: doctor.id,
                    date: selectedDate,
                }, token);

                if (res?.appointments) {
                    setAppointments(res.appointments);
                }
            } catch (err) {
                toast.error(err.message || "Failed to load doctor schedule.");
            } finally {
                setLoading(false);
            }
        };

        loadSchedule();
    }, [isOpen, doctor?.id, selectedDate, token]);

    // Map time slots to appointments
    const slotData = useMemo(() => {
        return STANDARD_TIME_SLOTS.map((slotTime) => {
            // Find appointment matching slot time
            const matchingAppt = appointments.find((a) => {
                const apptDate = new Date(a.scheduledAt);
                const hours = String(apptDate.getHours()).padStart(2, "0");
                const minutes = String(apptDate.getMinutes()).padStart(2, "0");
                const apptTimeStr = `${hours}:${minutes}`;
                return apptTimeStr === slotTime;
            });

            return {
                time: slotTime,
                isBooked: !!matchingAppt,
                appointment: matchingAppt || null,
            };
        });
    }, [appointments]);

    const bookedCount = slotData.filter((s) => s.isBooked).length;
    const availableCount = slotData.length - bookedCount;

    if (!isOpen || !doctor) return null;

    const docInitials = doctor.firstName
        ? `${doctor.firstName.charAt(0)}${doctor.lastName ? doctor.lastName.charAt(0) : ""}`.toUpperCase()
        : "DR";

    const handleShiftDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split("T")[0]);
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <motion.div 
                className={styles.modalContent} 
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
            >
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.doctorHeaderInfo}>
                        <div className={styles.doctorAvatar}>{docInitials}</div>
                        <div className={styles.doctorDetails}>
                            <h2>
                                <Stethoscope className="w-5 h-5 text-sky-600" />
                                {doctor.name || `Dr. ${doctor.firstName} ${doctor.lastName || ""}`}
                            </h2>
                            <div className={styles.doctorMeta}>
                                <span className={styles.specialtyBadge}>{doctor.specialization || "General Medicine"}</span>
                                {doctor.department && <span>· Dept: {doctor.department}</span>}
                                {doctor.registrationNumber && <span>· Reg: {doctor.registrationNumber}</span>}
                            </div>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Date Bar & Counters */}
                <div className={styles.controlBar}>
                    <div className={styles.datePickerGroup}>
                        <button 
                            className={styles.dateQuickBtn}
                            onClick={() => handleShiftDate(-1)}
                            title="Previous Day"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <button 
                            className={`${styles.dateQuickBtn} ${selectedDate === todayStr ? styles.dateQuickBtnActive : ""}`}
                            onClick={() => setSelectedDate(todayStr)}
                        >
                            Today
                        </button>

                        <input 
                            type="date" 
                            className={styles.dateInput}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />

                        <button 
                            className={styles.dateQuickBtn}
                            onClick={() => handleShiftDate(1)}
                            title="Next Day"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className={styles.statsChips}>
                        <span className={`${styles.chip} ${styles.chipBooked}`}>
                            {bookedCount} Booked
                        </span>
                        <span className={`${styles.chip} ${styles.chipAvailable}`}>
                            {availableCount} Slots Free
                        </span>
                    </div>
                </div>

                {/* Slots Grid */}
                <div className={styles.modalBody}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <RefreshCw className={`${styles.spinner} w-8 h-8`} />
                            <p>Loading doctor timetable...</p>
                        </div>
                    ) : (
                        <div className={styles.slotsGrid}>
                            {slotData.map(({ time, isBooked, appointment }) => {
                                const isConfirmed = appointment?.status === "confirmed";
                                const isCompleted = appointment?.status === "completed";
                                const isScheduled = appointment?.status === "scheduled";

                                return (
                                    <div 
                                        key={time} 
                                        className={`${styles.slotCard} ${
                                            !isBooked 
                                                ? styles.slotCardAvailable 
                                                : isConfirmed 
                                                ? styles.slotCardConfirmed 
                                                : isCompleted 
                                                ? styles.slotCardCompleted 
                                                : styles.slotCardBooked
                                        }`}
                                    >
                                        <div className={styles.slotHeader}>
                                            <span className={styles.slotTime}>
                                                <Clock size={14} className="text-slate-500" />
                                                {time}
                                            </span>
                                            <span className={`${styles.slotBadge} ${
                                                !isBooked 
                                                    ? styles.slotBadgeAvailable 
                                                    : isConfirmed 
                                                    ? styles.slotBadgeConfirmed 
                                                    : isCompleted 
                                                    ? styles.slotBadgeCompleted 
                                                    : styles.slotBadgeScheduled
                                            }`}>
                                                {!isBooked ? "Available" : isConfirmed ? "Checked In" : isCompleted ? "Completed" : "Scheduled"}
                                            </span>
                                        </div>

                                        {isBooked && appointment ? (
                                            <div className={styles.slotPatientInfo}>
                                                <strong className={styles.slotPatientName}>
                                                    {appointment.patient?.name || "Patient"}
                                                </strong>
                                                <small className={styles.slotReason}>
                                                    {appointment.reason || "Consultation"}
                                                </small>
                                                {appointment.patient?.phone && (
                                                    <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                                                        Tel: {appointment.patient.phone}
                                                    </small>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                <small style={{ color: "#64748b", fontSize: "0.8rem" }}>
                                                    Open for booking
                                                </small>
                                                {onBookSlot && (
                                                    <button 
                                                        className={styles.bookSlotBtn}
                                                        onClick={() => onBookSlot(doctor, `${selectedDate}T${time}`)}
                                                    >
                                                        <Plus size={13} />
                                                        Book Patient Here
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.modalFooter}>
                    <span className={styles.footerNote}>
                        30-minute OPD consultation time slots. Timetable syncs live with hospital bookings.
                    </span>
                    <button className={styles.closeFooterBtn} onClick={onClose}>
                        Close Timetable
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
