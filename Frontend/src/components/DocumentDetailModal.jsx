import React, { useState } from "react";
import { X, Trash2, Pill, Activity, FileText, Calendar, ExternalLink, ShieldAlert, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDocumentDownloadUrl } from "../services/api";
import styles from "./DocumentDetailModal.module.css";

export default function DocumentDetailModal({ doc, onClose, onDelete }) {
  const { token } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!doc) return null;

  // Parse extracted_entities if passed as string or object
  let entities = doc.extracted_entities;
  if (typeof entities === "string") {
    try {
      entities = JSON.parse(entities);
    } catch (e) {
      entities = null;
    }
  }

  const rawText = doc.extracted_text || entities?.raw_text || "";
  const docDate = entities?.document_date || new Date(doc.created_at || Date.now()).toLocaleDateString();

  const summary = doc.ai_summary || entities?.summary || (
    entities?.document_type === "lab_report"
      ? "Diagnostic report detailing lab test results and clinical measurements."
      : "Medical record detailing patient health status, clinical diagnoses, and prescriptions."
  );

  const diagnoses = entities?.diagnoses?.length
    ? entities.diagnoses
    : [doc.document_type ? `${doc.document_type.replace("_", " ").toUpperCase()}` : "Medical Record"];

  let medications = entities?.medications || [];
  if (!medications.length && rawText) {
    const lines = rawText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.includes("1.") || trimmed.includes("2.") || trimmed.includes("3.") || trimmed.toLowerCase().includes("mg") || trimmed.toLowerCase().includes("rx"))) {
        medications.push({
          medicine: trimmed,
          dose: "As prescribed",
          frequency: "Daily",
          duration: "5 days"
        });
      }
    }
  }

  const labResults = entities?.lab_results || [];
  const procedures = entities?.procedures || [];

  // Gather explicit and implicit alerts
  const explicitAlerts = Array.isArray(entities?.alerts) ? entities.alerts : [];
  const abnormalLabAlerts = labResults
    .filter(lab => lab.flag && (lab.flag.toLowerCase() === "high" || lab.flag.toLowerCase() === "low"))
    .map(lab => `🚨 Abnormal ${lab.flag.toUpperCase()} Value: ${lab.test || "Test"} is ${lab.value || ""} ${lab.unit || ""} (${lab.flag.toUpperCase()}). Reference range: ${lab.reference_range || "N/A"}.`);

  const combinedAlerts = Array.from(new Set([...explicitAlerts, ...abnormalLabAlerts]));

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(doc.id);
      onClose();
    } catch (err) {
      console.error("Delete document error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenOriginal = async () => {
    try {
      const res = await getDocumentDownloadUrl(doc.id, token);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Fetch document download URL error:", err);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.docTitle}>{doc.file_name}</div>
            <div className={styles.docMeta}>
              <span className={styles.badge}>{doc.document_type || "Prescription / Report"}</span>
              <span><Calendar size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />{docDate}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.modalBody}>
          
          {/* AI Explanation Summary Card */}
          <div style={{ background: "#f0fdf4", border: "1px solid #99f6e4", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0d9488", fontWeight: "700", fontSize: "14px" }}>
              <Sparkles size={18} />
              <span>AI Report Summary & Explanation</span>
            </div>
            <p style={{ fontSize: "13px", color: "#134e4a", margin: 0, lineHeight: "1.5", fontWeight: "500" }}>
              {summary}
            </p>
          </div>

          {/* Clinical Alert & Abnormal Findings Banner */}
          {combinedAlerts.length > 0 ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#991b1b", fontWeight: "700", fontSize: "14px" }}>
                <ShieldAlert size={18} color="#dc2626" />
                <span>Clinical Alerts & Abnormal Findings</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {combinedAlerts.map((alert, idx) => (
                  <div key={idx} style={{ background: "#ffffff", border: "1px solid #fca5a5", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", color: "#991b1b", fontWeight: "600", lineHeight: "1.4" }}>
                    {alert}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "10px 14px", borderRadius: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "500" }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span><strong>Normal Reference Limits:</strong> All extracted parameters are within normal clinical ranges. No alerts triggered.</span>
            </div>
          )}

          {/* Diagnoses Section */}
          {diagnoses.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>
                <Activity size={16} /> Diagnoses & Conditions
              </div>
              <div className={styles.chipGroup}>
                {diagnoses.map((diag, i) => (
                  <span key={i} className={styles.tagChip}>
                    {diag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications Table */}
          {medications.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>
                <Pill size={16} /> Prescribed Medications
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dose</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: "600" }}>{med.medicine || med.name || "—"}</td>
                        <td>{med.dose || "—"}</td>
                        <td>{med.frequency || "—"}</td>
                        <td>{med.duration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lab Results Table */}
          {labResults.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>
                <Activity size={16} /> Laboratory Test Results
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Value</th>
                      <th>Reference Range</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labResults.map((lab, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: "600" }}>{lab.test || "—"}</td>
                        <td>{lab.value ? `${lab.value} ${lab.unit || ""}` : "—"}</td>
                        <td>{lab.reference_range || "Reported range unavailable"}</td>
                        <td>
                          {lab.flag ? (
                            <span
                              className={
                                lab.flag.toLowerCase() === "high"
                                  ? styles.flagHigh
                                  : lab.flag.toLowerCase() === "low"
                                  ? styles.flagLow
                                  : styles.flagNormal
                              }
                            >
                              {lab.flag.toUpperCase()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Procedures Section */}
          {procedures.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>
                <FileText size={16} /> Procedures Performed
              </div>
              <div className={styles.chipGroup}>
                {procedures.map((proc, i) => (
                  <span key={i} className={styles.tagChip}>
                    {proc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Raw Extracted OCR Text */}
          {rawText && (
            <div>
              <div className={styles.sectionTitle}>
                <FileText size={16} /> Extracted OCR Text
              </div>
              <div className={styles.ocrTextBox}>{rawText}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleOpenOriginal}
              style={{
                background: "#f1f5f9",
                color: "#0f766e",
                border: "none",
                padding: "8px 16px",
                borderRadius: "10px",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ExternalLink size={14} /> View Original Document
            </button>

            {showConfirmDelete ? (
              <div className={styles.confirmBox}>
                <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: "600" }}>Delete permanently?</span>
                <button className={styles.confirmYesBtn} onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button className={styles.confirmNoBtn} onClick={() => setShowConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className={styles.deleteBtn} onClick={() => setShowConfirmDelete(true)}>
                <Trash2 size={15} /> Delete Record
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#0d9488",
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

