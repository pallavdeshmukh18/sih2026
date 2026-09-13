import React, { useState, useEffect } from "react";
import {
  Download,
  X,
  FileText,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import { getMedicalPassport } from "../../services/api";
import { exportMedicalPassportPDF } from "../../utils/medicalPassportPdfGenerator";
import styles from "./ExportPassportModal.module.css";

export default function ExportPassportModal({
  isOpen,
  onClose,
  currentData,
  initialTimeRange = "1_year",
  initialStart = "",
  initialEnd = "",
  token,
}) {
  const [selectedRange, setSelectedRange] = useState(initialTimeRange);
  const [customStart, setCustomStart] = useState(initialStart);
  const [customEnd, setCustomEnd] = useState(initialEnd);

  // Sections configuration
  const [sections, setSections] = useState({
    patientProfile: true,
    healthSummary: true,
    allergies: true,
    conditions: true,
    medications: true,
    procedures: true,
    consultations: true,
    investigations: true,
    timeline: true,
    ayush: true,
    connectedProviders: false,
    secureQr: false,
  });

  // Privacy controls
  const [privacy, setPrivacy] = useState({
    name: true,
    dobAge: true,
    gender: true,
    state: true,
    language: true,
    bloodGroup: true,
    phone: false,
    email: false,
    abhaId: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Synchronize when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRange(initialTimeRange);
      setCustomStart(initialStart);
      setCustomEnd(initialEnd);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, initialTimeRange, initialStart, initialEnd]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllSections = (val) => {
    setSections({
      patientProfile: val,
      healthSummary: val,
      allergies: val,
      conditions: val,
      medications: val,
      procedures: val,
      consultations: val,
      investigations: val,
      timeline: val,
      ayush: val,
      connectedProviders: val,
      secureQr: false, // QR remains off by default for patient security
    });
  };

  // Human readable period label
  const rangeLabels = {
    "3_months": "Last 3 Months",
    "1_year": "Last 1 Year",
    "2_years": "Last 2 Years",
    "5_years": "Last 5 Years",
    "all": "All Available History",
    "custom": "Custom Date Range",
  };

  const selectedSectionsCount = Object.values(sections).filter(Boolean).length;
  const patientName = currentData?.patient?.name || currentData?.demographics?.name || "Patient";

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let exportData = currentData;

      // If user changed reporting period in modal, fetch canonical data for that period
      const isDifferentPeriod =
        selectedRange !== initialTimeRange ||
        (selectedRange === "custom" && (customStart !== initialStart || customEnd !== initialEnd));

      if (isDifferentPeriod && token) {
        const res = await getMedicalPassport(token, {
          timeRange: selectedRange,
          startDate: selectedRange === "custom" ? customStart : undefined,
          endDate: selectedRange === "custom" ? customEnd : undefined,
        });

        if (res?.data?.medicalPassport) {
          exportData = res.data.medicalPassport;
        } else if (res?.data?.medicalId) {
          exportData = res.data.medicalId;
        } else if (res?.data) {
          exportData = res.data;
        }
      }

      if (!exportData) {
        throw new Error("Missing passport data");
      }

      // Generate PDF
      await exportMedicalPassportPDF({
        data: exportData,
        periodLabel: rangeLabels[selectedRange] || "Last 1 Year",
        startDate: selectedRange === "custom" ? customStart : null,
        endDate: selectedRange === "custom" ? customEnd : null,
        sections,
        privacy,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("Unable to export Medical Passport.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className={styles.modal}>
        {/* MODAL HEADER */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIcon}>
              <FileText size={20} />
            </div>
            <div>
              <h3 id="export-modal-title">Export Medical Passport</h3>
              <p>Configure and download a structured medical resume PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className={styles.closeBtn}
            aria-label="Close export configuration"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className={styles.modalBody}>
          {/* 1. REPORT PERIOD */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <span>Report Period</span>
            </div>
            <div className={styles.periodGrid}>
              {[
                { key: "3_months", label: "Last 3 Months" },
                { key: "1_year", label: "Last 1 Year" },
                { key: "2_years", label: "Last 2 Years" },
                { key: "5_years", label: "Last 5 Years" },
                { key: "all", label: "All History" },
                { key: "custom", label: "Custom Range" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedRange(p.key)}
                  className={`${styles.periodBtn} ${selectedRange === p.key ? styles.periodActive : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {selectedRange === "custom" && (
              <div className={styles.customDateBox}>
                <label>
                  From:{" "}
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </label>
                <label>
                  To:{" "}
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* 2. SECTIONS TO INCLUDE */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <span>Sections to Include</span>
              <div className={styles.actionLinks}>
                <button type="button" onClick={() => selectAllSections(true)}>
                  Select All
                </button>
                <button type="button" onClick={() => selectAllSections(false)}>
                  Deselect All
                </button>
              </div>
            </div>
            <div className={styles.checkGrid}>
              {[
                { key: "patientProfile", label: "Patient Demographic Profile", hint: "Name, age, gender, state" },
                { key: "healthSummary", label: "Health Summary", hint: "Synthesized clinical narrative" },
                { key: "allergies", label: "Allergies & Sensitivities", hint: "Safety alerts & reactions" },
                { key: "conditions", label: "Known Conditions", hint: "Active & past diagnoses" },
                { key: "medications", label: "Medications", hint: "Recently recorded regimens" },
                { key: "procedures", label: "Procedures & Surgeries", hint: "Surgical & clinical procedures" },
                { key: "consultations", label: "Consultations", hint: "Physician visits & treatment notes" },
                { key: "investigations", label: "Investigations", hint: "Laboratory findings & lab flags" },
                { key: "timeline", label: "Medical Timeline", hint: "Chronological sequence of events" },
                { key: "ayush", label: "AYUSH Health Profile", hint: "Prakriti & holistic regimen" },
                { key: "connectedProviders", label: "Connected Care Providers", hint: "Authorized doctors (optional)" },
                { key: "secureQr", label: "Secure Provider Connection QR", hint: "Pairing code (optional)" },
              ].map((item) => (
                <label key={item.key} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={!!sections[item.key]}
                    onChange={() => toggleSection(item.key)}
                  />
                  <div className={styles.checkText}>
                    <span className={styles.checkLabel}>{item.label}</span>
                    <span className={styles.checkHint}>{item.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 3. PRIVACY & PERSONAL IDENTIFICATION */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Lock size={14} color="#0d9488" />
                <span>Privacy & Personally Identifying Information</span>
              </div>
            </div>
            <p className={styles.sectionSub}>
              Choose which personal contact identifiers appear in the exported PDF. Sensitive contact details are off by default.
            </p>
            <div className={styles.checkGrid}>
              {[
                { key: "name", label: "Patient Full Name", hint: "Recommended" },
                { key: "dobAge", label: "Date of Birth & Age", hint: "Recommended" },
                { key: "gender", label: "Gender", hint: "Recommended" },
                { key: "state", label: "State / Region", hint: "Recommended" },
                { key: "language", label: "Preferred Language", hint: "Recommended" },
                { key: "bloodGroup", label: "Blood Group", hint: "If available in profile" },
                { key: "phone", label: "Phone Number", hint: "Private contact" },
                { key: "email", label: "Email Address", hint: "Private contact" },
                { key: "abhaId", label: "ABHA Health ID", hint: "National health identity" },
              ].map((item) => (
                <label key={item.key} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={!!privacy[item.key]}
                    onChange={() => togglePrivacy(item.key)}
                  />
                  <div className={styles.checkText}>
                    <span className={styles.checkLabel}>{item.label}</span>
                    <span className={styles.checkHint}>{item.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 4. PREVIEW SUMMARY BANNER */}
          <div className={styles.previewBanner}>
            <div className={styles.previewItem}>
              <span className={styles.previewKey}>Document</span>
              <span className={styles.previewVal}>Medical Passport</span>
            </div>
            <div className={styles.previewItem}>
              <span className={styles.previewKey}>Period</span>
              <span className={styles.previewVal}>{rangeLabels[selectedRange] || "Last 1 Year"}</span>
            </div>
            <div className={styles.previewItem}>
              <span className={styles.previewKey}>Sections</span>
              <span className={styles.previewVal}>{selectedSectionsCount} selected</span>
            </div>
            <div className={styles.previewItem}>
              <span className={styles.previewKey}>Patient</span>
              <span className={styles.previewVal}>
                {privacy.name ? patientName : "Confidential"}
              </span>
            </div>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className={styles.errorAlert}>
              <span>{error}</span>
              <button
                type="button"
                onClick={handleExport}
                style={{
                  background: "transparent",
                  border: "1px solid #b91c1c",
                  borderRadius: "4px",
                  color: "#b91c1c",
                  padding: "2px 8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {success && (
            <div
              style={{
                padding: "10px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                color: "#166534",
                fontSize: "12.5px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Check size={16} />
              <span>Medical Passport exported successfully.</span>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className={styles.modalFooter}>
          <div className={styles.footerNote}>
            <ShieldCheck size={15} color="#0d9488" />
            <span>Generates print-ready vector PDF document.</span>
          </div>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={loading || selectedSectionsCount === 0}
            >
              {loading ? (
                <>
                  <Loader2 className={styles.spin} size={15} />
                  <span>Preparing PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
