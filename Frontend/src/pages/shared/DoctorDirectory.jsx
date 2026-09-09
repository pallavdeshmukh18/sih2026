import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Calendar, CheckCircle, ChevronDown, Heart, MapPin, Search, Stethoscope, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { createAppointment, fetchPublicDoctors } from "../../services/api";
import { formatDoctorName, translateClinicalTerm, translateDepartment } from "../../utils/transliterate";
import heroImage from "../../assets/doctor-directory-hero.png";
import styles from "./DoctorDirectory.module.css";

export default function DoctorDirectory() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t, language } = useLanguage();
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
    navigate(`/patient/assessment?doctorId=${doctor.id}`);
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
                      <small className={styles.rating}>★ <b>{(4.6 + (index % 4) / 10).toFixed(1)}</b> ({87 + index * 19} {t("doctors.reviews", "reviews")})</small>
                    </div>
                    <div className={styles.cardActions}>
                      <button>{t("common.view", "View Profile")}</button>
                      <button onClick={() => openBooking(doctor)}><Calendar /> {t("doctors.bookAppointment", "Book Appointment")}</button>
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

      <AnimatePresence>
        {selectedDoctor && (
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
                    <option value="teleconsultation">{t("doctors.teleconsultType", "Teleconsultation")}</option>
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
