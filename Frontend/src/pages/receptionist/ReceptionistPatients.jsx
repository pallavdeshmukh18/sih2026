import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, UserPlus, Search, Phone, Mail, Calendar, 
    Activity, CheckCircle2, Plus, RefreshCw, FileText, 
    X, ShieldCheck, Stethoscope 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { 
    fetchReceptionistPatients, 
    registerWalkInPatient, 
    fetchPublicDoctors,
    createAppointment 
} from "../../services/api";
import toast from "react-hot-toast";
import styles from "./ReceptionistPatients.module.css";

export default function ReceptionistPatients() {
    const { token } = useAuth();
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Walk-in Registration Modal State
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        dateOfBirth: "",
        gender: "male",
        bloodGroup: "",
        abhaId: "",
        emergencyContactPhone: "",
        bookAppointment: true,
        doctorId: "",
        scheduledAt: new Date().toISOString().slice(0, 16),
        reason: "Walk-in Consultation",
    });
    const [submittingRegister, setSubmittingRegister] = useState(false);

    // Quick Book Modal for Existing Patient
    const [showBookModal, setShowBookModal] = useState(false);
    const [selectedPatientForBooking, setSelectedPatientForBooking] = useState(null);
    const [bookingForm, setBookingForm] = useState({
        doctorId: "",
        scheduledAt: new Date().toISOString().slice(0, 16),
        reason: "General Consultation",
    });
    const [submittingBooking, setSubmittingBooking] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [patientsRes, doctorsRes] = await Promise.all([
                fetchReceptionistPatients({ search: searchQuery.trim() || undefined }, token),
                fetchPublicDoctors(token).catch(() => ({ doctors: [] })),
            ]);

            if (patientsRes?.patients) {
                setPatients(patientsRes.patients);
            }
            if (doctorsRes?.doctors) {
                setDoctors(doctorsRes.doctors);
                if (doctorsRes.doctors.length > 0 && !registerForm.doctorId) {
                    setRegisterForm(prev => ({ ...prev, doctorId: doctorsRes.doctors[0].id }));
                }
            }
        } catch (err) {
            toast.error(err.message || "Failed to load patient directory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadData();
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (!registerForm.firstName || (!registerForm.phone && !registerForm.email)) {
            toast.error("Please provide first name and phone or email.");
            return;
        }

        setSubmittingRegister(true);
        try {
            const payload = {
                firstName: registerForm.firstName.trim(),
                lastName: registerForm.lastName.trim(),
                phone: registerForm.phone.trim() || undefined,
                email: registerForm.email.trim() || undefined,
                dateOfBirth: registerForm.dateOfBirth || undefined,
                gender: registerForm.gender,
                bloodGroup: registerForm.bloodGroup || undefined,
                abhaId: registerForm.abhaId.trim() || undefined,
                doctorId: registerForm.bookAppointment ? registerForm.doctorId : undefined,
                scheduledAt: registerForm.bookAppointment ? registerForm.scheduledAt : undefined,
                reason: registerForm.bookAppointment ? registerForm.reason : undefined,
            };

            const res = await registerWalkInPatient(payload, token);
            toast.success(res.message || "Walk-in patient registered successfully!");
            setShowRegisterModal(false);
            setRegisterForm({
                firstName: "",
                lastName: "",
                phone: "",
                email: "",
                dateOfBirth: "",
                gender: "male",
                bloodGroup: "",
                abhaId: "",
                emergencyContactPhone: "",
                bookAppointment: true,
                doctorId: doctors[0]?.id || "",
                scheduledAt: new Date().toISOString().slice(0, 16),
                reason: "Walk-in Consultation",
            });
            loadData();
        } catch (err) {
            toast.error(err.message || "Registration failed.");
        } finally {
            setSubmittingRegister(false);
        }
    };

    const handleQuickBookSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPatientForBooking || !bookingForm.doctorId || !bookingForm.scheduledAt) {
            toast.error("Please select a doctor and schedule time.");
            return;
        }

        setSubmittingBooking(true);
        try {
            await createAppointment({
                patientId: selectedPatientForBooking.id,
                doctorId: bookingForm.doctorId,
                scheduledAt: bookingForm.scheduledAt,
                reason: bookingForm.reason || "General Consultation",
            }, token);

            toast.success(`Appointment booked for ${selectedPatientForBooking.name}!`);
            setShowBookModal(false);
            setSelectedPatientForBooking(null);
            loadData();
        } catch (err) {
            toast.error(err.message || "Failed to book appointment.");
        } finally {
            setSubmittingBooking(false);
        }
    };

    const openBookingForPatient = (patient) => {
        setSelectedPatientForBooking(patient);
        setBookingForm({
            doctorId: doctors[0]?.id || "",
            scheduledAt: new Date().toISOString().slice(0, 16),
            reason: "Follow-up Consultation",
        });
        setShowBookModal(true);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleArea}>
                    <h1>
                        <Users className="w-7 h-7 text-sky-600" />
                        Patient Directory & Walk-in Desk
                    </h1>
                    <p>Register walk-in patients, manage health records, and schedule consultations.</p>
                </div>
                <div className={styles.headerActions}>
                    <button 
                        className={styles.secondaryBtn} 
                        onClick={loadData}
                        title="Refresh directory"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button 
                        className={styles.primaryBtn} 
                        onClick={() => setShowRegisterModal(true)}
                    >
                        <UserPlus className="w-4 h-4" />
                        Register Walk-In Patient
                    </button>
                </div>
            </div>

            {/* Metrics Banner */}
            <div className={styles.metricsRow}>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                        <Users className="w-5 h-5" />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricValue}>{patients.length}</span>
                        <span className={styles.metricLabel}>Total Registered</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.green}`}>
                        <Stethoscope className="w-5 h-5" />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricValue}>{doctors.length}</span>
                        <span className={styles.metricLabel}>On-Duty Doctors</span>
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.purple}`}>
                        <Activity className="w-5 h-5" />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricValue}>
                            {patients.reduce((acc, p) => acc + (p.totalAppointments || 0), 0)}
                        </span>
                        <span className={styles.metricLabel}>Total Consultations</span>
                    </div>
                </div>
            </div>

            {/* Control & Search Bar */}
            <div className={styles.controlBar}>
                <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
                    <Search className="w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by patient name, phone, email, or ABHA ID..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </form>
                <div className={styles.resultCount}>
                    Showing <strong>{patients.length}</strong> patient records
                </div>
            </div>

            {/* Directory Table */}
            <div className={styles.tableContainer}>
                {loading ? (
                    <div className={styles.loadingContainer}>
                        <RefreshCw className={`${styles.spinner} w-8 h-8`} />
                        <p>Loading patient directory...</p>
                    </div>
                ) : patients.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Users className={styles.emptyIcon} />
                        <h3>No patient records found</h3>
                        <p>No patients matched your search criteria. You can register a new walk-in patient anytime.</p>
                        <button 
                            className={styles.primaryBtn} 
                            onClick={() => setShowRegisterModal(true)}
                            style={{ marginTop: "0.5rem" }}
                        >
                            <UserPlus className="w-4 h-4" />
                            Register First Walk-In Patient
                        </button>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.patientTable}>
                            <thead>
                                <tr>
                                    <th>Patient Details</th>
                                    <th>Contact Info</th>
                                    <th>Demographics</th>
                                    <th>Consultations</th>
                                    <th>Registered Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p) => {
                                    const initials = `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "P";
                                    return (
                                        <tr key={p.id} className={styles.patientRow}>
                                            <td>
                                                <div className={styles.patientNameCell}>
                                                    <div className={styles.avatarCircle}>{initials}</div>
                                                    <div>
                                                        <div className={styles.patientMainName}>{p.name}</div>
                                                        {p.abhaId && (
                                                            <span className={styles.abhaTag}>
                                                                <ShieldCheck className="w-3 h-3" />
                                                                ABHA: {p.abhaId}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.contactCell}>
                                                    <span className={styles.contactPhone}>{p.phone || "No phone"}</span>
                                                    <span className={styles.contactEmail}>{p.email || "No email"}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div>
                                                    <span className={`${styles.genderBadge} ${p.gender === 'female' ? styles.genderFemale : p.gender === 'other' ? styles.genderOther : styles.genderMale}`}>
                                                        {p.gender || "unspecified"}
                                                    </span>
                                                    {p.bloodGroup && (
                                                        <span className={styles.bloodBadge}>{p.bloodGroup}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.visitsBadge}>
                                                    <Activity className="w-3.5 h-3.5 text-sky-600" />
                                                    {p.totalAppointments} Visits
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                                    {new Date(p.createdAt).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.actionCell}>
                                                    <button 
                                                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                                        onClick={() => openBookingForPatient(p)}
                                                        title="Schedule consultation"
                                                    >
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Book Visit
                                                    </button>
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

            {/* Modal 1: Register Walk-In Patient */}
            <AnimatePresence>
                {showRegisterModal && (
                    <div className={styles.modalBackdrop} onClick={() => setShowRegisterModal(false)}>
                        <motion.div 
                            className={styles.modalContent} 
                            onClick={(e) => e.stopPropagation()}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className={styles.modalHeader}>
                                <h2>
                                    <UserPlus className="w-5 h-5 text-sky-600" />
                                    Walk-In Patient Registration
                                </h2>
                                <button className={styles.closeBtn} onClick={() => setShowRegisterModal(false)}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleRegisterSubmit}>
                                <div className={styles.modalBody}>
                                    <div className={styles.formGrid}>
                                        <div className={styles.formGroup}>
                                            <label>First Name *</label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="e.g. Ramesh" 
                                                value={registerForm.firstName}
                                                onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Last Name</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Kumar" 
                                                value={registerForm.lastName}
                                                onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label>Phone Number *</label>
                                            <input 
                                                type="tel" 
                                                placeholder="e.g. 9876543210" 
                                                value={registerForm.phone}
                                                onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Email Address</label>
                                            <input 
                                                type="email" 
                                                placeholder="e.g. ramesh@gmail.com" 
                                                value={registerForm.email}
                                                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label>Date of Birth</label>
                                            <input 
                                                type="date" 
                                                value={registerForm.dateOfBirth}
                                                onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Gender</label>
                                            <select 
                                                value={registerForm.gender}
                                                onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                                            >
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label>Blood Group</label>
                                            <select 
                                                value={registerForm.bloodGroup}
                                                onChange={(e) => setRegisterForm({ ...registerForm, bloodGroup: e.target.value })}
                                            >
                                                <option value="">Unknown / Select</option>
                                                <option value="A+">A+</option>
                                                <option value="A-">A-</option>
                                                <option value="B+">B+</option>
                                                <option value="B-">B-</option>
                                                <option value="O+">O+</option>
                                                <option value="O-">O-</option>
                                                <option value="AB+">AB+</option>
                                                <option value="AB-">AB-</option>
                                            </select>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>ABHA ID (Ayushman Bharat)</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. 12-3456-7890-1234" 
                                                value={registerForm.abhaId}
                                                onChange={(e) => setRegisterForm({ ...registerForm, abhaId: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Instant Consultation Booking Toggle */}
                                    <div className={styles.appointmentToggleCard}>
                                        <div className={styles.toggleHeader}>
                                            <label className={styles.toggleLabel}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={registerForm.bookAppointment}
                                                    onChange={(e) => setRegisterForm({ ...registerForm, bookAppointment: e.target.checked })}
                                                    style={{ width: "18px", height: "18px", accentColor: "#16a34a" }}
                                                />
                                                <span>Instant OPD Check-In & Consultation</span>
                                            </label>
                                            <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 600 }}>
                                                Auto-Confirmed
                                            </span>
                                        </div>

                                        {registerForm.bookAppointment && (
                                            <div className={styles.formGrid} style={{ marginTop: "0.5rem" }}>
                                                <div className={styles.formGroup}>
                                                    <label>Assign Doctor *</label>
                                                    <select 
                                                        required
                                                        value={registerForm.doctorId}
                                                        onChange={(e) => setRegisterForm({ ...registerForm, doctorId: e.target.value })}
                                                    >
                                                        {doctors.map(d => (
                                                            <option key={d.id} value={d.id}>
                                                                Dr. {d.firstName} {d.lastName || ""} ({d.specialization || d.department || "General"})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className={styles.formGroup}>
                                                    <label>Time Slot</label>
                                                    <input 
                                                        type="datetime-local" 
                                                        required
                                                        value={registerForm.scheduledAt}
                                                        onChange={(e) => setRegisterForm({ ...registerForm, scheduledAt: e.target.value })}
                                                    />
                                                </div>

                                                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                                    <label>Chief Complaint / Reason</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. Acute high fever, cough since 2 days" 
                                                        value={registerForm.reason}
                                                        onChange={(e) => setRegisterForm({ ...registerForm, reason: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.modalFooter}>
                                    <button 
                                        type="button" 
                                        className={styles.secondaryBtn}
                                        onClick={() => setShowRegisterModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className={styles.primaryBtn}
                                        disabled={submittingRegister}
                                    >
                                        {submittingRegister ? (
                                            <>
                                                <RefreshCw className={`${styles.spinner} w-4 h-4`} />
                                                Registering...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                Register & Check-In
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal 2: Quick Book for Existing Patient */}
            <AnimatePresence>
                {showBookModal && selectedPatientForBooking && (
                    <div className={styles.modalBackdrop} onClick={() => setShowBookModal(false)}>
                        <motion.div 
                            className={styles.modalContent} 
                            onClick={(e) => e.stopPropagation()}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className={styles.modalHeader}>
                                <h2>
                                    <Calendar className="w-5 h-5 text-sky-600" />
                                    Book Visit for {selectedPatientForBooking.name}
                                </h2>
                                <button className={styles.closeBtn} onClick={() => setShowBookModal(false)}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleQuickBookSubmit}>
                                <div className={styles.modalBody}>
                                    <div className={styles.formGroup}>
                                        <label>Select Doctor *</label>
                                        <select 
                                            required
                                            value={bookingForm.doctorId}
                                            onChange={(e) => setBookingForm({ ...bookingForm, doctorId: e.target.value })}
                                        >
                                            {doctors.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    Dr. {d.firstName} {d.lastName || ""} ({d.specialization || d.department || "General"})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Date & Time Slot *</label>
                                        <input 
                                            type="datetime-local" 
                                            required
                                            value={bookingForm.scheduledAt}
                                            onChange={(e) => setBookingForm({ ...bookingForm, scheduledAt: e.target.value })}
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Consultation Reason / Symptoms</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Regular follow-up, BP check" 
                                            value={bookingForm.reason}
                                            onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.modalFooter}>
                                    <button 
                                        type="button" 
                                        className={styles.secondaryBtn}
                                        onClick={() => setShowBookModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className={styles.primaryBtn}
                                        disabled={submittingBooking}
                                    >
                                        {submittingBooking ? "Booking..." : "Confirm Appointment"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
