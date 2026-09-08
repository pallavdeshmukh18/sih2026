import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Calendar, CheckCircle, ChevronDown, Heart, MapPin, Search, Stethoscope, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { createAppointment, fetchPublicDoctors } from "../../services/api";
import heroImage from "../../assets/doctor-directory-hero.png";
import styles from "./DoctorDirectory.module.css";

const specialties = ["All Specialties", "General Medicine", "Cardiology", "Dermatology", "Pediatrics", "Gynecology", "Orthopedics", "Neurology"];

const formatDoctorName = (doctor) => {
  const suppliedName = doctor?.name || [doctor?.firstName, doctor?.lastName].filter(Boolean).join(" ");
  const nameWithoutTitle = suppliedName.replace(/^(?:dr\.?\s*)+/i, "").trim();
  return `Dr. ${nameWithoutTitle || "Doctor"}`;
};

export default function DoctorDirectory() {
  const { token } = useAuth();
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setScheduledAt(new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setSelectedDoctor(doctor);
    setAppointmentType("in_person");
    setReason("General Clinical Consultation");
    setNotes("");
  };

  const confirmBooking = async (event) => {
    event.preventDefault();
    setBooking(true);
    try {
      await createAppointment({ doctorId: selectedDoctor.id, scheduledAt: new Date(scheduledAt).toISOString(), durationMinutes: 30, appointmentType, reason, notes }, token);
      toast.success(`Appointment booked with ${formatDoctorName(selectedDoctor)}.`);
      setSelectedDoctor(null);
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

  return (
    <div className={`${styles.page} workspacePage`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><span>Doctor Directory</span><h1>Find the Right Care, Near You</h1><p>Browse verified doctors, check availability and book appointments with ease.</p></div>
        <img src={heroImage} alt="Doctor consulting with a patient" />
        <form className={styles.searchBar} onSubmit={(event) => event.preventDefault()}>
          <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by doctor name, specialty, or hospital..." /></label>
          <label className={styles.compact}><MapPin /><select value={location} onChange={(event) => setLocation(event.target.value)}><option>Mumbai</option><option>Delhi</option><option>Bengaluru</option><option>Chennai</option></select><ChevronDown /></label>
          <label className={styles.compact}><Calendar /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <button>Search</button>
        </form>
      </section>

      <section className={styles.directory}>
        <div className={styles.filterHeader}><h2>Popular Specialties</h2><label>Sort by <select><option>Relevance</option><option>Experience</option><option>Rating</option></select></label></div>
        <div className={styles.chips}>{specialties.map((item) => <button key={item} className={specialty === item ? styles.active : ""} onClick={() => setSpecialty(item)}><Stethoscope />{item}</button>)}</div>

        {loading ? <div className={styles.doctorGrid}>{Array.from({ length: 8 }, (_, index) => <div key={index} className={`${styles.doctorCard} ${styles.skeleton}`} />)}</div>
          : error ? <div className={styles.empty}>{error}</div>
          : filteredDoctors.length === 0 ? <div className={styles.empty}>No verified doctors match your search.</div>
          : <motion.div className={styles.doctorGrid} layout>
            <AnimatePresence>
              {filteredDoctors.map((doctor, index) => {
                const initials = `${doctor.firstName?.[0] || "D"}${doctor.lastName?.[0] || "R"}`.toUpperCase();
                return <motion.article layout key={doctor.id} className={styles.doctorCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(index * .025, .15) }}>
                  <button className={`${styles.favorite} ${favorites.has(doctor.id) ? styles.liked : ""}`} onClick={() => toggleFavorite(doctor.id)} aria-label="Save doctor"><Heart /></button>
                  <div className={styles.avatar}>{initials}</div>
                  <div className={styles.doctorInfo}><span className={styles.availability}>{index % 3 === 2 ? "Available Tomorrow" : "Available Today"}</span><h3>{formatDoctorName(doctor)} <CheckCircle /></h3><p>{doctor.specialization || "General Medicine"}</p><small>{8 + index}+ years experience</small><small><Building2 /> {doctor.department || `${location} Medical Centre`}</small><small className={styles.rating}>★ <b>{(4.6 + (index % 4) / 10).toFixed(1)}</b> ({87 + index * 19} reviews)</small></div>
                  <div className={styles.cardActions}><button>View Profile</button><button onClick={() => openBooking(doctor)}><Calendar /> Book Appointment</button></div>
                </motion.article>;
              })}
            </AnimatePresence>
          </motion.div>}
        <footer className={styles.results}>Showing {filteredDoctors.length} of {doctors.length} doctors <span><button>‹</button><button className={styles.current}>1</button><button>2</button><button>3</button><button>›</button></span></footer>
      </section>

      <AnimatePresence>
        {selectedDoctor && <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDoctor(null)}><motion.div className={styles.modal} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} onClick={(event) => event.stopPropagation()}>
          <header><div><span>Book Appointment</span><h2>{formatDoctorName(selectedDoctor)}</h2><p>{selectedDoctor.specialization}</p></div><button onClick={() => setSelectedDoctor(null)}><X /></button></header>
          <form onSubmit={confirmBooking}><label>Date & time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label><label>Consultation type<select value={appointmentType} onChange={(event) => setAppointmentType(event.target.value)}><option value="in_person">In-person consultation</option><option value="teleconsultation">Teleconsultation</option></select></label><label>Reason for visit<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><label>Additional notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className={styles.confirm} disabled={booking}>{booking ? "Booking…" : "Confirm Appointment"}</button></form>
        </motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
