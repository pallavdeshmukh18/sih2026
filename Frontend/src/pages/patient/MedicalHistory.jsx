import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ShieldAlert,
  Syringe,
  FileText,
  FlaskConical,
  UserCheck,
  Sparkles,
  Clock,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Filter,
  CheckCircle2,
  BrainCircuit,
  User,
  PlusCircle,
  Upload,
  Calendar,
  X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n";
import { getPatientMedicalHistory, getDocumentDownloadUrl } from "../../services/api";
import DocumentDetailModal from "../../components/DocumentDetailModal";

export default function MedicalHistory() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // Interactive state
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showOverviewCard, setShowOverviewCard] = useState(true);

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientMedicalHistory(token);
      if (res.success && res.history) {
        setHistory(res.history);
      } else {
        throw new Error(res.message || "Failed to load medical history.");
      }
    } catch (err) {
      console.error("Error loading medical history:", err);
      setError(err.message || t("history.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleOpenDocument = async (docId) => {
    try {
      const res = await getDocumentDownloadUrl(docId, token);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Could not fetch document URL:", err);
    }
  };

  const timeline = useMemo(() => history?.timeline || [], [history]);
  const conditions = useMemo(() => history?.conditions || [], [history]);
  const allergies = useMemo(() => history?.allergies || [], [history]);
  const currentMedications = useMemo(() => history?.currentMedications || [], [history]);
  const prescriptions = useMemo(() => history?.prescriptions || [], [history]);
  const investigations = useMemo(() => history?.investigations || [], [history]);
  const procedures = useMemo(() => history?.procedures || [], [history]);
  const consultations = useMemo(() => history?.consultations || [], [history]);
  const documents = useMemo(() => history?.documents || [], [history]);
  const assessments = useMemo(() => history?.assessments || [], [history]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: timeline.length,
      assessment: assessments.length,
      consultation: consultations.length,
      prescription: prescriptions.length,
      lab_test: investigations.length,
      document: documents.length,
      diagnosis: conditions.length,
      procedure: procedures.length,
      allergy: allergies.length,
    };
    return counts;
  }, [timeline, assessments, consultations, prescriptions, investigations, documents, conditions, procedures, allergies]);

  // Filtered & Searched Timeline
  const filteredTimeline = useMemo(() => {
    return timeline.filter((event) => {
      // Category filter
      if (activeFilter !== "all") {
        const cat = event.category || event.type?.toLowerCase();
        if (cat !== activeFilter) {
          // Special fallback mappings
          if (activeFilter === "diagnosis" && event.type !== "Condition") return false;
          if (activeFilter === "lab_test" && (event.type !== "Lab Test" && event.type !== "Lab Report")) return false;
          if (activeFilter === "prescription" && event.type !== "Prescription") return false;
          if (activeFilter === "consultation" && event.type !== "Consultation") return false;
          if (activeFilter === "assessment" && event.type !== "Assessment") return false;
          if (activeFilter === "allergy" && event.type !== "Allergy") return false;
          if (activeFilter === "procedure" && event.type !== "Procedure") return false;
          if (activeFilter === "document" && event.type !== "Document") return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = event.title?.toLowerCase().includes(query);
        const subtitleMatch = event.subtitle?.toLowerCase().includes(query);
        const detailsMatch = event.details?.toLowerCase().includes(query);
        const doctorMatch = event.doctorName?.toLowerCase().includes(query);
        const sourceMatch = event.source?.toLowerCase().includes(query);

        return titleMatch || subtitleMatch || detailsMatch || doctorMatch || sourceMatch;
      }

      return true;
    });
  }, [timeline, activeFilter, searchQuery]);

  // Helper for Category Colors & Icons
  const getCategoryConfig = (type, category) => {
    const key = (category || type || "").toLowerCase();
    switch (key) {
      case "consultation":
        return {
          icon: <Stethoscope size={18} />,
          bg: "#e0f2fe",
          color: "#0284c7",
          border: "#bae6fd",
          badgeBg: "#e0f2fe",
          badgeText: "#0369a1",
          label: t("history.filterConsultations")
        };
      case "prescription":
        return {
          icon: <FileText size={18} />,
          bg: "#fef3c7",
          color: "#d97706",
          border: "#fde68a",
          badgeBg: "#fef3c7",
          badgeText: "#b45309",
          label: t("history.filterPrescriptions")
        };
      case "lab_test":
      case "lab test":
        return {
          icon: <FlaskConical size={18} />,
          bg: "#ccfbf1",
          color: "#0d9488",
          border: "#99f6e4",
          badgeBg: "#ccfbf1",
          badgeText: "#0f766e",
          label: t("history.filterTests")
        };
      case "assessment":
        return {
          icon: <Sparkles size={18} />,
          bg: "#f3e8ff",
          color: "#9333ea",
          border: "#e9d5ff",
          badgeBg: "#f3e8ff",
          badgeText: "#7e22ce",
          label: t("history.filterAssessments")
        };
      case "diagnosis":
      case "condition":
        return {
          icon: <Activity size={18} />,
          bg: "#dbeafe",
          color: "#2563eb",
          border: "#bfdbfe",
          badgeBg: "#dbeafe",
          badgeText: "#1d4ed8",
          label: t("history.filterDiagnoses")
        };
      case "allergy":
        return {
          icon: <ShieldAlert size={18} />,
          bg: "#fee2e2",
          color: "#dc2626",
          border: "#fecaca",
          badgeBg: "#fee2e2",
          badgeText: "#b91c1c",
          label: t("history.filterAllergies")
        };
      case "procedure":
        return {
          icon: <Activity size={18} />,
          bg: "#dcfce7",
          color: "#16a34a",
          border: "#bbf7d0",
          badgeBg: "#dcfce7",
          badgeText: "#15803d",
          label: t("history.filterProcedures")
        };
      default:
        return {
          icon: <FileText size={18} />,
          bg: "#f1f5f9",
          color: "#475569",
          border: "#e2e8f0",
          badgeBg: "#f1f5f9",
          badgeText: "#334155",
          label: t("history.filterDocuments")
        };
    }
  };

  // Provenance Badge Generator
  const renderProvenanceBadge = (event) => {
    if (event.verificationStatus === "verified" || event.type === "Consultation") {
      return (
        <span
          title="Verified by a registered medical doctor"
          data-speak="Verified by doctor"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#dcfce7",
            color: "#15803d",
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "600"
          }}
        >
          <CheckCircle2 size={12} /> {t("history.provenanceVerified")}
        </span>
      );
    }
    if (event.verificationStatus === "ai_extracted" || event.type === "Assessment" || event.ocrStatus === "completed") {
      return (
        <span
          title="Extracted automatically using MediKiosk AI OCR / Clinical Intake"
          data-speak="AI Extracted record"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#f3e8ff",
            color: "#7e22ce",
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "600"
          }}
        >
          <BrainCircuit size={12} /> {t("history.provenanceAi")}
        </span>
      );
    }
    return (
      <span
        title="Recorded during patient onboarding"
        data-speak="Patient reported record"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          background: "#e2e8f0",
          color: "#475569",
          padding: "3px 10px",
          borderRadius: "20px",
          fontSize: "11px",
          fontWeight: "600"
        }}
      >
        <User size={12} /> {t("history.provenancePatient")}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <Loader2 size={36} color="#0d9488" className="animate-spin" style={{ margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: "16px", color: "var(--color-dark)", fontWeight: "600" }}>
          {t("history.loading")}
        </h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspacePage" style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "24px", borderRadius: "16px", maxWidth: "480px", margin: "0 auto" }}>
          <AlertCircle size={32} color="#dc2626" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>{t("history.error")}</h3>
          <p style={{ fontSize: "13px", color: "#7f1d1d", marginBottom: "16px" }}>{error}</p>
          <button
            onClick={fetchHistory}
            data-speak="Retry loading medical history"
            style={{
              background: "#dc2626",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <RefreshCw size={14} /> {t("history.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspacePage" style={{ paddingBottom: "40px" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: "flex", flexDirection: "column", gap: "28px" }}
      >
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1
              data-speak="Longitudinal Medical History"
              style={{ fontSize: "28px", fontFamily: "var(--font-sans)", fontWeight: "700", color: "var(--color-dark)" }}
            >
              {t("history.title")}
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginTop: "6px", fontSize: "14px", maxWidth: "680px" }}>
              {t("history.subtitle")}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate("/patient/dashboard")}
              data-speak="Upload Document"
              style={{
                background: "#0d9488",
                color: "#ffffff",
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Upload size={15} /> {t("history.uploadRecord")}
            </button>

            <button
              onClick={fetchHistory}
              data-speak="Refresh medical history"
              style={{
                background: "#ffffff",
                color: "var(--color-dark)",
                border: "1px solid var(--color-border)",
                padding: "10px 14px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Health Metrics & Quick Overview Strip */}
        {showOverviewCard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              padding: "24px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
              position: "relative"
            }}
          >
            <button
              onClick={() => setShowOverviewCard(false)}
              aria-label="Dismiss overview summary"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#94a3b8",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={14} />
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Timeline Records
                </span>
                <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
                  {timeline.length} <span style={{ fontSize: "14px", fontWeight: "400", color: "#cbd5e1" }}>events</span>
                </h3>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Active Medications
                </span>
                <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#38bdf8", marginTop: "4px" }}>
                  {currentMedications.length} <span style={{ fontSize: "14px", fontWeight: "400", color: "#cbd5e1" }}>prescribed</span>
                </h3>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Doctor Consultations
                </span>
                <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#a7f3d0", marginTop: "4px" }}>
                  {consultations.length} <span style={{ fontSize: "14px", fontWeight: "400", color: "#cbd5e1" }}>sessions</span>
                </h3>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Allergies & Conditions
                </span>
                <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#fca5a5", marginTop: "4px" }}>
                  {allergies.length + conditions.length} <span style={{ fontSize: "14px", fontWeight: "400", color: "#cbd5e1" }}>recorded</span>
                </h3>
              </div>
            </div>
          </motion.div>
        )}

        {/* Search & Category Filter Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Search Box */}
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={18}
              color="var(--color-text-muted)"
              style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder={t("history.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-speak="Search medical timeline by keyword"
              style={{
                width: "100%",
                padding: "12px 16px 12px 46px",
                borderRadius: "14px",
                border: "1px solid var(--color-border)",
                background: "#ffffff",
                fontSize: "14px",
                color: "var(--color-dark)",
                outline: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer"
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Pill Filters */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "6px",
              scrollbarWidth: "none"
            }}
          >
            {[
              { id: "all", label: t("history.filterAll"), count: categoryCounts.all },
              { id: "consultation", label: t("history.filterConsultations"), count: categoryCounts.consultation },
              { id: "prescription", label: t("history.filterPrescriptions"), count: categoryCounts.prescription },
              { id: "lab_test", label: t("history.filterTests"), count: categoryCounts.lab_test },
              { id: "assessment", label: t("history.filterAssessments"), count: categoryCounts.assessment },
              { id: "diagnosis", label: t("history.filterDiagnoses"), count: categoryCounts.diagnosis },
              { id: "procedure", label: t("history.filterProcedures"), count: categoryCounts.procedure },
              { id: "allergy", label: t("history.filterAllergies"), count: categoryCounts.allergy },
              { id: "document", label: t("history.filterDocuments"), count: categoryCounts.document },
            ].map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  data-speak={`Filter by ${filter.label}`}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: isActive ? "700" : "500",
                    background: isActive ? "#0d9488" : "#ffffff",
                    color: isActive ? "#ffffff" : "var(--color-dark)",
                    border: isActive ? "1px solid #0d9488" : "1px solid var(--color-border)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s ease"
                  }}
                >
                  {filter.label}
                  <span
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#64748b",
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Longitudinal Vertical Timeline */}
        <div
          className="workspaceCard"
          style={{
            background: "#ffffff",
            padding: "28px",
            borderRadius: "20px",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ background: "#ccfbf1", padding: "10px", borderRadius: "12px", color: "#0d9488" }}>
                <Clock size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-dark)" }}>
                  {t("history.timeline")}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Showing {filteredTimeline.length} of {timeline.length} health records (newest first)
                </span>
              </div>
            </div>
          </div>

          {/* Timeline List or Empty State */}
          {filteredTimeline.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f1f5f9", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Calendar size={32} />
              </div>
              <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-dark)", marginBottom: "6px" }}>
                {t("history.emptyTitle")}
              </h4>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", maxWidth: "400px", margin: "0 auto 24px" }}>
                {t("history.emptyDesc")}
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                {(activeFilter !== "all" || searchQuery) && (
                  <button
                    onClick={() => { setActiveFilter("all"); setSearchQuery(""); }}
                    data-speak="Reset filters"
                    style={{
                      background: "#f1f5f9",
                      color: "var(--color-dark)",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    {t("history.clearSearch")}
                  </button>
                )}
                <button
                  onClick={() => navigate("/patient/dashboard")}
                  data-speak="Start clinical intake"
                  style={{
                    background: "#0d9488",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <PlusCircle size={15} /> {t("history.startIntake")}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              
              {/* Vertical Connector Line */}
              <div
                style={{
                  position: "absolute",
                  left: "23px",
                  top: "24px",
                  bottom: "24px",
                  width: "2px",
                  background: "#e2e8f0",
                  zIndex: 0
                }}
              />

              {filteredTimeline.map((event, idx) => {
                const config = getCategoryConfig(event.type, event.category);
                const isExpanded = expandedId === event.id;

                return (
                  <div
                    key={event.id || idx}
                    style={{
                      display: "flex",
                      gap: "20px",
                      position: "relative",
                      zIndex: 1,
                      paddingBottom: idx === filteredTimeline.length - 1 ? "0" : "28px"
                    }}
                  >
                    {/* Icon Node */}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: config.bg,
                        color: config.color,
                        border: `1px solid ${config.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                      }}
                    >
                      {config.icon}
                    </div>

                    {/* Timeline Card */}
                    <div
                      style={{
                        flex: 1,
                        background: "#fafafa",
                        borderRadius: "16px",
                        border: "1px solid #f1f5f9",
                        padding: "18px 20px",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <span
                              style={{
                                background: config.badgeBg,
                                color: config.badgeText,
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700"
                              }}
                            >
                              {event.type || config.label}
                            </span>
                            {renderProvenanceBadge(event)}
                          </div>

                          <h4
                            data-speak={event.title}
                            style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-dark)", marginTop: "4px" }}
                          >
                            {event.title}
                          </h4>
                          {event.subtitle && (
                            <p style={{ fontSize: "13px", color: config.color, fontWeight: "600", marginTop: "2px" }}>
                              {event.subtitle}
                            </p>
                          )}
                        </div>

                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={13} />
                          {new Date(event.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>

                      {/* Brief Details */}
                      {event.details && (
                        <p style={{ fontSize: "13px", color: "#334155", marginTop: "8px", lineHeight: "1.5" }}>
                          {event.details}
                        </p>
                      )}

                      {/* Document Action Button */}
                      {event.documentId && (
                        <div style={{ marginTop: "12px" }}>
                          <button
                            onClick={() => handleOpenDocument(event.documentId)}
                            data-speak={`View document for ${event.title}`}
                            style={{
                              background: "#ffffff",
                              color: "#0d9488",
                              border: "1px solid #ccfbf1",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <ExternalLink size={12} /> {t("history.viewDocument")}
                          </button>
                        </div>
                      )}

                      {/* Expand / Collapse Control for Detailed Provenance */}
                      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          Source: {event.source || "MediKiosk Health System"}
                        </span>

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          data-speak={isExpanded ? "Collapse details" : "Expand details"}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--color-dark)",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {isExpanded ? (
                            <>
                              {t("history.collapseDetails")} <ChevronUp size={14} />
                            </>
                          ) : (
                            <>
                              {t("history.expandDetails")} <ChevronDown size={14} />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Accordion Detailed View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}
                          >
                            {/* Consultation Details */}
                            {event.type === "Consultation" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                                <div><strong>Doctor:</strong> {event.doctorName} ({event.specialization})</div>
                                {event.clinicalNotes && (
                                  <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <strong>Clinical Notes:</strong> {event.clinicalNotes}
                                  </div>
                                )}
                                {event.treatmentNotes && (
                                  <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <strong>Treatment Plan:</strong> {event.treatmentNotes}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Assessment Details */}
                            {event.type === "Assessment" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                                {event.redFlags && event.redFlags.length > 0 && (
                                  <div style={{ background: "#fef2f2", color: "#991b1b", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                    <strong>Clinical Red Flags:</strong> {event.redFlags.join(", ")}
                                  </div>
                                )}
                                <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                  <strong>AI Summary:</strong> {event.details}
                                </div>
                              </div>
                            )}

                            {/* Document / OCR Details */}
                            {(event.type === "Document" || event.type === "Prescription" || event.type === "Lab Test") && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                                {event.ocrStatus && (
                                  <div><strong>OCR Processing Status:</strong> <span style={{ textTransform: "capitalize" }}>{event.ocrStatus}</span></div>
                                )}
                                {event.details && (
                                  <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <strong>AI Extracted Summary:</strong> {event.details}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Generic fallback */}
                            {!["Consultation", "Assessment", "Document", "Prescription", "Lab Test"].includes(event.type) && (
                              <div style={{ fontSize: "13px", color: "var(--color-dark)" }}>
                                <strong>Recorded Details:</strong> {event.details || "No additional parameters recorded."}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Detailed Summary Cards Grid (Allergies, Medications, Prescriptions) */}
        <div className="workspaceGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>
          
          {/* Active Allergies & Diagnosed Conditions */}
          <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#fee2e2", padding: "10px", borderRadius: "12px", color: "#ef4444" }}>
                <ShieldAlert size={20} />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
                {t("history.allergiesAndConditions")}
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#ef4444", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {t("history.allergies")}
                </span>
                {allergies.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "6px", fontStyle: "italic" }}>
                    {t("history.noAllergies")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                    {allergies.map((allergy) => (
                      <div key={allergy.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#991b1b" }}>{allergy.name}</h4>
                          {allergy.description && <p style={{ fontSize: "12px", color: "#7f1d1d", marginTop: "2px" }}>{allergy.description}</p>}
                        </div>
                        <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                          {allergy.status || "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />

              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#0369a1", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {t("history.conditions")}
                </span>
                {conditions.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "6px", fontStyle: "italic" }}>
                    {t("history.noConditions")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                    {conditions.map((cond) => (
                      <div key={cond.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "10px", background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                        <div>
                          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#0369a1" }}>{cond.name}</h4>
                          <p style={{ fontSize: "12px", color: "#0284c7", marginTop: "2px" }}>
                            Diagnosed: {new Date(cond.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                          {cond.status || "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current Active Medications */}
          <div className="workspaceCard" style={{ background: "#ffffff", padding: "24px", borderRadius: "18px", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#e0e7ff", padding: "10px", borderRadius: "12px", color: "#4f46e5" }}>
                <Syringe size={20} />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--color-dark)" }}>
                {t("history.currentMedications")}
              </h3>
            </div>

            {currentMedications.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                {t("history.noMedications")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {currentMedications.map((med) => (
                  <div key={med.id} style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e0e7ff", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-dark)" }}>{med.name}</h4>
                      {med.dosage && <span style={{ fontSize: "12px", fontWeight: "700", color: "#4f46e5" }}>{med.dosage}</span>}
                    </div>
                    {med.frequency && <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{med.frequency}</p>}
                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "inline-block" }}>Source: {med.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </motion.div>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => fetchHistory()}
        />
      )}
    </div>
  );
}
