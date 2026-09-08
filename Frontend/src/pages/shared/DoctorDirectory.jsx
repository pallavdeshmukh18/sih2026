import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Calendar, Clock, Search, CheckCircle, AlertCircle, X, Building2, Award } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { fetchPublicDoctors, createAppointment } from "../../services/api";
import DoctorScheduleModal from "../../components/DoctorScheduleModal";
import styles from "./DoctorDirectory.module.css";

export default function DoctorDirectory() {
  const { token, user } = useAuth();
  const { t } = useLanguage();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [appointmentType, setAppointmentType] = useState("in_person");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Fetch real verified doctors on mount
  useEffect(() => {
    const loadDoctors = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchPublicDoctors(token);
        if (res && res.doctors) {
          setDoctors(res.doctors);
        }
      } catch (err) {
        console.error("Failed to load doctor directory:", err);
        setError("Unable to load medical professionals. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadDoctors();
  }, [token]);

  // Client-side filtering by name, specialty, or department
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase();
    return doctors.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        (doc.specialization && doc.specialization.toLowerCase().includes(q)) ||
        (doc.department && doc.department.toLowerCase().includes(q))
    );
  }, [doctors, searchQuery]);

  // Open Booking Modal for selected doctor
  const handleOpenBooking = (doc) => {
    setSelectedDoctor(doc);
    setBookingError("");
    setBookingSuccess(null);
    
    // Default to tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    // Format YYYY-MM-DDTHH:mm for datetime-local input
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);
    setAppointmentType("in_person");
    setReason("General Clinical Consultation");
    setNotes("");
  };

  // Submit Booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !scheduledAt) return;

    setIsBooking(true);
    setBookingError("");

    try {
      const payload = {
        doctorId: selectedDoctor.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: 30,
        appointmentType,
        reason,
        notes,
      };

      const res = await createAppointment(payload, token);
      if (res && res.success) {
        setBookingSuccess({
          doctorName: selectedDoctor.name,
          date: new Date(scheduledAt).toLocaleString(),
          appointmentId: res.appointment?.id,
        });
        setSelectedDoctor(null);
      }
    } catch (err) {
      console.error("Booking error:", err);
      setBookingError(err.message || "Failed to book appointment. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.headerTitle}>{t("doctors.title")}</h1>
            <p className={styles.headerSubtitle}>
              {t("doctors.subtitle")}
            </p>
          </div>

          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("doctors.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Booking Success Banner */}
        {bookingSuccess && (
          <div className={styles.bannerSuccess} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={20} color="#166534" />
              <div>
                <strong>Appointment Booked Successfully!</strong>
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  Scheduled with <strong>{bookingSuccess.doctorName}</strong> on {bookingSuccess.date}. It will appear on your Dashboard.
                </div>
              </div>
            </div>
            <button
              onClick={() => setBookingSuccess(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#166534" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Directory States */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={styles.doctorCard} style={{ opacity: 0.6 }}>
                <div className={styles.avatar} style={{ background: "#e2e8f0", border: "none" }} />
                <div style={{ width: "120px", height: "16px", background: "#cbd5e1", borderRadius: "4px", marginBottom: "8px" }} />
                <div style={{ width: "90px", height: "12px", background: "#e2e8f0", borderRadius: "4px", marginBottom: "16px" }} />
                <div style={{ width: "100%", height: "36px", background: "#f1f5f9", borderRadius: "10px" }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <AlertCircle size={32} color="#dc2626" style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a" }}>{error}</div>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: "14px", background: "#0d9488", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className={styles.emptyState}>
            <Stethoscope size={36} color="#94a3b8" style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a" }}>
              {searchQuery ? "No doctors match your search query." : "No verified doctors are currently available."}
            </div>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Please check back later or refine your search terms.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredDoctors.map((doc) => {
              const docInitials = doc.firstName
                ? `${doc.firstName.charAt(0)}${doc.lastName ? doc.lastName.charAt(0) : ""}`.toUpperCase()
                : "DR";

              return (
                <div key={doc.id} className={styles.doctorCard}>
                  <div className={styles.avatar}>{docInitials}</div>
                  <h3 className={styles.docName}>{doc.name}</h3>

                  <div className={styles.specialtyBadge}>
                    <Stethoscope size={14} />
                    <span>{doc.specialization}</span>
                  </div>

                  <div className={styles.metaRow}>
                    {doc.department && (
                      <div style={{ display: "flex", alignItems: "center", justifyCenter: "center", gap: "4px" }}>
                        <Building2 size={13} /> {doc.department}
                      </div>
                    )}
                    {doc.registrationNumber && (
                      <div style={{ display: "flex", alignItems: "center", justifyCenter: "center", gap: "4px" }}>
                        <Award size={13} /> Reg: {doc.registrationNumber}
                      </div>
                    )}
                    <div className={styles.verifiedChip}>
                      <CheckCircle size={12} /> Verified Practitioner
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    <button
                      className={styles.bookBtn}
                      style={{ background: "#ffffff", color: "#0284c7", border: "1px solid #0284c7" }}
                      onClick={() => setScheduleDoctor(doc)}
                      title="View booked and available time slots"
                    >
                      <Clock size={15} />
                      Schedule
                    </button>
                    <button
                      className={styles.bookBtn}
                      onClick={() => handleOpenBooking(doc)}
                    >
                      <Calendar size={15} />
                      Book Visit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Appointment Booking Modal */}
      <AnimatePresence>
        {selectedDoctor && (
          <div className={styles.modalBackdrop} onClick={() => setSelectedDoctor(null)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700", fontFamily: "Playfair Display, serif" }}>
                    Book Appointment
                  </h3>
                  <div style={{ fontSize: "13px", color: "#0d9488", fontWeight: "600", marginTop: "2px" }}>
                    {selectedDoctor.name} ({selectedDoctor.specialization})
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDoctor(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>

              {bookingError && (
                <div className={styles.bannerError} style={{ marginBottom: "14px" }}>
                  {bookingError}
                </div>
              )}

              <form onSubmit={handleConfirmBooking} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label className={styles.label}>Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Consultation Type</label>
                  <select
                    className={styles.select}
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                  >
                    <option value="in_person">In-Person Consultation</option>
                    <option value="teleconsultation">Teleconsultation / Virtual</option>
                  </select>
                </div>

                <div>
                  <label className={styles.label}>Reason for Visit</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Fever, cough, general checkup"
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Additional Notes (Optional)</label>
                  <textarea
                    className={styles.textarea}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe any symptoms or relevant medical context for the doctor..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDoctor(null)}
                    style={{ background: "#e2e8f0", border: "none", padding: "10px 18px", borderRadius: "10px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.confirmBtn}
                    disabled={isBooking}
                  >
                    {isBooking ? "Booking..." : "Confirm & Book"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Doctor Live Schedule Modal */}
      <DoctorScheduleModal
        doctor={scheduleDoctor}
        isOpen={!!scheduleDoctor}
        onClose={() => setScheduleDoctor(null)}
        onBookSlot={(doc, slotTime) => {
          setScheduleDoctor(null);
          setSelectedDoctor(doc);
          setScheduledAt(slotTime);
        }}
      />
    </div>
  );
}
