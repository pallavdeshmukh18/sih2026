import React from "react";
import { Download, FileText, AlertTriangle, CheckCircle2, Sparkles, Stethoscope } from "lucide-react";
import { downloadSummaryPDF } from "../../utils/pdfGenerator";
import toast from "react-hot-toast";

export default function ClinicalSummaryCard({
  summary = "",
  chiefComplaint = "",
  answeredFields = {},
  redFlags = [],
  patientName = "Patient",
  date = new Date().toLocaleDateString(),
  showDownloadBtn = true,
  className = "",
  style = {},
}) {
  const handleDownloadPDF = async () => {
    try {
      await downloadSummaryPDF({
        patientName,
        chiefComplaint,
        date,
        answeredFields,
        redFlags,
        summaryText: summary,
      });
      toast.success("Clinical Summary PDF downloaded!");
    } catch (err) {
      toast.error("Failed to generate PDF download.");
    }
  };

  // Clean raw markdown syntax for visual display
  const renderFormattedText = (raw) => {
    if (!raw) return null;
    const lines = raw.split("\n");
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: "6px" }} />;
      if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        const titleText = trimmed.replace(/^[#\s]+/, "").replace(/\*\*/g, "");
        return (
          <h4 key={idx} style={{ fontSize: "14px", fontWeight: "700", color: "#0d9488", marginTop: "12px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Stethoscope size={15} /> {titleText}
          </h4>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const itemText = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, "$1");
        return (
          <li key={idx} style={{ fontSize: "13px", color: "#334155", marginLeft: "16px", marginBottom: "4px", lineHeight: "1.5" }}>
            {itemText}
          </li>
        );
      }
      return (
        <p key={idx} style={{ fontSize: "13px", color: "#334155", margin: "4px 0", lineHeight: "1.6" }}>
          {trimmed.replace(/\*\*(.*?)\*\*/g, "$1")}
        </p>
      );
    });
  };

  return (
    <div
      className={className}
      style={{
        background: "#ffffff",
        border: "1px solid #99f6e4",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 20px rgba(13, 148, 136, 0.06)",
        fontFamily: "'Inter', sans-serif",
        ...style,
      }}
    >
      {/* Top Banner & PDF Download Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccfbf1", paddingBottom: "14px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <span style={{ background: "#ccfbf1", color: "#0f766e", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Sparkles size={12} /> Clinical RAG Output
          </span>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: "6px 0 0 0" }}>
            {chiefComplaint ? `Clinical Intake Summary: ${chiefComplaint}` : "AI Clinical Intake Summary"}
          </h3>
        </div>

        {showDownloadBtn && (
          <button
            type="button"
            onClick={handleDownloadPDF}
            style={{
              background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
              color: "#ffffff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(13, 148, 136, 0.2)",
              transition: "transform 0.15s ease",
            }}
          >
            <Download size={14} /> Download PDF Report
          </button>
        )}
      </div>

      {/* Synthesis Overview Paragraph */}
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "12px", padding: "14px 16px", marginBottom: "14px" }}>
        <strong style={{ fontSize: "13px", fontWeight: "700", color: "#0d9488", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <FileText size={15} /> Clinical Overview & Assessment Snapshot
        </strong>
        <p style={{ fontSize: "13px", color: "#1e293b", margin: 0, lineHeight: "1.6" }}>
          {chiefComplaint ? `Patient presented for ${chiefComplaint}. ` : ""}
          {redFlags && redFlags.length > 0
            ? `Key clinical evaluation identified ${redFlags.length} red flag indicator(s) requiring physician attention. `
            : "No urgent red flags were flagged during automated intake. "}
          {answeredFields && Object.keys(answeredFields).length > 0
            ? `Structured symptoms and ${Object.keys(answeredFields).length} vital parameter(s) have been captured for doctor review.`
            : "Comprehensive symptom analysis and relevant history have been compiled for medical consultation."}
        </p>
      </div>

      {/* Dedicated Physician Reading Note Paragraph */}
      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
        <strong style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <Stethoscope size={15} /> Attending Physician Clinical Briefing & Action Notes
        </strong>
        <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: "1.6" }}>
          This pre-consultation report has been generated by the MediKiosk Clinical AI RAG Engine. It compiles patient self-reported progression, symptom intensity, and vital parameters. Please verify the identified red flags during the physical examination, review the attached longitudinal timeline records, and validate diagnostic differentials prior to finalizing the treatment plan.
        </p>
      </div>

      {/* Red Flags Callout */}
      {redFlags && redFlags.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px" }}>
          <strong style={{ color: "#dc2626", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <AlertTriangle size={15} /> Red Flags Identified ({redFlags.length})
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {redFlags.map((flag, i) => (
              <span key={i} style={{ background: "#fee2e2", color: "#991b1b", fontSize: "12px", padding: "3px 10px", borderRadius: "6px", fontWeight: "600" }}>
                ⚠️ {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Answered Clinical Parameters Chips */}
      {answeredFields && Object.keys(answeredFields).length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <strong style={{ fontSize: "12px", color: "#047857", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
            📋 Answered Clinical Parameters
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {Object.entries(answeredFields).map(([k, v]) => (
              <span
                key={k}
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: "1.4",
                }}
              >
                <strong>{k.replace(/_/g, " ")}:</strong> {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Formatted Summary Content */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
        {renderFormattedText(summary)}
      </div>
    </div>
  );
}
