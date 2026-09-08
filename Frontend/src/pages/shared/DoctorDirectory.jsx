import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Stethoscope, 
  Calendar, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Building2, 
  Award, 
  Bot, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { 
  fetchPublicDoctors, 
  createAppointment, 
  startClinicalSession, 
  sendClinicalTextTurn, 
  finalizeClinicalSession,
  getAvailableAppointmentSlots 
} from "../../services/api";
import DoctorScheduleModal from "../../components/DoctorScheduleModal";
import styles from "./DoctorDirectory.module.css";

const PRESET_CONCERNS = [
  "Fever & Body Ache",
  "Persistent Cough & Cold",
  "Severe Headache",
  "Stomach Pain & Nausea",
  "Joint / Back Pain",
  "General Wellness Checkup",
];

const formatSlotTime12 = (slot) => {
  if (!slot) return "";
  if (slot.time12) return slot.time12;
  const timeStr = slot.time24 || slot.time;
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, "0")}:${m} ${period}`;
};

export default function DoctorDirectory() {
  const { token, user } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Booking Guided Modal State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [bookingStep, setBookingStep] = useState(1); // 1: Reason, 2: AI Intake, 3: Date/Slot, 4: Confirm, 5: Done

  // Form Fields
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [appointmentType, setAppointmentType] = useState("in_person");

  // AI Intake State
  const [sessionId, setSessionId] = useState(null);
  const [clinicalSession, setClinicalSession] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [customTurnText, setCustomTurnText] = useState("");
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [assessmentFinalized, setAssessmentFinalized] = useState(false);

  // Slot Selection State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Booking Execution State
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

  // Fetch available slots when doctor and date change in step 3
  useEffect(() => {
    if (selectedDoctor && bookingStep === 3 && selectedDate) {
      const fetchSlots = async () => {
        setSlotsLoading(true);
        setSelectedSlot(null);
        try {
          const res = await getAvailableAppointmentSlots(selectedDoctor.id, selectedDate, token);
          if (res && res.success && res.slots) {
            setAvailableSlots(res.slots);
            // Default to first available slot if any
            const firstAvailable = res.slots.find((s) => s.available);
            if (firstAvailable) {
              setSelectedSlot(firstAvailable);
            }
          }
        } catch (err) {
          console.error("Error fetching slots:", err);
        } finally {
          setSlotsLoading(false);
        }
      };

      fetchSlots();
    }
  }, [selectedDoctor, bookingStep, selectedDate, token]);

  // Open Booking Modal for selected doctor
  const handleOpenBooking = (doc) => {
    setSelectedDoctor(doc);
    setBookingStep(1);
    setReason("");
    setNotes("");
    setAppointmentType("in_person");
    setSessionId(null);
    setClinicalSession(null);
    setSelectedOption("");
    setCustomTurnText("");
    setAssessmentFinalized(false);
    setBookingError("");
    setBookingSuccess(null);
    setSelectedSlot(null);

    const today = new Date();
    setSelectedDate(today.toISOString().split("T")[0]);
  };

  // Step 1 -> Step 2: Start AI Assessment
  const handleStartAiAssessment = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsAssessmentLoading(true);
    setBookingError("");

    try {
      const res = await startClinicalSession(
        {
          chiefComplaint: reason.trim(),
          language: currentLanguage || "en",
        },
        token
      );

      const activeId = res?.sessionId || res?.session?.id;
      if (res && res.success && activeId) {
        setSessionId(activeId);
        
        const qText = res.nextQuestion || res.session?.current_state?.current_question || res.session?.current_question || `How long have you been experiencing ${reason.trim()}?`;
        const rawOpts = res.options || res.session?.current_state?.current_options || res.session?.current_options || [];
        const formattedOpts = Array.isArray(rawOpts)
          ? rawOpts.map(o => typeof o === 'string' ? o : o.label || o.id)
          : [];

        setClinicalSession({
          id: activeId,
          chief_complaint: reason.trim(),
          current_question: qText,
          current_options: formattedOpts,
          ...res.session,
        });
        setBookingStep(2);
      } else {
        setBookingError(res?.message || "Failed to initialize AI clinical assessment. Please try again.");
      }
    } catch (err) {
      console.error("Failed to start clinical session:", err);
      setBookingError(err.message || "Failed to start AI clinical intake session.");
    } finally {
      setIsAssessmentLoading(false);
    }
  };

  // Step 2: Submit Turn in AI Assessment
  const handleSubmitTurn = async (textToSend) => {
    const text = textToSend || selectedOption || customTurnText;
    if (!text || !sessionId) return;

    setIsAssessmentLoading(true);
    setBookingError("");

    try {
      const res = await sendClinicalTextTurn(sessionId, text, token);
      if (res && res.success) {
        const nextQ = res.nextQuestion || res.session?.current_question;
        const rawOpts = res.options || res.session?.current_options || [];
        const formattedOpts = Array.isArray(rawOpts)
          ? rawOpts.map(o => typeof o === 'string' ? o : o.label || o.id)
          : [];
        const isComp = res.isComplete || res.is_complete || res.session?.is_complete;

        setClinicalSession((prev) => ({
          ...prev,
          current_question: nextQ || prev?.current_question,
          current_options: formattedOpts.length > 0 ? formattedOpts : prev?.current_options,
          is_complete: isComp,
        }));
        setSelectedOption("");
        setCustomTurnText("");

        if (isComp) {
          await handleFinalizeAssessment(sessionId);
        }
      }
    } catch (err) {
      console.error("Error sending turn:", err);
      setBookingError("Failed to submit answer. Please try again.");
    } finally {
      setIsAssessmentLoading(false);
    }
  };

  // Step 2: Finalize Assessment & Move to Date Selection
  const handleFinalizeAssessment = async (explicitSessionId = null) => {
    const activeId = explicitSessionId || sessionId;
    if (!activeId) return;

    setIsAssessmentLoading(true);
    setBookingError("");

    try {
      const res = await finalizeClinicalSession(activeId, null, token);
      if (res && res.success) {
        setAssessmentFinalized(true);
        if (res.session) {
          setClinicalSession(res.session);
        }
        setBookingStep(3);
      }
    } catch (err) {
      console.error("Error finalizing assessment:", err);
      setAssessmentFinalized(true);
      setBookingStep(3);
    } finally {
      setIsAssessmentLoading(false);
    }
  };

  // Step 4: Confirm Final Booking
  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot || !sessionId) {
      setBookingError("Please complete all steps including slot selection and AI assessment.");
      return;
    }

    setIsBooking(true);
    setBookingError("");

    try {
      const timeVal = selectedSlot.time24 || selectedSlot.time;
      const scheduledAt = selectedSlot.scheduledAt || `${selectedDate}T${timeVal}:00.000Z`;

      const payload = {
        doctorId: selectedDoctor.id,
        scheduledAt,
        durationMinutes: 30,
        appointmentType,
        reason,
        notes,
        sessionId,
      };

      const res = await createAppointment(payload, token);
      if (res && res.success) {
        setBookingSuccess({
          doctorName: selectedDoctor.name,
          date: `${selectedDate} at ${formatSlotTime12(selectedSlot)}`,
          appointmentId: res.appointment?.id,
        });
        setBookingStep(5);
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
            <p className={styles.headerSubtitle}>{t("doctors.subtitle")}</p>
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        <Building2 size={13} /> {doc.department}
                      </div>
                    )}
                    {doc.registrationNumber && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
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

      {/* Guided Appointment Booking Modal */}
      <AnimatePresence>
        {selectedDoctor && (
          <div className={styles.modalBackdrop} onClick={() => setSelectedDoctor(null)}>
            <motion.div
              className={styles.modalContent}
              style={{ maxWidth: "560px", padding: "24px" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                      STEP {bookingStep} OF 4
                    </span>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", fontFamily: "Playfair Display, serif" }}>
                      {bookingStep === 1 && "State Health Concern"}
                      {bookingStep === 2 && "Pre-Consultation AI Assessment"}
                      {bookingStep === 3 && "Select Date & Time Slot"}
                      {bookingStep === 4 && "Confirm Appointment"}
                      {bookingStep === 5 && "Appointment Confirmed"}
                    </h3>
                  </div>
                  <div style={{ fontSize: "13px", color: "#0d9488", fontWeight: "600", marginTop: "4px" }}>
                    Doctor: {selectedDoctor.name} ({selectedDoctor.specialization})
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDoctor(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Indicator */}
              {bookingStep <= 4 && (
                <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: "4px",
                        borderRadius: "2px",
                        background: step <= bookingStep ? "#0d9488" : "#e2e8f0",
                        transition: "all 0.2s ease",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Error Banner */}
              {bookingError && (
                <div className={styles.bannerError} style={{ marginBottom: "16px" }}>
                  {bookingError}
                </div>
              )}

              {/* ================= STEP 1: Health Concern ================= */}
              {bookingStep === 1 && (
                <form onSubmit={handleStartAiAssessment} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label className={styles.label}>What is your primary health concern / reason for visit?</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. High fever with sore throat since yesterday"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className={styles.label} style={{ fontSize: "12px", color: "#64748b" }}>Or select a common concern:</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                      {PRESET_CONCERNS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setReason(item)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "500",
                            border: reason === item ? "1px solid #0d9488" : "1px solid #cbd5e1",
                            background: reason === item ? "#f0fdf4" : "#ffffff",
                            color: reason === item ? "#0d9488" : "#475569",
                            cursor: "pointer",
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b" }}>
                    <div style={{ fontWeight: "600", color: "#0f172a", marginBottom: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={14} color="#0d9488" /> Why AI Intake is required:
                    </div>
                    MediKiosk runs a brief, adaptive AI clinical assessment before your visit so Dr. {selectedDoctor.name} receives structured symptom history prior to consultation.
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
                      disabled={!reason.trim() || isAssessmentLoading}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {isAssessmentLoading ? "Initializing Intake..." : "Begin AI Intake"}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* ================= STEP 2: AI Clinical Intake Assessment ================= */}
              {bookingStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #ccfbf1", padding: "12px 14px", borderRadius: "12px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <Bot size={22} color="#0d9488" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>Pre-Consultation Clinical Intake</strong>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#475569" }}>
                        Please answer the following targeted questions to provide clear clinical context for your doctor.
                      </p>
                    </div>
                  </div>

                  {/* Current AI Question Card */}
                  <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "14px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Clinical Intake Question
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "14px" }}>
                      {clinicalSession?.current_question || clinicalSession?.nextQuestion || "How would you describe the onset and intensity of your concern?"}
                    </div>

                    {/* Dynamic Localized Options */}
                    {Array.isArray(clinicalSession?.current_options) && clinicalSession.current_options.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {clinicalSession.current_options.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedOption(opt);
                              handleSubmitTurn(opt);
                            }}
                            disabled={isAssessmentLoading}
                            style={{
                              textAlign: "left",
                              padding: "10px 14px",
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: "500",
                              border: selectedOption === opt ? "2px solid #0d9488" : "1px solid #e2e8f0",
                              background: selectedOption === opt ? "#f0fdf4" : "#f8fafc",
                              color: "#0f172a",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Custom Text Answer Field */}
                    <div style={{ marginTop: "14px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "4px", display: "block" }}>
                        Or type your detailed response:
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          className={styles.input}
                          value={customTurnText}
                          onChange={(e) => setCustomTurnText(e.target.value)}
                          placeholder="Type response here..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSubmitTurn();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.confirmBtn}
                          onClick={() => handleSubmitTurn()}
                          disabled={!customTurnText.trim() || isAssessmentLoading}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Complete / Finalize Action */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setBookingStep(1)}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <ArrowLeft size={14} /> Back
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFinalizeAssessment()}
                      disabled={isAssessmentLoading}
                      style={{
                        background: "#166534",
                        color: "white",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {isAssessmentLoading ? "Processing..." : "Complete Assessment & Choose Time"}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ================= STEP 3: Date & Slot Selection ================= */}
              {bookingStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.label}>Select Date</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={selectedDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className={styles.label}>Consultation Format</label>
                      <select
                        className={styles.select}
                        value={appointmentType}
                        onChange={(e) => setAppointmentType(e.target.value)}
                      >
                        <option value="in_person">In-Person Consultation</option>
                        <option value="teleconsultation">Teleconsultation (Virtual)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={styles.label} style={{ marginBottom: "8px" }}>
                      Available Time Slots ({selectedDate})
                    </label>

                    {slotsLoading ? (
                      <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: "13px" }}>
                        Loading available slots...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: "12px", color: "#64748b", fontSize: "13px" }}>
                        No slots available on this date. Please select another date.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
                        {availableSlots.map((slot, index) => {
                          const slotKey = slot.time24 || slot.time || index;
                          const timeDisplay = formatSlotTime12(slot);
                          const isSelected = selectedSlot && (selectedSlot.time24 || selectedSlot.time) === (slot.time24 || slot.time);
                          return (
                            <button
                              key={slotKey}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedSlot(slot)}
                              style={{
                                padding: "10px 8px",
                                borderRadius: "10px",
                                fontSize: "13px",
                                fontWeight: "600",
                                border: isSelected ? "2px solid #0d9488" : "1px solid #cbd5e1",
                                background: !slot.available
                                  ? "#f1f5f9"
                                  : isSelected
                                  ? "#f0fdf4"
                                  : "#ffffff",
                                color: !slot.available
                                  ? "#94a3b8"
                                  : isSelected
                                  ? "#0d9488"
                                  : "#0f172a",
                                cursor: slot.available ? "pointer" : "not-allowed",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "2px",
                              }}
                            >
                              <span style={{ fontSize: "13px", fontWeight: "700", color: isSelected ? "#0d9488" : "#0f172a" }}>
                                {timeDisplay}
                              </span>
                              <span style={{ fontSize: "10px", color: !slot.available ? "#94a3b8" : isSelected ? "#0d9488" : "#64748b", fontWeight: "400" }}>
                                {slot.available ? "Available" : "Booked"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setBookingStep(2)}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <ArrowLeft size={14} /> Back to Intake
                    </button>

                    <button
                      type="button"
                      className={styles.confirmBtn}
                      disabled={!selectedSlot}
                      onClick={() => setBookingStep(4)}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      Review & Confirm <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ================= STEP 4: Confirmation & Submit ================= */}
              {bookingStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "14px", padding: "16px" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Appointment Summary
                    </h4>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#334155" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Doctor:</span>
                        <strong>{selectedDoctor.name} ({selectedDoctor.specialization})</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Date & Time:</span>
                        <strong>{selectedDate} at {selectedSlot?.time12}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Format:</span>
                        <strong style={{ textTransform: "capitalize" }}>{appointmentType.replace("_", " ")}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Reason for Visit:</span>
                        <strong>{reason}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <span style={{ color: "#64748b" }}>AI Intake Status:</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#166534", fontSize: "12px", fontWeight: "600", background: "#f0fdf4", padding: "2px 8px", borderRadius: "8px" }}>
                          <CheckCircle2 size={14} /> Completed & Linked
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={styles.label}>Additional Notes for Doctor (Optional)</label>
                    <textarea
                      className={styles.textarea}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any specific requests or details..."
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setBookingStep(3)}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <ArrowLeft size={14} /> Change Time Slot
                    </button>

                    <button
                      type="button"
                      className={styles.confirmBtn}
                      onClick={handleConfirmBooking}
                      disabled={isBooking}
                      style={{ background: "#0d9488", padding: "12px 24px" }}
                    >
                      {isBooking ? "Confirming Booking..." : "Confirm & Book Visit"}
                    </button>
                  </div>
                </div>
              )}

              {/* ================= STEP 5: Success Confirmation ================= */}
              {bookingStep === 5 && bookingSuccess && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#f0fdf4", color: "#166534", display: "grid", placeItems: "center", margin: "0 auto 16px auto", border: "2px solid #bbf7d0" }}>
                    <CheckCircle size={32} />
                  </div>

                  <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: "0 0 6px 0", fontFamily: "Playfair Display, serif" }}>
                    Appointment Confirmed!
                  </h3>
                  <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 20px 0" }}>
                    Your visit with <strong>{bookingSuccess.doctorName}</strong> is scheduled for <strong>{bookingSuccess.date}</strong>.
                  </p>

                  <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                    <button
                      onClick={() => setSelectedDoctor(null)}
                      style={{ background: "#e2e8f0", border: "none", padding: "10px 18px", borderRadius: "10px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDoctor(null);
                        navigate("/patient/appointments");
                      }}
                      className={styles.confirmBtn}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Calendar size={15} /> View My Appointments
                    </button>
                  </div>
                </div>
              )}
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

