import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Clock3,
  Download,
  Droplet,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Languages,
  Layers,
  Leaf,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Pill,
  QrCode,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube,
  User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { useAccessibility } from "../../context/AccessibilityContext";
import {
  getMedicalPassport,
  generatePatientQrToken,
  getConnectedDoctors,
  revokeDoctorAccess,
  openDocumentOriginal
} from "../../services/api";
import { transliterateName, translateClinicalTerm } from "../../utils/transliterate";
import { SUPPORTED_LANGUAGES } from "../../constants/onboardingData";
import heroImage from "../../assets/medical-id-hero.png";
import ExportPassportModal from "../../components/patient/ExportPassportModal";
import { parseClinicalSummary } from "../../utils/clinicalSummaryParser";
import styles from "./MedicalPassport.module.css";

const formatDate = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function MedicalPassport() {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const { islEnabled, requestSign } = useAccessibility();
  const navigate = useNavigate();

  // Accessibility / ISL Context
  useEffect(() => {
    if (islEnabled) {
      requestSign("Medical Passport", { context: "medical_passport_header" });
    }
  }, [islEnabled, requestSign]);

  // Primary data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Time Range Controls
  const [timeRange, setTimeRange] = useState("1_year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  // Expandable Consultations
  const [expandedConsultId, setExpandedConsultId] = useState(null);

  // Expandable Medical Timeline
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // QR Pairing State (Demoted to dedicated secondary section)
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState(0);

  // Connected Doctors State
  const [connectedDoctors, setConnectedDoctors] = useState([]);
  const [revokingId, setRevokingId] = useState(null);

  const fetchPassportData = useCallback(async (selectedRange = timeRange, start = customStart, end = customEnd) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedRange === "custom") {
        if (start) params.startDate = start;
        if (end) params.endDate = end;
      } else {
        params.timeRange = selectedRange;
      }
      const response = await getMedicalPassport(token, params);
      const passport = response?.medicalPassport || response?.medicalId;
      if (!response.success || !passport) {
        throw new Error(response.message || "Failed to fetch Medical Passport.");
      }
      setData(passport);
      setTimelineExpanded(false);
    } catch (err) {
      setError(err.message || t("medicalPassport.error", "Unable to load your Medical Passport."));
    } finally {
      setLoading(false);
    }
  }, [token, timeRange, customStart, customEnd, t]);

  const fetchQrToken = useCallback(async () => {
    if (!token || qrLoading) return;
    setQrLoading(true);
    try {
      const res = await generatePatientQrToken(token);
      if (res.success) {
        setQrData(res);
        setQrTimeLeft(res.expiresInSeconds || 300);
      }
    } catch (err) {
      console.warn("Failed to generate QR token:", err.message);
    } finally {
      setQrLoading(false);
    }
  }, [token, qrLoading]);

  const fetchConnectedDoctorsList = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getConnectedDoctors(token);
      if (res.success && Array.isArray(res.connectedDoctors)) {
        setConnectedDoctors(res.connectedDoctors);
      }
    } catch (err) {
      console.warn("Failed to fetch connected doctors:", err.message);
    }
  }, [token]);

  // Initial Load
  useEffect(() => {
    fetchPassportData("1_year");
    fetchQrToken();
    fetchConnectedDoctorsList();
  }, []);

  // QR Timer Countdown
  useEffect(() => {
    let interval = null;
    if (qrTimeLeft > 0) {
      interval = setInterval(() => {
        setQrTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrTimeLeft]);

  // Handle Range Selection
  const handleRangeChange = (range) => {
    setTimeRange(range);
    if (range !== "custom") {
      fetchPassportData(range, "", "");
    }
  };

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    if (customStart || customEnd) {
      fetchPassportData("custom", customStart, customEnd);
    }
  };

  // Revoke Doctor Access
  const handleRevokeDoctor = async (relationshipId) => {
    if (!token || revokingId) return;
    setRevokingId(relationshipId);
    try {
      const res = await revokeDoctorAccess(relationshipId, token);
      if (res.success) {
        setConnectedDoctors((prev) =>
          prev.map((doc) =>
            doc.relationshipId === relationshipId ? { ...doc, status: "revoked" } : doc
          )
        );
      }
    } catch (err) {
      console.error("Failed to revoke doctor access:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading && !data) {
    return (
      <div className={styles.state}>
        <Loader2 className={styles.spin} size={36} />
        <h3>{t("common.loading", "Loading your Medical Passport...")}</h3>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.state}>
        <div className={styles.errorBox}>
          <AlertCircle size={28} />
          <h3>{t("medicalPassport.error", "Unable to load your Medical Passport.")}</h3>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={() => fetchPassportData()}>
            <RefreshCw size={14} /> {t("common.retry", "Retry")}
          </button>
        </div>
      </div>
    );
  }

  const patient = data?.patient || {};
  const stats = data?.recordStats || {};
  const allergies = data?.allergies || [];
  const conditions = data?.conditions || [];
  const medications = data?.medications || [];
  const procedures = data?.procedures || [];
  const consultations = data?.consultations || [];
  const investigations = data?.investigations || [];
  const documents = data?.documents || [];
  const timeline = data?.timeline || [];
  const ayush = data?.ayushProfile || null;
  const healthSummary = data?.healthSummary || null;
  const recentAssessment = data?.recentAssessment || null;

  const parsedSummary = parseClinicalSummary(healthSummary?.summary, recentAssessment);

  const getPresentationIcon = (key) => {
    const k = (key || "").toLowerCase();
    if (k.includes("complaint")) return <Stethoscope size={13} />;
    if (k.includes("type")) return <Layers size={13} />;
    if (k.includes("onset")) return <Clock size={13} />;
    if (k.includes("duration")) return <Calendar size={13} />;
    if (k.includes("severity")) return <Activity size={13} />;
    if (k.includes("symptom")) return <Sparkles size={13} />;
    if (k.includes("date")) return <Calendar size={13} />;
    return <Activity size={13} />;
  };

  const notRecorded = t("common.notRecorded", "Not recorded");
  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === (patient.preferredLanguage || "").toLowerCase());
  const preferredLangDisplay = langObj ? (langObj.nativeName || langObj.name) : (patient.preferredLanguage || notRecorded);

  // Dynamic Profile Items
  const profileItems = [
    { label: t("medicalPassport.fullName", "Full Name"), value: patient.name ? transliterateName(patient.name, language) : notRecorded, icon: User },
    { label: t("medicalPassport.dob", "Date of Birth"), value: formatDate(patient.dateOfBirth, notRecorded), icon: Calendar },
    { label: t("medicalPassport.age", "Age"), value: patient.age ? `${patient.age} yrs` : notRecorded, icon: Activity },
    { label: t("medicalPassport.gender", "Gender"), value: patient.gender ? t(`common.${patient.gender.toLowerCase()}`, patient.gender) : notRecorded, icon: User, capitalize: true },
    { label: t("medicalPassport.state", "State / Region"), value: patient.state ? translateClinicalTerm(patient.state, "states", language) : notRecorded, icon: MapPin },
    { label: t("medicalPassport.preferredLanguage", "Preferred Language"), value: preferredLangDisplay, icon: Languages, capitalize: true },
  ];

  // ABHA ID only if available
  if (patient.abhaId) {
    profileItems.push({ label: "ABHA ID", value: patient.abhaId, icon: ShieldCheck });
  }

  // Blood Group only if actually recorded
  if (patient.bloodGroup && patient.bloodGroup !== "Not recorded") {
    profileItems.push({ label: t("medicalPassport.bloodGroup", "Blood Group"), value: patient.bloodGroup, icon: Droplet });
  }

  return (
    <motion.main
      className={`${styles.page} workspacePage`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* 1. HERO SECTION */}
      <header className={styles.hero}>
        <img src={heroImage} alt="Botanical Medical Passport Banner" className={styles.heroBackground} />
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}><ShieldCheck size={13} /> MediKiosk Passport</span>
            <h1>{t("medicalPassport.title", "MEDICAL PASSPORT")}</h1>
            <p className={styles.heroSubtitle}>
              {t("medicalPassport.subtitle", "Your portable summary of your medical profile")}
            </p>
            <p className={styles.heroNotice}>
              {t("medicalPassport.notice", "Review your health history and prepare a shareable medical summary.")}
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              className={styles.exportBtn}
              onClick={() => setShowExportModal(true)}
              aria-label="Export Medical Passport"
            >
              <Download size={16} />
              <span>{t("medicalPassport.exportBtn", "Export Medical Passport")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. TIME RANGE SELECTOR */}
      <section className={styles.filterBar} aria-label="Reporting Period Filter">
        <div className={styles.filterHeader}>
          <div className={styles.filterLabel}>
            <Clock3 size={17} />
            <span>{t("medicalPassport.historyPeriod", "History Period")}:</span>
          </div>
          <div className={styles.filterNotice}>
            <ShieldCheck size={14} />
            <span>Active allergies and active conditions remain visible across all time periods.</span>
          </div>
        </div>

        <div className={styles.timePills}>
          {[
            { key: "3_months", label: "Last 3 months" },
            { key: "1_year", label: "Last 1 year" },
            { key: "2_years", label: "Last 2 years" },
            { key: "5_years", label: "Last 5 years" },
            { key: "all", label: "All available history" },
            { key: "custom", label: "Custom date range" }
          ].map((pill) => (
            <button
              key={pill.key}
              onClick={() => handleRangeChange(pill.key)}
              className={`${styles.pillBtn} ${timeRange === pill.key ? styles.activePill : ""}`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {timeRange === "custom" && (
          <form onSubmit={handleApplyCustomRange} className={styles.customDateRow}>
            <div className={styles.dateInputGroup}>
              <label htmlFor="customStart">From:</label>
              <input
                id="customStart"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className={styles.dateInputGroup}>
              <label htmlFor="customEnd">To:</label>
              <input
                id="customEnd"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.applyBtn}>
              Apply Filter
            </button>
          </form>
        )}
      </section>

      {/* 3. PASSPORT OVERVIEW / QUICK STATS */}
      <section className={styles.overviewStats} aria-label="Passport Overview Statistics">
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#f0fdfa", color: "#0d9488" }}>
            <FileCheck2 size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Clinical Records</span>
            <span className={styles.statValue}>{stats.clinicalRecords ?? 0}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#eff6ff", color: "#2563eb" }}>
            <Stethoscope size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Consultations</span>
            <span className={styles.statValue}>{stats.consultations ?? consultations.length}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#faf5ff", color: "#9333ea" }}>
            <FileText size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Documents</span>
            <span className={styles.statValue}>{stats.documents ?? documents.length}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#fff7ed", color: "#ea580c" }}>
            <TestTube size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Investigations</span>
            <span className={styles.statValue}>{stats.investigations ?? investigations.length}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#f8fafc", color: "#475569" }}>
            <Calendar size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Last Updated</span>
            <span className={styles.statValue} style={{ fontSize: "14px" }}>
              {data?.lastUpdated ? formatDate(data.lastUpdated) : "Today"}
            </span>
          </div>
        </div>
      </section>

      {/* 4. PROFILE & SECURE QR CONNECTION ROW (QR ON THE LEFT) */}
      <div className={styles.profileQrRow}>
        {/* (A) SECURE PROVIDER CONNECTION QR (LEFT) */}
        <section className={`${styles.sectionCard} ${styles.secureQrCard} ${styles.qrLeftCard}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={styles.sectionIconBadge} style={{ background: "#ecfdf5", color: "#065f46" }}>
                <QrCode size={20} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2>SECURE PROVIDER CONNECTION</h2>
                <p>Connect clinician via temporary pairing code.</p>
              </div>
            </div>
          </div>

          <div className={styles.qrCardBody}>
            <div className={styles.qrBox} aria-label="Secure provider pairing QR code">
              <QRCodeSVG
                value={qrData?.qrPayload || ""}
                size={120}
                level="H"
                includeMargin={true}
              />
              <div className={styles.pairingCode}>
                Pairing Code: <strong>{qrData?.pairingCode || "MK-XXXXXX"}</strong>
              </div>
            </div>

            <div className={styles.qrControls}>
              {qrTimeLeft > 0 ? (
                <div className={`${styles.qrTimer} ${qrTimeLeft < 60 ? styles.qrWarning : ""}`}>
                  <Clock size={13} />
                  <span>QR expires in <strong>{formatTimer(qrTimeLeft)}</strong></span>
                </div>
              ) : (
                <div className={`${styles.qrTimer} ${styles.qrWarning}`}>
                  <AlertTriangle size={13} />
                  <span>QR Expired</span>
                </div>
              )}

              <button
                onClick={fetchQrToken}
                disabled={qrLoading}
                className={styles.qrRefreshBtn}
              >
                {qrLoading ? <Loader2 className={styles.spin} size={14} /> : <RefreshCw size={14} />}
                <span>{qrLoading ? "Generating..." : "Generate New QR"}</span>
              </button>
            </div>

            <p className={styles.qrNotice}>
              🔒 <strong>Security Notice:</strong> Issues a cryptographic 5-minute consent handshake for authenticated clinicians.
            </p>
          </div>
        </section>

        {/* (B) PATIENT DEMOGRAPHIC PROFILE (RIGHT) */}
        <section className={`${styles.sectionCard} ${styles.demographicsRightCard}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={styles.sectionIconBadge} style={{ background: "#e2f3ee", color: "#08786c" }}>
                <User size={20} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2>{t("medicalPassport.patientProfile", "PATIENT DEMOGRAPHIC PROFILE")}</h2>
                <p>{t("medicalPassport.patientProfileSub", "Verified patient identity on MediKiosk record.")}</p>
              </div>
            </div>
            <button onClick={() => navigate("/patient/account")} className={styles.editBtn}>
              <Pencil size={13} /> {t("common.edit", "Edit Profile")}
            </button>
          </div>

          <div className={styles.profileGrid}>
            {profileItems.map(({ label, value, icon: Icon, capitalize }) => (
              <div className={styles.profileTile} key={label}>
                <Icon size={18} />
                <div>
                  <small>{label}</small>
                  <strong className={capitalize ? styles.capitalize : ""}>{value}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.privacyFootnote}>
            <Lock size={13} />
            <span>Contact details (phone/email) are concealed in this passport summary for export privacy.</span>
          </div>
        </section>
      </div>

      {/* 6. HEALTH SUMMARY CARD */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#f0fdfa", color: "#0d9488" }}>
              <Sparkles size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.healthSummary", "HEALTH SUMMARY")}</h2>
              <p>{t("medicalPassport.healthSummarySub", "Concise clinical narrative derived from records.")}</p>
            </div>
          </div>
          {parsedSummary?.hasContent && (healthSummary?.isAiGenerated ?? true) && (
            <span className={styles.aiGeneratedPill}>
              <Sparkles size={12} /> AI-Assisted Synthesis
            </span>
          )}
        </div>

        {parsedSummary?.hasContent ? (
          <div className={styles.clinicalSummaryCard}>
            {/* 1. TOP HERO ROW: CHIEF COMPLAINT & CLINICAL TAGS */}
            <div className={styles.summaryHeroRow}>
              <div className={styles.summaryComplaintGroup}>
                <div className={styles.complaintIconBadge}>
                  <Stethoscope size={22} />
                </div>
                <div>
                  <span className={styles.complaintLabel}>Chief Complaint</span>
                  <h3 className={styles.complaintTitle}>
                    {parsedSummary.presentationMap["Chief Complaint"] || "Clinical Health Intake"}
                  </h3>
                </div>
              </div>

              <div className={styles.summaryPillsGroup}>
                {parsedSummary.presentationMap["Consultation Type"] && (
                  <span className={styles.consultTypePill}>
                    <Layers size={13} /> {parsedSummary.presentationMap["Consultation Type"]}
                  </span>
                )}
                {parsedSummary.presentationMap["Severity"] && (
                  <span
                    className={`${styles.severityPill} ${
                      /severe|critical|high/i.test(parsedSummary.presentationMap["Severity"])
                        ? styles.severityPillHigh
                        : ""
                    }`}
                  >
                    <Activity size={13} /> {parsedSummary.presentationMap["Severity"]}
                  </span>
                )}
              </div>
            </div>

            {/* 2. CLINICAL NARRATIVE BODY */}
            {parsedSummary.overview && (
              <div className={styles.summaryNarrativeBox}>
                <p className={styles.summaryNarrativeText}>{parsedSummary.overview}</p>
              </div>
            )}

            {/* 3. BALANCED PARAMETERS STRIP (AUTO-FIT ACROSS WIDTH) */}
            {parsedSummary.presentationList.filter(
              (i) => i.key !== "Chief Complaint" && i.key !== "Consultation Type"
            ).length > 0 && (
              <div className={styles.parametersStrip}>
                {parsedSummary.presentationList
                  .filter((i) => i.key !== "Chief Complaint" && i.key !== "Consultation Type")
                  .map((item) => (
                    <div key={item.key} className={styles.parameterCol}>
                      <div className={styles.parameterColHeader}>
                        {getPresentationIcon(item.key)}
                        <span>{item.label}</span>
                      </div>
                      <span className={styles.parameterColValue}>{item.value}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* 4. CLINICAL / TRIAGE FLAGS (IF ANY) */}
            {parsedSummary.clinicalFlags && parsedSummary.clinicalFlags.length > 0 && (
              <div className={styles.summaryFlagsAlert}>
                <AlertTriangle size={18} />
                <div>
                  <strong style={{ fontSize: "13px" }}>Clinical Attention Required:</strong>
                  <div className={styles.flagTags}>
                    {parsedSummary.clinicalFlags.map((flag, idx) => (
                      <span key={idx} className={styles.flagTag}>
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. CARD FOOTER */}
            <div className={styles.summaryFooter}>
              <div className={styles.summaryFooterMeta}>
                <span className={styles.summarySource}>
                  Source: <strong>{healthSummary?.source || parsedSummary.source || "MediKiosk Clinical Intake"}</strong>
                  {parsedSummary.provenanceDate && ` • ${formatDate(parsedSummary.provenanceDate)}`}
                </span>
              </div>
              <div className={styles.summaryDisclaimer}>
                <Lock size={12} /> Derived from verified intake records for clinical evaluation
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            No clinical summary is available yet. Complete a clinical intake or doctor consultation to generate a summary.
          </div>
        )}
      </section>

      {/* 6. ALLERGIES (HIGH VISIBILITY ALERT SECTION) */}
      <section className={`${styles.sectionCard} ${styles.allergySection}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#fee2e2", color: "#dc2626" }}>
              <AlertTriangle size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2 style={{ color: "#991b1b" }}>{t("medicalPassport.allergies", "ALLERGIES")}</h2>
              <p>{t("medicalPassport.allergiesSub", "Safety-critical allergen alerts and known reactions.")}</p>
            </div>
          </div>
        </div>

        <div className={styles.allergyAlertBanner}>
          <AlertCircle size={16} />
          <span>Active allergies remain visible across all reporting periods to preserve patient safety.</span>
        </div>

        {allergies.length > 0 ? (
          <div className={styles.allergyGrid}>
            {allergies.map((alg) => (
              <div key={alg.id} className={styles.allergyCard}>
                <div className={styles.allergyTop}>
                  <span className={styles.allergyName}>{alg.allergy}</span>
                  {alg.isCurrentlyActive && (
                    <span className={styles.allergyActiveBadge}>Active</span>
                  )}
                </div>
                {alg.description && <p className={styles.allergyDesc}>{alg.description}</p>}
                <div className={styles.allergyFooter}>
                  <span>Source: {alg.source}</span>
                  <span>{alg.date ? formatDate(alg.date) : "Recorded"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t("medicalPassport.noAllergiesRecorded", "No allergies recorded")}
          </div>
        )}
      </section>

      {/* 7. KNOWN CONDITIONS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#eff6ff", color: "#2563eb" }}>
              <Activity size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.conditions", "KNOWN CONDITIONS")}</h2>
              <p>{t("medicalPassport.conditionsSub", "Recorded diagnoses, chronic conditions, and clinical problems.")}</p>
            </div>
          </div>
        </div>

        {conditions.length > 0 ? (
          <div className={styles.conditionGrid}>
            {conditions.map((cond) => (
              <div key={cond.id} className={styles.conditionCard}>
                <div className={styles.conditionTop}>
                  <span className={styles.conditionName}>{cond.condition}</span>
                  <span className={cond.status === "active" ? styles.statusActive : styles.statusResolved}>
                    {cond.status ? cond.status.toUpperCase() : "ACTIVE"}
                  </span>
                </div>
                <div className={styles.conditionMeta}>
                  <div>Diagnosed: {formatDate(cond.diagnosedDate)}</div>
                  <div style={{ marginTop: "2px", color: "#94a3b8" }}>Source: {cond.source}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t("medicalPassport.noConditionsRecorded", "No conditions recorded")}
          </div>
        )}
      </section>

      {/* 8. MEDICATIONS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#ede9fe", color: "#7c3aed" }}>
              <Pill size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.medications", "MEDICATIONS")}</h2>
              <p>{t("medicalPassport.medicationsSub", "Structured medication history from prescriptions and clinical visits.")}</p>
            </div>
          </div>
        </div>

        {medications.length > 0 ? (
          <div className={styles.medicationGrid}>
            {medications.map((med) => (
              <div key={med.id} className={styles.medicationCard}>
                <div className={styles.medTop}>
                  <span className={styles.medName}>{med.medicine}</span>
                  <span className={styles.recentlyRecordedTag}>Recently recorded</span>
                </div>
                {med.dosage && <div className={styles.medDosage}>{med.dosage}</div>}
                <div className={styles.medFrequency}>
                  {med.frequency || "As prescribed"} {med.duration ? `• ${med.duration}` : ""}
                </div>
                <div className={styles.medFooter}>
                  <span>Source: {med.source}</span>
                  {med.date && <span>{formatDate(med.date)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t("medicalPassport.noMedicationsRecorded", "No medication records available")}
          </div>
        )}
      </section>

      {/* 9. PROCEDURES & SURGERIES */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#fef3c7", color: "#d97706" }}>
              <Scissors size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.procedures", "PROCEDURES & SURGERIES")}</h2>
              <p>{t("medicalPassport.proceduresSub", "Past surgical interventions and clinical procedures.")}</p>
            </div>
          </div>
        </div>

        {procedures.length > 0 ? (
          <div className={styles.conditionGrid}>
            {procedures.map((proc) => (
              <div key={proc.id} className={styles.conditionCard}>
                <div className={styles.conditionTop}>
                  <span className={styles.conditionName}>{proc.procedure}</span>
                  <span className={styles.statusResolved}>COMPLETED</span>
                </div>
                <div className={styles.conditionMeta}>
                  <div>Date: {formatDate(proc.date)}</div>
                  <div style={{ marginTop: "2px", color: "#94a3b8" }}>Source: {proc.source}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t("medicalPassport.noProceduresRecorded", "No surgeries or procedures recorded")}
          </div>
        )}
      </section>

      {/* 10. RECENT CONSULTATIONS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#eff6ff", color: "#1d4ed8" }}>
              <Stethoscope size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.consultations", "RECENT CONSULTATIONS")}</h2>
              <p>{t("medicalPassport.consultationsSub", "Doctor encounters and clinical assessments in this period.")}</p>
            </div>
          </div>
        </div>

        {consultations.length > 0 ? (
          <div className={styles.consultationList}>
            {consultations.map((c) => {
              const isExpanded = expandedConsultId === c.id;
              return (
                <div
                  key={c.id}
                  className={styles.consultationCard}
                  onClick={() => setExpandedConsultId(isExpanded ? null : c.id)}
                >
                  <div className={styles.consultHeader}>
                    <div>
                      <span className={styles.doctorName}>{c.doctorName}</span>
                      <span className={styles.doctorSpec}>{c.specialization} {c.department ? `• ${c.department}` : ""}</span>
                    </div>
                    <span className={styles.consultDate}>{formatDate(c.date)}</span>
                  </div>

                  <div className={styles.consultDetails}>
                    <div><strong>Chief Complaint:</strong> {c.chiefComplaint}</div>
                    {c.diagnosis && (
                      <div style={{ marginTop: "4px" }}>
                        <span className={styles.diagnosisTag}>Diagnosis</span>
                        <span>{c.diagnosis}</span>
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ marginTop: "8px", padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                        {c.treatmentNotes && <div><strong>Treatment Notes:</strong> {c.treatmentNotes}</div>}
                        {c.clinicalNotes && <div style={{ marginTop: "4px" }}><strong>Clinical Notes:</strong> {c.clinicalNotes}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            No consultations in this period
          </div>
        )}
      </section>

      {/* 11. INVESTIGATIONS / LAB RESULTS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#fff7ed", color: "#c2410c" }}>
              <TestTube size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.investigations", "RECENT INVESTIGATIONS")}</h2>
              <p>{t("medicalPassport.investigationsSub", "Laboratory diagnostic results and physiological findings.")}</p>
            </div>
          </div>
        </div>

        {investigations.length > 0 ? (
          <div className={styles.investigationTableWrapper}>
            <table className={styles.investigationTable}>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Reference Range</th>
                  <th>Flag</th>
                  <th>Date</th>
                  <th>Source Document</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv) => {
                  let flagClass = styles.flagNormal;
                  const f = (inv.flag || "").toLowerCase();
                  if (f.includes("high")) flagClass = styles.flagHigh;
                  else if (f.includes("low")) flagClass = styles.flagLow;
                  return (
                    <tr key={inv.id}>
                      <td><strong>{inv.test}</strong></td>
                      <td>{inv.value ? `${inv.value} ${inv.unit || ""}`.trim() : "Recorded"}</td>
                      <td>{inv.referenceRange || "Standard"}</td>
                      <td><span className={flagClass}>{(inv.flag || "NORMAL").toUpperCase()}</span></td>
                      <td>{formatDate(inv.date)}</td>
                      <td style={{ color: "#64748b" }}>{inv.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            No investigation results available
          </div>
        )}
      </section>

      {/* 12. MEDICAL DOCUMENTS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#f8fafc", color: "#334155" }}>
              <FileText size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.documents", "MEDICAL DOCUMENTS")}</h2>
              <p>{t("medicalPassport.documentsSub", "Uploaded clinical files, scans, and verified prescriptions.")}</p>
            </div>
          </div>
        </div>

        {documents.length > 0 ? (
          <div className={styles.documentList}>
            {documents.map((doc) => (
              <div key={doc.id} className={styles.docCard}>
                <div>
                  <div className={styles.docHeader}>
                    <div className={styles.docIcon}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className={styles.docName}>{doc.fileName}</div>
                      <span className={styles.docTypeTag}>{doc.documentType}</span>
                    </div>
                  </div>
                  <div className={styles.docDate}>Recorded: {formatDate(doc.date)}</div>
                  {doc.aiSummary && (
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0 0", fontStyle: "italic" }}>
                      "{doc.aiSummary.slice(0, 100)}..."
                    </p>
                  )}
                </div>
                <button
                  className={styles.docActionBtn}
                  onClick={() => openDocumentOriginal(doc.id, token)}
                >
                  <ExternalLink size={13} /> View Original Document
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            No documents in this period
          </div>
        )}
      </section>

      {/* 13. AYUSH HEALTH PROFILE (DYNAMICALLY RENDERED ONLY WHEN DATA EXISTS) */}
      {ayush && (
        <section className={`${styles.sectionCard} ${styles.ayushSection}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={styles.sectionIconBadge} style={{ background: "#dcfce7", color: "#166534" }}>
                <Leaf size={20} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 style={{ color: "#14532d" }}>AYUSH HEALTH PROFILE</h2>
                <p>Holistic constitutional assessment derived from traditional AYUSH clinical intake.</p>
              </div>
            </div>
          </div>

          <div className={styles.ayushGrid}>
            {ayush.prakriti && (
              <div className={styles.ayushTile}>
                <small>Prakriti (Constitution)</small>
                <strong>{ayush.prakriti}</strong>
              </div>
            )}
            {ayush.vikriti && (
              <div className={styles.ayushTile}>
                <small>Vikriti (Imbalance)</small>
                <strong>{ayush.vikriti}</strong>
              </div>
            )}
            {ayush.agni && (
              <div className={styles.ayushTile}>
                <small>Agni (Digestive Fire)</small>
                <strong>{ayush.agni}</strong>
              </div>
            )}
            {ayush.koshtha && (
              <div className={styles.ayushTile}>
                <small>Koshtha (Bowel Type)</small>
                <strong>{ayush.koshtha}</strong>
              </div>
            )}
            {ayush.satmya && (
              <div className={styles.ayushTile}>
                <small>Satmya (Adaptability)</small>
                <strong>{ayush.satmya}</strong>
              </div>
            )}
            {ayush.aharaVihara && (
              <div className={styles.ayushTile}>
                <small>Ahara & Vihara (Regimen)</small>
                <strong>{ayush.aharaVihara}</strong>
              </div>
            )}
          </div>

          {ayush.summary && (
            <div className={styles.ayushSummaryBox}>
              <strong>Assessment Narrative:</strong> {ayush.summary}
            </div>
          )}
        </section>
      )}

      {/* 14. CONNECTED CARE PROVIDERS */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#f0fdf4", color: "#166534" }}>
              <Stethoscope size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.connectedCareProviders", "CONNECTED CARE PROVIDERS")}</h2>
              <p>{t("medicalPassport.connectedProvidersSubtitle", "Doctors who have authorized access to your MediKiosk clinical profile.")}</p>
            </div>
          </div>
        </div>

        <div className={styles.connectedGrid}>
          {connectedDoctors.length > 0 ? (
            connectedDoctors.map((doc) => (
              <div key={doc.relationshipId} className={styles.providerCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className={styles.providerAvatar}>
                    {doc.doctorName?.replace("Dr. ", "").charAt(0)}
                  </div>
                  <div className={styles.providerInfo}>
                    <h4>{doc.doctorName}</h4>
                    <p>{doc.specialization} {doc.department ? `• ${doc.department}` : ""}</p>
                    <small>Connected: {formatDate(doc.connectedAt)}</small>
                  </div>
                </div>

                <div>
                  {doc.status === "active" ? (
                    <button
                      onClick={() => handleRevokeDoctor(doc.relationshipId)}
                      className={styles.revokeBtn}
                      disabled={revokingId === doc.relationshipId}
                    >
                      {revokingId === doc.relationshipId ? "Revoking..." : "Revoke Access"}
                    </button>
                  ) : (
                    <span className={styles.revokedTag}>Access Revoked</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              No connected care providers yet. Connect an authorized doctor using your secure pairing code above.
            </div>
          )}
        </div>
      </section>

      {/* 16. MEDICAL TIMELINE */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionIconBadge} style={{ background: "#f0fdf4", color: "#166534" }}>
              <Layers size={20} />
            </div>
            <div className={styles.sectionTitleGroup}>
              <h2>{t("medicalPassport.timeline", "MEDICAL TIMELINE")}</h2>
              <p>{t("medicalPassport.timelineSub", "Chronological sequence of clinical events, diagnoses, and visits.")}</p>
            </div>
          </div>
          {timeline.length > 0 && (
            <span className={styles.timelineCountBadge}>
              {timeline.length > 6 && !timelineExpanded
                ? `Showing 6 of ${timeline.length} records`
                : `${timeline.length} ${timeline.length === 1 ? "record" : "records"}`}
            </span>
          )}
        </div>

        {timeline.length > 0 ? (
          <>
            <div className={styles.timelineContainer}>
              {(timelineExpanded ? timeline : timeline.slice(0, 6)).map((item) => (
                <div key={item.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineCard}>
                    <div className={styles.timelineTop}>
                      <span className={styles.timelineTypeTag}>{item.type}</span>
                      <span className={styles.timelineDate}>{formatDate(item.date)}</span>
                    </div>
                    <h4 className={styles.timelineTitle}>{item.title}</h4>
                    {item.subtitle && <p className={styles.timelineSubtitle}>{item.subtitle}</p>}
                    {item.details && <p className={styles.timelineDetails}>{item.details}</p>}
                  </div>
                </div>
              ))}
            </div>

            {timeline.length > 6 && (
              <div className={styles.timelineExpandWrapper}>
                <button
                  type="button"
                  className={styles.timelineExpandBtn}
                  onClick={() => setTimelineExpanded((prev) => !prev)}
                  aria-expanded={timelineExpanded}
                >
                  {timelineExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      <span>{t("medicalPassport.showLessTimeline", "Show Recent 6 Records")}</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      <span>
                        {t("medicalPassport.showMoreTimeline", {
                          defaultValue: `Show All ${timeline.length} Records (${timeline.length - 6} more)`,
                          count: timeline.length,
                          remaining: timeline.length - 6,
                        })}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            No clinical events in this period
          </div>
        )}
      </section>

      {/* EXPORT CONFIGURATION & DOWNLOAD MODAL */}
      <ExportPassportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentData={data}
        initialTimeRange={timeRange}
        initialStart={customStart}
        initialEnd={customEnd}
        token={token}
      />
    </motion.main>
  );
}
