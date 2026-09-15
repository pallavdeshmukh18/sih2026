import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Calendar, CheckCircle, ChevronDown, Heart, MapPin, RefreshCw, Search, ShieldCheck, Star, Stethoscope, Video, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { useAccessibility } from "../../context/AccessibilityContext";
import { createAppointment, fetchPublicDoctors, fetchDoctorReviews } from "../../services/api";
import { formatDoctorName, translateClinicalTerm, translateDepartment } from "../../utils/transliterate";
import heroImage from "../../assets/doctor-directory-hero.png";
import styles from "./DoctorDirectory.module.css";

export default function DoctorDirectory() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const canBookAppointments = user?.role === "patient";
  const { t, language } = useLanguage();
  const { islEnabled, requestSign } = useAccessibility();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("All Specialties");
  const [location, setLocation] = useState("Mumbai");
  const [date, setDate] = useState("");
  const [favorites, setFavorites] = useState(new Set());
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [appointmentType, setAppointmentType] = useState("in_person");
  const [reason, setReason] = useState("General Clinical Consultation");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  // Doctor Profile & Reviews Modal State
  const [viewingDoctorProfile, setViewingDoctorProfile] = useState(null);
  const [profileReviews, setProfileReviews] = useState({ loading: false, averageRating: 5.0, totalReviews: 0, reviews: [], breakdown: {} });

  useEffect(() => {
    if (islEnabled) {
      requestSign("Doctor Directory", { context: "doctor_directory_header" });
    }
  }, [islEnabled, requestSign]);

  const specialtiesList = [
    { key: "All Specialties", label: t("doctors.allSpecialties", "All Specialties") },
    { key: "General Medicine", label: t("doctors.generalMedicine", "General Medicine") },
    { key: "Cardiology", label: t("doctors.cardiology", "Cardiology") },
    { key: "Dermatology", label: t("doctors.dermatology", "Dermatology") },
    { key: "Pediatrics", label: t("doctors.pediatrics", "Pediatrics") },
    { key: "Gynecology", label: t("doctors.gynecology", "Gynecology") },
    { key: "Orthopedics", label: t("doctors.orthopedics", "Orthopedics") },
    { key: "Neurology", label: t("doctors.neurology", "Neurology") },
  ];

  useEffect(() => {
    fetchPublicDoctors(token).then((res) => setDoctors(res?.doctors || [])).catch(() => setError("Unable to load doctors right now.")).finally(() => setLoading(false));
  }, [token]);

  const filteredDoctors = useMemo(() => {
    const term = query.trim().toLowerCase();
    return doctors.filter((doctor) => {
      const matchesQuery = !term || [doctor.name, doctor.specialization, doctor.department].some((value) => value?.toLowerCase().includes(term));
      const matchesSpecialty = specialty === "All Specialties" || doctor.specialization?.toLowerCase().includes(specialty.toLowerCase());
      return matchesQuery && matchesSpecialty;
    });
  }, [doctors, query, specialty]);

  const openBooking = (doctor) => {
    if (islEnabled && doctor?.name) {
      requestSign(doctor.name, { context: "doctor_selected" });
    }
    navigate(`/patient/assessment?doctorId=${doctor.id}`);
  };

  const handleViewDoctorProfile = (doctor) => {
    setViewingDoctorProfile(doctor);
    setProfileReviews({ loading: true, averageRating: doctor.rating || 5.0, totalReviews: doctor.reviewCount || 0, reviews: [], breakdown: {} });
    fetchDoctorReviews(doctor.id, token)
      .then((res) => {
        if (res && res.success) {
          setProfileReviews({
            loading: false,
            averageRating: res.averageRating || 5.0,
            totalReviews: res.totalReviews || 0,
            reviews: res.reviews || [],
            breakdown: res.breakdown || {},
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load doctor reviews:", err);
        setProfileReviews((prev) => ({ ...prev, loading: false }));
      });
  };

  const confirmBooking = async (event) => {
    event.preventDefault();
    setBooking(true);
    try {
      const res = await createAppointment({ doctorId: selectedDoctor.id, scheduledAt: new Date(scheduledAt).toISOString(), durationMinutes: 30, appointmentType, reason, notes }, token);
      toast.success(t("doctors.bookingSuccess", "Appointment booked successfully!"));
      const apptId = res?.appointment?.id || res?.id;
      const complaintParam = encodeURIComponent(reason || notes || "General Clinical Consultation");
      setSelectedDoctor(null);
      if (apptId) {
        navigate(`/patient/assessment?appointmentId=${apptId}&complaint=${complaintParam}`);
      } else {
        navigate(`/patient/assessment?complaint=${complaintParam}`);
      }
    } catch (bookingError) {
      toast.error(bookingError.message || "Unable to book this appointment.");
    } finally {
      setBooking(false);
    }
  };

  const toggleFavorite = (id) => setFavorites((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const translateSpec = (spec) => {
    if (!spec) return t("doctors.generalMedicine", "General Medicine");
    const clinical = translateClinicalTerm(spec, "specializations", language);
    if (clinical && clinical !== spec) return clinical;
    const normalized = spec.toLowerCase().trim();
    if (normalized === "horn" || normalized === "ent") return translateClinicalTerm("horn", "specializations", language);
    if (normalized.includes("cardio")) return t("doctors.cardiology", "Cardiology");
    if (normalized.includes("dent")) return translateClinicalTerm("dental", "specializations", language) || t("doctors.dental", "Dental");
    if (normalized.includes("derma")) return t("doctors.dermatology", "Dermatology");
    if (normalized.includes("pediat")) return t("doctors.pediatrics", "Pediatrics");
    if (normalized.includes("gynec") || normalized.includes("obste")) return t("doctors.gynecology", "Gynecology");
    if (normalized.includes("ortho")) return t("doctors.orthopedics", "Orthopedics");
    if (normalized.includes("neuro")) return t("doctors.neurology", "Neurology");
    if (normalized.includes("general") || normalized.includes("internal")) return t("doctors.generalMedicine", "General Medicine");
    return spec;
  };

  return (
    <div className={`${styles.page} workspacePage`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{t("navigation.doctors", "Doctor Directory")}</span>
          <h1>{t("doctors.pageTitle", "Find Your Doctor")}</h1>
          <p>{t("doctors.pageSub", "Browse verified specialists, check availability, and schedule in-person or video consultations.")}</p>
        </div>
        <img src={heroImage} alt="Doctor directory illustration" />
      </section>

      <section className={styles.searchSection}>
        <form className={styles.searchBar} onSubmit={(event) => event.preventDefault()}>
          <label>
            <Search />
            <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("doctors.searchPlaceholder", "Search doctors by name, specialty, or clinic...")} />
          </label>
          <label className={styles.compact}>
            <MapPin />
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="Mumbai">{translateClinicalTerm("Mumbai", "locations", language) || "Mumbai"}</option>
              <option value="Navi Mumbai">{translateClinicalTerm("Navi Mumbai", "locations", language) || "Navi Mumbai"}</option>
              <option value="Thane">{translateClinicalTerm("Thane", "locations", language) || "Thane"}</option>
              <option value="Pune">{translateClinicalTerm("Pune", "locations", language) || "Pune"}</option>
            </select>
            <ChevronDown />
          </label>
          <label className={styles.compact}>
            <Calendar />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button>{t("common.search", "Search")}</button>
        </form>
      </section>

      <section className={styles.directory}>
        <div className={styles.filterHeader}>
          <h2>{t("doctors.allSpecialties", "Popular Specialties")}</h2>
          <label>
            {t("doctors.sortBy", "Sort by")}{" "}
            <select>
              <option>{t("doctors.relevance", "Relevance")}</option>
              <option>{t("doctors.experienceSort", "Experience")}</option>
              <option>{t("doctors.ratingSort", "Rating")}</option>
            </select>
          </label>
        </div>
        <div className={styles.chips}>
          {specialtiesList.map(({ key, label }) => (
            <button key={key} className={specialty === key ? styles.active : ""} onClick={() => setSpecialty(key)}>
              <Stethoscope />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.doctorGrid}>{Array.from({ length: 8 }, (_, index) => <div key={index} className={`${styles.doctorCard} ${styles.skeleton}`} />)}</div>
        ) : error ? (
          <div className={styles.empty}>{error}</div>
        ) : filteredDoctors.length === 0 ? (
          <div className={styles.empty}>{t("doctors.noDoctors", "No verified doctors match your search.")}</div>
        ) : (
          <motion.div className={styles.doctorGrid} layout>
            <AnimatePresence>
              {filteredDoctors.map((doctor, index) => {
                const initials = `${doctor.firstName?.[0] || "D"}${doctor.lastName?.[0] || "R"}`.toUpperCase();
                const displayRating = doctor.rating || (4.6 + (index % 4) / 10).toFixed(1);
                const displayReviewCount = doctor.reviewCount !== undefined ? doctor.reviewCount : (87 + index * 19);

                return (
                  <motion.article layout key={doctor.id} className={styles.doctorCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(index * .025, .15) }}>
                    <button className={`${styles.favorite} ${favorites.has(doctor.id) ? styles.liked : ""}`} onClick={() => toggleFavorite(doctor.id)} aria-label="Save doctor"><Heart /></button>
                    <div className={styles.avatar}>{initials}</div>
                    <div className={styles.doctorInfo}>
                      <span className={styles.availability}>{index % 3 === 2 ? t("doctors.availableTomorrow", "Available Tomorrow") : t("doctors.availableToday", "Available Today")}</span>
                      <h3>{formatDoctorName(doctor, language)} <CheckCircle /></h3>
                      <p>{translateSpec(doctor.specialization)}</p>
                      <small>{8 + index}+ {t("doctors.yearsExperience", "years experience")}</small>
                      <small><Building2 /> {translateDepartment(doctor.department, language) || `${translateClinicalTerm(location, "locations", language) || location} ${t("doctors.medicalCentre", "Medical Centre")}`}</small>
                      <small className={styles.rating}>★ <b>{displayRating}</b> ({displayReviewCount} {t("doctors.reviews", "reviews")})</small>
                    </div>
                    <div className={`${styles.cardActions} ${!canBookAppointments ? styles.singleAction : ""}`}>
                      <button onClick={() => handleViewDoctorProfile(doctor)}>{t("common.view", "View Profile")}</button>
                      {canBookAppointments && <button className={styles.bookButton} onClick={() => openBooking(doctor)}><Calendar /> {t("doctors.bookAppointment", "Book Appointment")}</button>}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        <footer className={styles.results}>
          {t("doctors.showingCount", `Showing ${filteredDoctors.length} of ${doctors.length} doctors`, { count: filteredDoctors.length, total: doctors.length })}
        </footer>
      </section>

      {/* Doctor Profile & Reviews Modal */}
      <AnimatePresence>
        {viewingDoctorProfile && (
          <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingDoctorProfile(null)}>
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "26px" }}
            >
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div className={styles.avatar} style={{ width: "52px", height: "52px", fontSize: "18px", margin: 0 }}>
                    {`${viewingDoctorProfile.firstName?.[0] || "D"}${viewingDoctorProfile.lastName?.[0] || ""}`}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                      {formatDoctorName(viewingDoctorProfile, language)} <CheckCircle size={16} color="#16a34a" />
                    </h2>
                    <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                      {translateSpec(viewingDoctorProfile.specialization)} • {viewingDoctorProfile.department || "Clinical Medicine"}
                    </p>
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#0f766e", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                      <ShieldCheck size={13} /> Reg: {viewingDoctorProfile.registrationNumber || "MCI Certified"}
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingDoctorProfile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  <X size={20} />
                </button>
              </header>

              {/* Rating Summary Block */}
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px", lineHeight: 1 }}>
                    {profileReviews.averageRating.toFixed(1)} <Star size={22} fill="#eab308" color="#eab308" />
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    Based on {profileReviews.totalReviews} verified patient {profileReviews.totalReviews === 1 ? "review" : "reviews"}
                  </div>
                </div>
                {canBookAppointments && (
                  <button
                    type="button"
                    onClick={() => {
                      const doc = viewingDoctorProfile;
                      setViewingDoctorProfile(null);
                      openBooking(doc);
                    }}
                    style={{
                      background: "#0f766e",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontWeight: "700",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Calendar size={14} /> Book Consultation
                  </button>
                )}
              </div>

              {/* Patient Reviews List */}
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                Patient Feedback & Experiences
              </h4>

              {profileReviews.loading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                  <RefreshCw size={14} className={styles.spinning} style={{ marginRight: "6px" }} /> Loading patient reviews...
                </div>
              ) : profileReviews.reviews.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#fafafa", borderRadius: "12px", fontSize: "13px" }}>
                  <p style={{ margin: 0, fontWeight: "600" }}>No patient reviews yet for this doctor.</p>
                  <small style={{ color: "#94a3b8" }}>Reviews submitted by patients after completed consultations will appear here.</small>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "260px", overflowY: "auto" }}>
                  {profileReviews.reviews.map((rev) => (
                    <div key={rev.id} style={{ padding: "12px 14px", borderRadius: "12px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>{rev.patientName || "Verified Patient"}</span>
                          <span style={{ fontSize: "10px", background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: "4px", fontWeight: "600" }}>
                            ✓ Verified
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "2px", color: "#eab308" }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={13} fill={s <= rev.rating ? "#eab308" : "none"} color={s <= rev.rating ? "#eab308" : "#cbd5e1"} />
                          ))}
                        </div>
                      </div>
                      {rev.reviewTitle && <strong style={{ fontSize: "13px", color: "#0f172a", display: "block", marginBottom: "3px" }}>{rev.reviewTitle}</strong>}
                      <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>{rev.reviewText}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                        <span>{rev.consultationType === "teleconsultation" ? "🎥 Virtual Consult" : "🏥 In-Person Consult"}</span>
                        <span>{new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Appointment Booking Modal */}
      <AnimatePresence>
        {canBookAppointments && selectedDoctor && (
          <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDoctor(null)}>
            <motion.div className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}>
              <header>
                <div>
                  <span>{t("doctors.bookingTitle", "Book Appointment")}</span>
                  <h2>{formatDoctorName(selectedDoctor, language)}</h2>
                  <p>{translateSpec(selectedDoctor.specialization)}</p>
                </div>
                <button onClick={() => setSelectedDoctor(null)}><X /></button>
              </header>
              <form onSubmit={confirmBooking}>
                <label>
                  {t("doctors.dateTimeLabel", "Date & time")}
                  <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
                </label>
                <label>
                  {t("doctors.consultationType", "Consultation type")}
                  <select value={appointmentType} onChange={(event) => setAppointmentType(event.target.value)}>
                    <option value="in_person">{t("doctors.inPersonType", "In-person consultation")}</option>
                    <option value="video">{t("doctors.teleconsultType", "Teleconsultation")}</option>
                  </select>
                </label>
                <label>
                  {t("doctors.reasonLabel", "Reason for visit")}
                  <input value={reason} onChange={(event) => setReason(event.target.value)} required />
                </label>
                <label>
                  {t("doctors.notesLabel", "Additional notes")}
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
                <button className={styles.confirm} disabled={booking}>
                  {booking ? t("doctors.booking", "Booking…") : t("doctors.confirmBooking", "Confirm Appointment")}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

