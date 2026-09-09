import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Activity, AlertCircle, ArrowRight, BrainCircuit, Calendar, CheckCircle2, ChevronDown, ChevronUp, ClipboardPlus, FileText, FlaskConical, Heart, Loader2, Pill, PlusCircle, RefreshCw, Search, Stethoscope, Upload, User, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getDocumentDownloadUrl, getPatientMedicalHistory } from "../../services/api";
import heroImage from "../../assets/medical-history-hero.png";
import styles from "./MedicalHistory.module.css";

const categoryMeta = {
  consultation: { icon: Stethoscope, label: "Consultation", tone: "blue" },
  prescription: { icon: Pill, label: "Prescription", tone: "purple" },
  lab_test: { icon: FlaskConical, label: "Lab & Scan", tone: "gold" },
  assessment: { icon: BrainCircuit, label: "Assessment", tone: "violet" },
  diagnosis: { icon: Heart, label: "Diagnosis", tone: "rose" },
  condition: { icon: Heart, label: "Diagnosis", tone: "rose" },
  procedure: { icon: Activity, label: "Procedure", tone: "green" },
  allergy: { icon: AlertCircle, label: "Allergy", tone: "rose" },
  document: { icon: FileText, label: "Document", tone: "green" },
};

const eventCategory = (event) => {
  const value = (event.category || event.type || "document").toLowerCase().replaceAll(" ", "_");
  if (value === "lab_report" || value === "lab_test") return "lab_test";
  if (value === "condition") return "diagnosis";
  return categoryMeta[value] ? value : "document";
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function MedicalHistory() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await getPatientMedicalHistory(token);
      if (!response.success || !response.history) throw new Error(response.message || "Failed to load medical history.");
      setHistory(response.history);
    } catch (requestError) {
      setError(requestError.message || t("history.error") || "Unable to load medical history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    getPatientMedicalHistory(token).then((response) => {
      if (!response.success || !response.history) throw new Error(response.message || "Failed to load medical history.");
      if (active) setHistory(response.history);
    }).catch((requestError) => {
      if (active) setError(requestError.message || "Unable to load medical history.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  const timeline = useMemo(() => history?.timeline || [], [history]);
  const groups = useMemo(() => ({
    consultation: history?.consultations || [],
    prescription: history?.prescriptions || [],
    lab_test: history?.investigations || [],
    assessment: history?.assessments || [],
    diagnosis: history?.conditions || [],
    procedure: history?.procedures || [],
    allergy: history?.allergies || [],
    document: history?.documents || [],
  }), [history]);

  const counts = useMemo(() => ({ all: timeline.length, ...Object.fromEntries(Object.entries(groups).map(([key, records]) => [key, records.length])) }), [groups, timeline.length]);
  const filteredTimeline = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();
    return timeline.filter((event) => {
      if (activeFilter !== "all" && eventCategory(event) !== activeFilter) return false;
      if (timeRange !== "all") {
        const date = new Date(event.date);
        const cutoff = new Date(now);
        cutoff.setMonth(cutoff.getMonth() - Number(timeRange));
        if (Number.isNaN(date.getTime()) || date < cutoff) return false;
      }
      if (!query) return true;
      return [event.title, event.subtitle, event.details, event.doctorName, event.source].some((value) => value?.toLowerCase().includes(query));
    });
  }, [activeFilter, searchQuery, timeRange, timeline]);

  const openDocument = async (documentId) => {
    try {
      const response = await getDocumentDownloadUrl(documentId, token);
      if (response.url) window.open(response.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("The selected document could not be opened.");
    }
  };

  if (loading) return <div className={styles.state}><Loader2 className={styles.spin} /><h3>{t("history.loading") || "Loading medical history..."}</h3></div>;
  if (error && !history) return <div className={styles.state}><div className={styles.errorBox}><AlertCircle /><h3>{t("history.error") || "Unable to load medical history."}</h3><p>{error}</p><button onClick={fetchHistory}><RefreshCw /> {t("history.retry") || "Retry"}</button></div></div>;

  const statCards = [
    { label: t("history.totalEvents", "Total Records"), detail: t("history.subtitle", "All your medical events"), count: counts.all, icon: FileText, tone: "green" },
    { label: t("history.filterConsultation", "Consultations"), detail: t("history.consultations", "Doctor visits"), count: counts.consultation, icon: Stethoscope, tone: "blue" },
    { label: t("history.prescriptionsCount", "Prescriptions"), detail: t("history.prescriptions", "Medicines prescribed"), count: counts.prescription, icon: Pill, tone: "purple" },
    { label: t("history.labReportsCount", "Lab Tests"), detail: t("history.investigations", "Reports & results"), count: counts.lab_test, icon: FlaskConical, tone: "gold" },
    { label: t("history.filterDiagnosis", "Conditions"), detail: t("history.conditions", "Diagnoses recorded"), count: counts.diagnosis, icon: Heart, tone: "rose" },
  ];
  const filters = [
    ["all", t("history.filterAll", "All Events")],
    ["consultation", t("history.filterConsultation", "Consultations")],
    ["prescription", t("history.filterPrescription", "Prescriptions")],
    ["lab_test", t("history.filterLab", "Lab & Scans")],
    ["assessment", t("history.filterAssessment", "Assessments")],
    ["diagnosis", t("history.filterDiagnosis", "Diagnoses")],
    ["procedure", t("history.filterProcedure", "Procedures")],
    ["allergy", t("history.filterAllergy", "Allergies")],
    ["document", t("history.filterDocument", "Documents")],
  ];

  return <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <div className={styles.layout}>
      <section className={styles.mainColumn}>
        <header className={styles.hero}>
          <img src={heroImage} alt="Patient viewing a connected medical history" />
          <div className={styles.heroCopy}>
            <span>{t("navigation.history", "MEDICAL HISTORY")}</span>
            <h1>{t("history.heroTitle", "Longitudinal Medical History")}</h1>
            <p>{t("history.heroSub", "Your complete chronological health timeline aggregating consultations, lab tests, prescriptions, clinical assessments, and uploaded records.")}</p>
          </div>
          <blockquote>{t("schedule.quote", "“Small Details. Bigger Care.”")}</blockquote>
        </header>

        <section className={styles.stats}>{statCards.map(({ label, detail, count, icon: Icon, tone }) => <article className={styles[tone]} key={label}><span><Icon /></span><div><strong>{count}</strong><h2>{label}</h2><p>{detail}</p></div></article>)}</section>

        <div className={styles.searchRow}>
          <label>
            <Search />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("history.searchPlaceholder", "Search medical timeline by title, doctor, medication, or diagnosis...")} />
            {searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear search"><X /></button>}
          </label>
          <label className={styles.timeFilter}>
            <Calendar />
            <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
              <option value="all">{t("history.timeAll", "All time")}</option>
              <option value="6">{t("history.timePast3Months", "Last 6 months")}</option>
              <option value="12">{t("history.timePastYear", "Last year")}</option>
            </select>
            <ChevronDown />
          </label>
        </div>
        <nav className={styles.filters}>{filters.map(([id, label]) => <button key={id} onClick={() => setActiveFilter(id)} className={activeFilter === id ? styles.active : ""}>{label}<span>{counts[id] || 0}</span></button>)}</nav>

        <section className={styles.timelinePanel}>
          <header><span><Calendar /></span><div><h2>{t("history.timeline", "Longitudinal Health Record Timeline")}</h2><p>{filteredTimeline.length} / {timeline.length}</p></div></header>
          {filteredTimeline.length === 0 ? (
            <div className={styles.empty}>
              <span><Calendar /></span>
              <h3>{t("history.emptyTitle", "No medical events found")}</h3>
              <p>{t("history.emptyDesc", "No timeline records match your search query or selected category filter.")}</p>
              <button onClick={() => navigate("/patient/assessment")}><PlusCircle /> {t("history.startIntake", "Start Clinical Intake")}</button>
            </div>
          ) : (
            <div className={styles.timeline}>{filteredTimeline.map((event, index) => {
              const key = eventCategory(event);
              const meta = categoryMeta[key];
              const Icon = meta.icon;
              const isExpanded = expandedId === (event.id ?? index);
              return <motion.article layout className={styles.event} key={event.id ?? index}>
                <span className={`${styles.eventIcon} ${styles[meta.tone]}`}><Icon /></span>
                <div className={styles.eventCard}><div className={styles.eventTop}><div><span className={`${styles.category} ${styles[meta.tone]}`}>{event.type || meta.label}</span><span className={styles.provenance}>{event.verificationStatus === "verified" || event.type === "Consultation" ? <CheckCircle2 /> : event.verificationStatus === "ai_extracted" ? <BrainCircuit /> : <User />}{event.verificationStatus === "verified" || event.type === "Consultation" ? t("history.provenanceVerified", "Verified") : event.verificationStatus === "ai_extracted" ? t("history.provenanceAi", "AI extracted") : t("history.provenancePatient", "Patient reported")}</span><h3>{event.title || meta.label}</h3>{event.subtitle && <p>{event.subtitle}</p>}</div><time><Calendar />{formatDate(event.date)}</time></div>
                  {event.details && <p className={styles.summary}>{event.details}</p>}
                  <footer><small>{t("history.source", "Source:")} {event.source || "MediKiosk Health System"}</small><div>{event.documentId && <button onClick={() => openDocument(event.documentId)}>{t("history.viewDocument", "View document")}</button>}<button onClick={() => setExpandedId(isExpanded ? null : (event.id ?? index))}>{isExpanded ? t("history.collapseDetails", "Less") : t("history.expandDetails", "Details")}{isExpanded ? <ChevronUp /> : <ChevronDown />}</button></div></footer>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className={styles.expanded}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <b>{t("history.expandDetails", "Recorded Details & Clinical Summary")}</b>
                        <p style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
                          {event.clinicalNotes || event.treatmentNotes || event.details || "No additional clinical parameters recorded."}
                        </p>

                        {/* Render Clinical Intake Chat History Transcript if present */}
                        {event.chatHistory && Array.isArray(event.chatHistory) && event.chatHistory.length > 0 && (
                          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #d5e5df" }}>
                            <b style={{ color: "#0d9488", display: "block", marginBottom: "6px" }}>
                              💬 RAG Clinical Assessment Transcript ({event.chatHistory.length} turns)
                            </b>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                              {event.chatHistory.map((msg, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    fontSize: "12px",
                                    lineHeight: "1.4",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    background: msg.role === "system" ? "#ffffff" : "#e6fffa",
                                    border: msg.role === "system" ? "1px solid #e2e8f0" : "1px solid #99f6e4",
                                    color: msg.role === "system" ? "#334155" : "#0f766e",
                                    alignSelf: msg.role === "system" ? "flex-start" : "flex-end",
                                    maxWidth: "92%"
                                  }}
                                >
                                  <strong>{msg.role === "system" ? "AI Assistant: " : "You: "}</strong>
                                  <span>{msg.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Render Extracted Clinical Fields if present */}
                        {event.answeredFields && Object.keys(event.answeredFields).length > 0 && (
                          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #cde0d9" }}>
                            <b style={{ color: "#047857", fontSize: "11px", display: "block", marginBottom: "4px" }}>
                              📋 Answered Parameters:
                            </b>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {Object.entries(event.answeredFields).map(([k, v]) => (
                                <span
                                  key={k}
                                  style={{
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    color: "#166534",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px"
                                  }}
                                >
                                  <strong>{k.replace('_', ' ')}:</strong> {String(v)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.article>;
            })}</div>
          )}
        </section>
      </section>

      <aside className={styles.sideColumn}>
        <button className={styles.upload} onClick={() => navigate("/patient/documents")}><Upload /> {t("history.uploadRecord", "Upload Document")}</button>
        <section className={styles.quickActions}>
          <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
          {[
            [Calendar, t("history.consultations", "Add Consultation"), "/patient/appointments"],
            [Pill, t("history.prescriptions", "Add Prescription"), "/patient/documents"],
            [FlaskConical, t("history.investigations", "Add Lab Report"), "/patient/documents"],
            [FileText, t("history.documents", "Add Document"), "/patient/documents"],
          ].map(([Icon, label, route]) => <button key={label} onClick={() => navigate(route)}><span><Icon /></span>{label}<ArrowRight /></button>)}
        </section>
        <section className={styles.insights}>
          <span><Activity /></span>
          <div>
            <h2>{t("history.healthInsights", "Health Insights")}</h2>
            <p>{timeline.length ? t("history.healthInsightsDesc", "{{count}} events are organized in your health timeline.", { count: timeline.length }) : t("history.buildTimeline", "Build your timeline to get personalized insights.")}</p>
          </div>
        </section>
        <section className={styles.quote}><ClipboardPlus /><blockquote>{t("history.storyMatters", "Your Health Story Matters.")}</blockquote></section>
      </aside>
    </div>
  </motion.main>;
}
