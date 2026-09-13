import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPlus,
  FileText,
  FlaskConical,
  Heart,
  Loader2,
  Archive,
  Clock,
  Pill,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { useAccessibility } from "../../context/AccessibilityContext";
import {
  clearAllMedicalHistory,
  deleteClinicalSession,
  deleteDocument,
  deleteMedicalHistoryItem,
  getDocumentDownloadUrl,
  openDocumentOriginal,
  getPatientMedicalHistory,
  getGraveyardItems,
  archiveGraveyardItem,
  restoreGraveyardItem,
  getGraveyardPolicy,
  updateGraveyardPolicy
} from "../../services/api";
import ClinicalSummaryCard from "../../components/common/ClinicalSummaryCard";
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
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function MedicalHistory() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { islEnabled, requestSign } = useAccessibility();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (islEnabled) {
      requestSign("Medical History", { context: "history_header" });
    }
  }, [islEnabled, requestSign]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // Graveyard state
  const [activeTab, setActiveTab] = useState("active"); // "active" | "graveyard"
  const [graveyardItems, setGraveyardItems] = useState([]);
  const [graveyardLoading, setGraveyardLoading] = useState(false);
  const [graveyardPolicy, setGraveyardPolicy] = useState("1_year");
  const [confirmArchiveEvent, setConfirmArchiveEvent] = useState(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Deletion state
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchGraveyard = async () => {
    if (!token) return;
    setGraveyardLoading(true);
    try {
      const [itemsRes, policyRes] = await Promise.all([
        getGraveyardItems(token),
        getGraveyardPolicy(token),
      ]);
      if (itemsRes?.success) setGraveyardItems(itemsRes.items || []);
      if (policyRes?.success) setGraveyardPolicy(policyRes.policy || "1_year");
    } catch (e) {
      console.error("Failed to load graveyard items:", e);
    } finally {
      setGraveyardLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await getPatientMedicalHistory(token);
      if (!response.success || !response.history) {
        throw new Error(response.message || "Failed to load medical history.");
      }
      setHistory(response.history);
      fetchGraveyard();
    } catch (requestError) {
      setError(requestError.message || t("history.error") || "Unable to load medical history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.all([
      getPatientMedicalHistory(token),
      getGraveyardItems(token),
      getGraveyardPolicy(token)
    ])
      .then(([response, gRes, pRes]) => {
        if (!response.success || !response.history) {
          throw new Error(response.message || "Failed to load medical history.");
        }
        if (active) {
          setHistory(response.history);
          if (gRes?.success) setGraveyardItems(gRes.items || []);
          if (pRes?.success) setGraveyardPolicy(pRes.policy || "1_year");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load medical history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const timeline = useMemo(() => history?.timeline || [], [history]);
  const groups = useMemo(
    () => ({
      consultation: history?.consultations || [],
      prescription: history?.prescriptions || [],
      lab_test: history?.investigations || [],
      assessment: history?.assessments || [],
      diagnosis: history?.conditions || [],
      procedure: history?.procedures || [],
      allergy: history?.allergies || [],
      document: history?.documents || [],
    }),
    [history]
  );

  const counts = useMemo(
    () => ({
      all: timeline.length,
      ...Object.fromEntries(Object.entries(groups).map(([key, records]) => [key, records.length])),
    }),
    [groups, timeline.length]
  );

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
      return [event.title, event.subtitle, event.details, event.doctorName, event.source].some((value) =>
        value?.toLowerCase().includes(query)
      );
    });
  }, [activeFilter, searchQuery, timeRange, timeline]);

  const openDocument = async (documentId) => {
    try {
      await openDocumentOriginal(documentId, token);
    } catch {
      setError("The selected document could not be opened.");
    }
  };

  const handleDeleteItem = async (eventToDelete) => {
    if (!eventToDelete || !token) return;
    setIsDeleting(true);

    try {
      const recordType = eventToDelete.recordType;
      const targetId = eventToDelete.rawId || eventToDelete.id;

      if (recordType === "clinical_session" || eventToDelete.category === "assessment") {
        await deleteClinicalSession(targetId, token);
      } else if (recordType === "document" || eventToDelete.documentId) {
        await deleteDocument(eventToDelete.documentId || targetId, token);
      } else {
        await deleteMedicalHistoryItem(targetId, token);
      }

      // Optimistic update of local state
      setHistory((prev) => {
        if (!prev) return prev;
        const newTimeline = (prev.timeline || []).filter((e) => (e.rawId || e.id) !== targetId && e.id !== eventToDelete.id);
        const newConditions = (prev.conditions || []).filter((c) => c.id !== targetId);
        const newAllergies = (prev.allergies || []).filter((a) => a.id !== targetId);
        const newProcedures = (prev.procedures || []).filter((p) => p.id !== targetId);
        const newAssessments = (prev.assessments || []).filter((a) => a.id !== targetId);
        const newDocs = (prev.documents || []).filter((d) => d.id !== targetId);
        const newPrescriptions = (prev.prescriptions || []).filter((p) => p.id !== targetId);
        const newInvestigations = (prev.investigations || []).filter((i) => i.id !== targetId);

        return {
          ...prev,
          timeline: newTimeline,
          conditions: newConditions,
          allergies: newAllergies,
          procedures: newProcedures,
          assessments: newAssessments,
          documents: newDocs,
          prescriptions: newPrescriptions,
          investigations: newInvestigations,
        };
      });
      setGraveyardItems((prev) => prev.filter((g) => g.sourceId !== targetId && g.id !== targetId));

      setConfirmDeleteEvent(null);
      showToast(t("history.deleteSuccess", "Record deleted successfully."));
    } catch (delError) {
      showToast(delError.message || "Failed to delete record.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveItem = async () => {
    if (!confirmArchiveEvent || !token) return;
    setIsArchiving(true);
    try {
      const recordType = confirmArchiveEvent.recordType;
      const targetId = confirmArchiveEvent.rawId || confirmArchiveEvent.id;
      let sourceType = "medical_history";
      let sourceId = targetId;

      if (recordType === "clinical_session" || confirmArchiveEvent.category === "assessment") {
        sourceType = "clinical_session";
      } else if (recordType === "document" || confirmArchiveEvent.documentId) {
        sourceType = "document";
        sourceId = confirmArchiveEvent.documentId || targetId;
      } else if (recordType === "consultation") {
        sourceType = "consultation";
      }

      await archiveGraveyardItem(sourceType, sourceId, archiveReason, token);

      // Optimistic update of local active state
      setHistory((prev) => {
        if (!prev) return prev;
        const newTimeline = (prev.timeline || []).filter((e) => (e.rawId || e.id) !== targetId && e.id !== confirmArchiveEvent.id);
        const newConditions = (prev.conditions || []).filter((c) => c.id !== targetId);
        const newAllergies = (prev.allergies || []).filter((a) => a.id !== targetId);
        const newProcedures = (prev.procedures || []).filter((p) => p.id !== targetId);
        const newAssessments = (prev.assessments || []).filter((a) => a.id !== targetId);
        const newDocs = (prev.documents || []).filter((d) => d.id !== targetId && d.id !== sourceId);
        const newPrescriptions = (prev.prescriptions || []).filter((p) => p.id !== targetId && p.id !== sourceId);
        const newInvestigations = (prev.investigations || []).filter((i) => i.id !== targetId && i.id !== sourceId);
        const newConsults = (prev.consultations || []).filter((c) => c.id !== targetId);

        return {
          ...prev,
          timeline: newTimeline,
          conditions: newConditions,
          allergies: newAllergies,
          procedures: newProcedures,
          assessments: newAssessments,
          documents: newDocs,
          prescriptions: newPrescriptions,
          investigations: newInvestigations,
          consultations: newConsults,
        };
      });

      setConfirmArchiveEvent(null);
      setArchiveReason("");
      showToast(t("history.archiveSuccess", "Record moved to Graveyard. It is safely archived and excluded from your active clinical context."));
      await fetchGraveyard();
    } catch (err) {
      showToast(err.message || "Failed to archive record.", "error");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreItem = async (item) => {
    if (!item || !token) return;
    setIsRestoring(true);
    try {
      await restoreGraveyardItem(item.sourceType, item.sourceId, token);
      setGraveyardItems((prev) => prev.filter((g) => g.id !== item.id));
      showToast(t("history.restoreSuccess", "Record restored to active medical history!"));
      await fetchHistory();
      await fetchGraveyard();
    } catch (err) {
      showToast(err.message || "Failed to restore record.", "error");
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePolicyChange = async (newPolicy) => {
    if (!token) return;
    try {
      setGraveyardPolicy(newPolicy);
      await updateGraveyardPolicy(newPolicy, token);
      showToast(`Auto-archive policy updated to: ${newPolicy.replace("_", " ")}`);
      fetchHistory();
    } catch (err) {
      showToast(err.message || "Failed to update policy.", "error");
    }
  };

  const handleClearAllHistory = async () => {
    if (!token) return;
    setIsDeleting(true);
    try {
      await clearAllMedicalHistory(token);
      setHistory((prev) => {
        if (!prev) return prev;
        const remainingTimeline = (prev.timeline || []).filter((e) => e.recordType !== "medical_history");
        return {
          ...prev,
          conditions: [],
          allergies: [],
          procedures: [],
          timeline: remainingTimeline,
        };
      });
      setShowClearModal(false);
      showToast("All recorded conditions, allergies, and procedures have been cleared.");
    } catch (err) {
      showToast(err.message || "Failed to clear medical history.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.state}>
        <Loader2 className={styles.spin} />
        <h3>{t("history.loading") || "Loading medical history..."}</h3>
      </div>
    );
  }

  if (error && !history) {
    return (
      <div className={styles.state}>
        <div className={styles.errorBox}>
          <AlertCircle />
          <h3>{t("history.error") || "Unable to load medical history."}</h3>
          <p>{error}</p>
          <button onClick={fetchHistory}>
            <RefreshCw /> {t("history.retry") || "Retry"}
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: t("history.totalEvents", "Total Records"), detail: t("history.completeTimeline", "Your complete timeline"), count: counts.all, icon: FileText, tone: "green" },
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

  return (
    <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <header className={styles.hero}>
        <img src={heroImage} alt="Patient viewing a connected medical history" />
        <div className={styles.heroCopy}>
          <span>MEDICAL HISTORY</span>
          <h1>Longitudinal Medical History</h1>
          <p>Your complete Timeline</p>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.mainColumn}>
          <section className={styles.stats}>
            {statCards.map(({ label, detail, count, icon: Icon, tone }) => (
              <article className={styles[tone]} key={label}>
                <span>
                  <Icon />
                </span>
                <div>
                  <strong>{count}</strong>
                  <h2>{label}</h2>
                  <p>{detail}</p>
                </div>
              </article>
            ))}
          </section>

          {/* Segmented View Switcher: Active Records vs Graveyard */}
          <div className={styles.viewTabsRow}>
            <div className={styles.viewTabs}>
              <button
                className={`${styles.viewTab} ${activeTab === "active" ? styles.viewTabActive : ""}`}
                onClick={() => setActiveTab("active")}
              >
                <FileText /> {t("history.activeRecords", "Active Records")}
                <span className={styles.viewTabCount}>{counts.all}</span>
              </button>
              <button
                className={`${styles.viewTab} ${activeTab === "graveyard" ? styles.viewTabActive : ""}`}
                onClick={() => setActiveTab("graveyard")}
              >
                <Archive /> {t("history.graveyard", "Graveyard")}
                <span className={`${styles.viewTabCount} ${styles.graveyardTabCount}`}>
                  {graveyardItems.length}
                </span>
              </button>
            </div>
          </div>

          {activeTab === "graveyard" ? (
            <>
              <div className={styles.graveyardBanner}>
                <div className={styles.graveyardBannerContent}>
                  <div className={styles.graveyardBannerIcon}>
                    <Archive />
                  </div>
                  <div>
                    <h3 className={styles.graveyardBannerTitle}>
                      {t("history.graveyardTitle", "Patient Graveyard (Archived Records)")}
                    </h3>
                    <p className={styles.graveyardBannerDesc}>
                      {t(
                        "history.graveyardDesc",
                        "Archived records are completely excluded from your active clinical context, Medical Passport, Medical ID, and doctor-facing views. They remain safely preserved and can be restored to your active history at any time."
                      )}
                    </p>
                  </div>
                </div>
                <div className={styles.graveyardPolicyControl}>
                  <label>
                    <Clock size={13} /> {t("history.autoArchive", "Auto-Archive:")}
                  </label>
                  <select
                    value={graveyardPolicy}
                    onChange={(e) => handlePolicyChange(e.target.value)}
                  >
                    <option value="never">{t("history.policyNever", "Never (Manual Only)")}</option>
                    <option value="3_months">{t("history.policy3m", "Older than 3 months")}</option>
                    <option value="6_months">{t("history.policy6m", "Older than 6 months")}</option>
                    <option value="1_year">{t("history.policy1y", "Older than 1 year (Default)")}</option>
                    <option value="2_years">{t("history.policy2y", "Older than 2 years")}</option>
                    <option value="5_years">{t("history.policy5y", "Older than 5 years")}</option>
                  </select>
                </div>
              </div>

              <section className={styles.timelinePanel}>
                <header>
                  <span>
                    <Archive />
                  </span>
                  <div>
                    <h2>{t("history.graveyardItems", "Archived Records")}</h2>
                    <p>
                      {t("history.graveyardCount", "{{count}} records currently in Graveyard", {
                        count: graveyardItems.length,
                      })}
                    </p>
                  </div>
                </header>

                {graveyardItems.length === 0 ? (
                  <div className={styles.empty}>
                    <span>
                      <Archive />
                    </span>
                    <h3>{t("history.noArchived", "No records in Graveyard")}</h3>
                    <p>
                      {t(
                        "history.noArchivedDesc",
                        "You have not archived any records. When you move old or resolved records to the Graveyard, they will appear here safely preserved."
                      )}
                    </p>
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {graveyardItems.map((item, index) => {
                      const key = eventCategory(item);
                      const meta = categoryMeta[key] || categoryMeta.document;
                      const Icon = meta.icon;

                      return (
                        <motion.article layout className={styles.event} key={item.id ?? index}>
                          <span className={`${styles.eventIcon} ${styles[meta.tone]}`}>
                            <Icon />
                          </span>
                          <div className={styles.eventCard}>
                            <div className={styles.eventTop}>
                              <div>
                                <span className={`${styles.category} ${styles[meta.tone]}`}>
                                  {meta.label}
                                </span>
                                <span
                                  className={`${styles.archivedBadge} ${
                                    item.archiveMode === "automatic" ? styles.archivedBadgeAuto : ""
                                  }`}
                                >
                                  {item.archiveMode === "automatic" ? (
                                    <>
                                      <Clock size={11} /> Auto-archived
                                    </>
                                  ) : (
                                    <>
                                      <Archive size={11} /> Archived manually
                                    </>
                                  )}
                                </span>
                                <h3>{item.title}</h3>
                                {item.subtitle && <p>{item.subtitle}</p>}
                              </div>
                              <time>
                                <Calendar />
                                {formatDate(item.date)}
                              </time>
                            </div>

                            {item.archivedReason && (
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                                <strong>Reason:</strong> {item.archivedReason} • Archived on {formatDate(item.archivedAt)}
                              </div>
                            )}

                            {item.details && (
                              <p className={styles.summary} style={{ opacity: 0.85 }}>
                                {item.details.length > 180 ? `${item.details.slice(0, 180)}...` : item.details}
                              </p>
                            )}

                            <footer>
                              <small>
                                {t("history.source", "Source:")} {item.sourceType.replace("_", " ").toUpperCase()}
                              </small>
                              <div>
                                {item.documentId && (
                                  <button onClick={() => openDocument(item.documentId)}>
                                    {t("history.viewDocument", "View document")}
                                  </button>
                                )}
                                <button
                                  className={styles.restoreBtn}
                                  onClick={() => handleRestoreItem(item)}
                                  disabled={isRestoring}
                                  title="Restore this record back to active medical history"
                                >
                                  {isRestoring ? (
                                    <Loader2 className={styles.spin} size={13} />
                                  ) : (
                                    <RotateCcw size={13} />
                                  )}
                                  {t("history.restoreToActive", "Restore to Active History")}
                                </button>
                                <button
                                  className={styles.deleteBtn}
                                  onClick={() =>
                                    setConfirmDeleteEvent({
                                      rawId: item.sourceId,
                                      recordType: item.sourceType,
                                      title: item.title,
                                      category: item.category,
                                      date: item.date,
                                      source: item.sourceType,
                                    })
                                  }
                                  title={t("history.deletePermanent", "Permanently delete record")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </footer>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <div className={styles.searchRow}>
                <label>
                  <Search />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("history.searchPlaceholder", "Search medical timeline by title, doctor, medication, or diagnosis...")}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} aria-label="Clear search">
                      <X />
                    </button>
                  )}
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
              <nav className={styles.filters}>
                {filters.map(([id, label]) => (
                  <button key={id} onClick={() => setActiveFilter(id)} className={activeFilter === id ? styles.active : ""}>
                    {label}
                    <span>{counts[id] || 0}</span>
                  </button>
                ))}
              </nav>

              <section className={styles.timelinePanel}>
                <header>
                  <span>
                    <Calendar />
                  </span>
                  <div>
                    <h2>{t("history.timeline", "Longitudinal Health Record Timeline")}</h2>
                    <p>
                      {filteredTimeline.length} / {timeline.length}
                    </p>
                  </div>
                  {(counts.diagnosis > 0 || counts.allergy > 0 || counts.procedure > 0) && (
                    <button className={styles.clearAllBtn} onClick={() => setShowClearModal(true)} title="Clear all recorded conditions, allergies & procedures">
                      <Trash2 size={13} /> {t("history.clearRecorded", "Clear Recorded History")}
                    </button>
                  )}
                </header>

                {filteredTimeline.length === 0 ? (
                  <div className={styles.empty}>
                    <span>
                      <Calendar />
                    </span>
                    <h3>{t("history.emptyTitle", "No medical events found")}</h3>
                    <p>{t("history.emptyDesc", "No timeline records match your search query or selected category filter.")}</p>
                    <button onClick={() => navigate("/patient/assessment")}>
                      <PlusCircle /> {t("history.startIntake", "Start Clinical Intake")}
                    </button>
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {filteredTimeline.map((event, index) => {
                      const key = eventCategory(event);
                      const meta = categoryMeta[key];
                      const Icon = meta.icon;
                      const isExpanded = expandedId === (event.id ?? index);
                      const canDelete = event.canDelete !== false && event.type !== "Consultation";

                      return (
                        <motion.article layout className={styles.event} key={event.id ?? index}>
                          <span className={`${styles.eventIcon} ${styles[meta.tone]}`}>
                            <Icon />
                          </span>
                          <div className={styles.eventCard}>
                            <div className={styles.eventTop}>
                              <div>
                                <span className={`${styles.category} ${styles[meta.tone]}`}>{event.type || meta.label}</span>
                                <span className={styles.provenance}>
                                  {event.verificationStatus === "verified" || event.type === "Consultation" ? (
                                    <CheckCircle2 />
                                  ) : event.verificationStatus === "ai_extracted" ? (
                                    <BrainCircuit />
                                  ) : (
                                    <User />
                                  )}
                                  {event.verificationStatus === "verified" || event.type === "Consultation"
                                    ? t("history.provenanceVerified", "Verified")
                                    : event.verificationStatus === "ai_extracted"
                                    ? t("history.provenanceAi", "AI extracted")
                                    : t("history.provenancePatient", "Patient reported")}
                                </span>
                                <h3>{event.title || meta.label}</h3>
                                {event.subtitle && <p>{event.subtitle}</p>}
                              </div>
                              <time>
                                <Calendar />
                                {formatDate(event.date)}
                              </time>
                            </div>

                            <footer>
                              <small>
                                {t("history.source", "Source:")} {event.source || "MediKiosk Health System"}
                              </small>
                              <div>
                                {event.documentId && (
                                  <button onClick={() => openDocument(event.documentId)}>
                                    {t("history.viewDocument", "View document")}
                                  </button>
                                )}
                                <button onClick={() => setExpandedId(isExpanded ? null : (event.id ?? index))}>
                                  {isExpanded ? t("history.collapseDetails", "Less") : t("history.expandDetails", "Details")}
                                  {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                </button>
                                <button
                                  className={styles.archiveBtn}
                                  onClick={() => setConfirmArchiveEvent(event)}
                                  title={t("history.archiveRecord", "Move to Graveyard")}
                                >
                                  <Archive size={13} /> {t("history.archive", "Graveyard")}
                                </button>
                                {canDelete && (
                                  <button
                                    className={styles.deleteBtn}
                                    onClick={() => setConfirmDeleteEvent(event)}
                                    title={t("history.deleteRecord", "Delete this record")}
                                  >
                                    <Trash2 size={13} /> {t("history.delete", "Delete")}
                                  </button>
                                )}
                              </div>
                            </footer>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  className={styles.expanded}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                >
                                  <ClinicalSummaryCard
                                    summary={
                                      event.extractedEntities || event.medications || event.labResults
                                        ? {
                                            summary: event.clinicalNotes || event.treatmentNotes || event.details || "",
                                            medications: event.medications || event.extractedEntities?.medications || [],
                                            lab_results: event.labResults || event.extractedEntities?.lab_results || [],
                                            procedures: event.procedures || event.extractedEntities?.procedures || [],
                                            diagnoses: event.diagnoses || event.extractedEntities?.diagnoses || [],
                                          }
                                        : event.clinicalNotes || event.treatmentNotes || event.details || ""
                                    }
                                    chiefComplaint={event.title}
                                    answeredFields={event.answeredFields}
                                    redFlags={event.redFlags}
                                    patientName={history?.patient?.name || "Patient"}
                                    date={formatDate(event.date)}
                                    style={{ marginTop: "10px" }}
                                  />

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
                                              maxWidth: "92%",
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
                                              fontSize: "11px",
                                            }}
                                          >
                                            <strong>{k.replace("_", " ")}:</strong> {String(v)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </section>

        <aside className={styles.sideColumn}>
          <button className={styles.upload} onClick={() => navigate("/patient/documents")}>
            <Upload /> {t("history.uploadRecord", "Upload Document")}
          </button>
          <section className={styles.quickActions}>
            <h2>{t("dashboard.quickActions", "Quick Actions")}</h2>
            {[
              [Calendar, t("history.consultations", "Add Consultation"), "/patient/appointments"],
              [Pill, t("history.prescriptions", "Add Prescription"), "/patient/documents"],
              [FlaskConical, t("history.investigations", "Add Lab Report"), "/patient/documents"],
              [FileText, t("history.documents", "Add Document"), "/patient/documents"],
            ].map(([Icon, label, route]) => (
              <button key={label} onClick={() => navigate(route)}>
                <span>
                  <Icon />
                </span>
                {label}
                <ArrowRight />
              </button>
            ))}
          </section>
          <section className={styles.insights}>
            <span>
              <Activity />
            </span>
            <div>
              <h2>{t("history.healthInsights", "Health Insights")}</h2>
              <p>
                {timeline.length
                  ? t("history.healthInsightsDesc", "{{count}} events are organized in your health timeline.", { count: timeline.length })
                  : t("history.buildTimeline", "Build your timeline to get personalized insights.")}
              </p>
            </div>
          </section>
          <section className={styles.quote}>
            <ClipboardPlus />
            <blockquote>{t("history.storyMatters", "Your Health Story Matters.")}</blockquote>
          </section>
        </aside>
      </div>

      {/* Move to Graveyard Confirmation Modal */}
      <AnimatePresence>
        {confirmArchiveEvent && (
          <div className={styles.modalOverlay} onClick={() => !isArchiving && setConfirmArchiveEvent(null)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={`${styles.modalIcon} ${styles.archiveModalIcon}`}>
                  <Archive />
                </div>
                <div>
                  <h3 className={styles.modalTitle}>{t("history.confirmArchiveTitle", "Move Record to Graveyard?")}</h3>
                  <p className={styles.modalDesc}>
                    {t(
                      "history.confirmArchiveDesc",
                      "This record will be safely archived and completely excluded from your active clinical context, Medical Passport, Medical ID, and doctor-facing views. It is NOT deleted and can be restored at any time."
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.modalRecordPreview}>
                <div className={styles.modalRecordTitle}>
                  <span>{confirmArchiveEvent.title || "Medical Record"}</span>
                  <span className={styles.modalRecordBadge}>{confirmArchiveEvent.type || confirmArchiveEvent.category}</span>
                </div>
                <div className={styles.modalRecordSub}>
                  {formatDate(confirmArchiveEvent.date)} • {confirmArchiveEvent.source || "MediKiosk"}
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
                  {t("history.archiveReasonLabel", "Archival Reason (Optional):")}
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder={t("history.archiveReasonPlaceholder", "e.g. Old record, Resolved condition, Irrelevant...")}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    color: "#1e293b",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.modalCancelBtn}
                  disabled={isArchiving}
                  onClick={() => setConfirmArchiveEvent(null)}
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  className={`${styles.modalConfirmBtn} ${styles.archiveModalConfirmBtn}`}
                  disabled={isArchiving}
                  onClick={handleArchiveItem}
                >
                  {isArchiving ? <Loader2 className={styles.spin} size={15} /> : <Archive size={15} />}
                  {isArchiving ? t("history.archiving", "Archiving...") : t("history.confirmArchive", "Move to Graveyard")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Item Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteEvent && (
          <div className={styles.modalOverlay} onClick={() => !isDeleting && setConfirmDeleteEvent(null)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalIcon}>
                  <AlertTriangle />
                </div>
                <div>
                  <h3 className={styles.modalTitle}>{t("history.confirmDeleteTitle", "Delete Medical Record?")}</h3>
                  <p className={styles.modalDesc}>
                    {t(
                      "history.confirmDeleteDesc",
                      "Are you sure you want to delete this record? It will be permanently removed from your medical history and will no longer be referenced in AI assessments."
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.modalRecordPreview}>
                <div className={styles.modalRecordTitle}>
                  <span>{confirmDeleteEvent.title || "Medical Record"}</span>
                  <span className={styles.modalRecordBadge}>{confirmDeleteEvent.type || confirmDeleteEvent.category}</span>
                </div>
                <div className={styles.modalRecordSub}>
                  {formatDate(confirmDeleteEvent.date)} • {confirmDeleteEvent.source || "MediKiosk"}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.modalCancelBtn}
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteEvent(null)}
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  className={styles.modalConfirmBtn}
                  disabled={isDeleting}
                  onClick={() => handleDeleteItem(confirmDeleteEvent)}
                >
                  {isDeleting ? <Loader2 className={styles.spin} size={15} /> : <Trash2 size={15} />}
                  {isDeleting ? t("history.deleting", "Deleting...") : t("history.confirmDelete", "Delete Record")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All History Confirmation Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className={styles.modalOverlay} onClick={() => !isDeleting && setShowClearModal(false)}>
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalIcon}>
                  <AlertTriangle />
                </div>
                <div>
                  <h3 className={styles.modalTitle}>{t("history.confirmClearTitle", "Clear All Medical History?")}</h3>
                  <p className={styles.modalDesc}>
                    {t(
                      "history.confirmClearDesc",
                      "This will permanently delete all recorded medical conditions, allergies, and surgical procedures from your health profile. Doctor consultations and uploaded records remain intact."
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.modalCancelBtn}
                  disabled={isDeleting}
                  onClick={() => setShowClearModal(false)}
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  className={styles.modalConfirmBtn}
                  disabled={isDeleting}
                  onClick={handleClearAllHistory}
                >
                  {isDeleting ? <Loader2 className={styles.spin} size={15} /> : <Trash2 size={15} />}
                  {isDeleting ? t("history.clearing", "Clearing...") : t("history.confirmClear", "Clear All")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.type === "error" ? <AlertCircle /> : <CheckCircle />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
