import { useState } from "react";
import { Star, X, CheckCircle, ShieldCheck, RefreshCw, Sparkles, Video, Stethoscope } from "lucide-react";
import toast from "react-hot-toast";
import { submitDoctorReview } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import styles from "./DoctorReviewModal.module.css";

const QUICK_TAGS = [
  "Accurate Diagnosis",
  "Clear Treatment Plan",
  "Compassionate & Caring",
  "Attentive Listener",
  "Punctual & Efficient",
  "Reassuring Guidance",
  "Great Follow-up",
];

const RATING_SENTIMENTS = {
  1: "1 - Disappointing Consultation",
  2: "2 - Needs Improvement",
  3: "3 - Satisfactory Experience",
  4: "4 - Very Good Consultation",
  5: "5 - Outstanding & Highly Recommended",
};

export default function DoctorReviewModal({
  isOpen,
  onClose,
  doctor,
  appointmentId = null,
  teleconsultId = null,
  consultationType = "in_person",
  onReviewSubmitted = () => {},
}) {
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !doctor) return null;

  const docName = doctor.name || `Dr. ${doctor.firstName || ""} ${doctor.lastName || ""}`.trim() || "Doctor";
  const docSpecialty = doctor.specialization || doctor.department || "Medical Practitioner";
  const initials = `${doctor.firstName?.[0] || docName.replace("Dr. ", "")[0] || "D"}${doctor.lastName?.[0] || ""}`.toUpperCase();

  const isVirtual = consultationType === "teleconsultation" || consultationType === "video" || consultationType === "virtual";

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const exists = prev.includes(tag);
      const nextTags = exists ? prev.filter((t) => t !== tag) : [...prev, tag];

      // Auto-populate feedback text if empty or add tag context
      if (!reviewText) {
        setReviewText(nextTags.join(". ") + ".");
      }
      return nextTags;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please select a rating between 1 and 5 stars.");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("Please share a brief comment about your consultation.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        appointmentId: appointmentId || undefined,
        teleconsultId: teleconsultId || undefined,
        rating,
        reviewTitle: reviewTitle.trim() || (selectedTags.length > 0 ? selectedTags.join(", ") : undefined),
        reviewText: reviewText.trim(),
        consultationType: isVirtual ? "teleconsultation" : "in_person",
      };

      const res = await submitDoctorReview(doctor.id, payload, token);
      if (res && res.success) {
        toast.success("Thank you! Your doctor review has been posted.");
        onReviewSubmitted(res.review || payload);
        onClose();
      } else {
        toast.error(res?.message || "Could not submit your review. Please try again.");
      }
    } catch (err) {
      console.error("Review submission error:", err);
      toast.error(err.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeDisplayRating = hoverRating || rating;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.doctorProfile}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.doctorMeta}>
              <h3>
                {docName} <CheckCircle size={15} color="#16a34a" />
              </h3>
              <p>{docSpecialty}</p>
              <div className={`${styles.badge} ${isVirtual ? styles.badgeVirtual : styles.badgeInPerson}`}>
                {isVirtual ? <Video size={12} /> : <Stethoscope size={12} />}
                {isVirtual ? "Virtual Teleconsultation" : "In-Person Consultation"}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Star Selector */}
          <div className={styles.ratingSection}>
            <div className={styles.ratingLabel}>Rate your overall experience with the doctor</div>
            <div className={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= activeDisplayRating;
                return (
                  <button
                    key={star}
                    type="button"
                    className={styles.starBtn}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} Stars`}
                  >
                    <Star
                      size={32}
                      className={filled ? styles.starFilled : styles.starEmpty}
                    />
                  </button>
                );
              })}
            </div>
            <div className={styles.ratingSentiment}>
              {RATING_SENTIMENTS[activeDisplayRating] || ""}
            </div>
          </div>

          {/* Quick Tags */}
          <div className={styles.field}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} color="#0f766e" /> Key highlights of your visit
            </label>
            <div className={styles.quickTags}>
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagActive : ""}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {active ? "✓ " : "+ "}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Title */}
          <div className={styles.field}>
            <label htmlFor="reviewTitle">Review Title (Optional)</label>
            <input
              id="reviewTitle"
              type="text"
              placeholder="e.g., Very caring and knowledgeable physician"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Detailed Feedback */}
          <div className={styles.field}>
            <label htmlFor="reviewText">Your Feedback & Experience *</label>
            <textarea
              id="reviewText"
              placeholder="Share how the consultation went, the doctor's communication, and treatment recommendations..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              required
              rows={3}
            />
          </div>

          {/* Footer & Submit */}
          <div className={styles.footer}>
            <div className={styles.verifiedNotice}>
              <ShieldCheck size={14} /> Verified Patient Review
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={submitting || !reviewText.trim()}>
                {submitting ? (
                  <>
                    <RefreshCw size={14} className={styles.spinning} /> Submitting...
                  </>
                ) : (
                  "Submit Review"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
