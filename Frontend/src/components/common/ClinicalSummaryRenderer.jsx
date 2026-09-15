import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Stethoscope,
  Leaf,
  Activity,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Globe,
  Pill,
  TestTube
} from "lucide-react";
import styles from "./ClinicalSummaryRenderer.module.css";

/**
 * Clean helper to strip inline markdown bold/italics for pure text
 */
function cleanInlineMd(str = "") {
  return String(str)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Format field names into readable labels (e.g., "duration_onset" -> "Duration Onset")
 */
function formatFieldLabel(rawLabel = "") {
  const cleaned = cleanInlineMd(rawLabel).replace(/[:\-_]/g, " ").trim();
  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Robust parser for structured clinical intake markdown strings
 */
function parseStructuredClinicalMarkdown(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { isStructured: false };
  }

  const lines = rawText.split(/\r?\n/);
  
  const result = {
    isStructured: false,
    headerTitle: "",
    chiefComplaint: "",
    consultationPathway: "",
    intakeLanguage: "",
    triageUrgency: "",
    isUrgent: false,
    redFlags: [],
    entities: [],
    qaProgression: [],
    recommendations: [],
    otherSections: [],
    narrativeLines: []
  };

  let currentSection = "header"; // "header" | "red_flags" | "entities" | "qa" | "recommendations" | "other"
  let currentOtherSectionTitle = "";
  let currentOtherLines = [];
  let pendingQuestion = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Detect section headers
    if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const headerText = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
      const lower = headerText.toLowerCase();

      // Flush any pending other section
      if (currentSection === "other" && currentOtherSectionTitle) {
        result.otherSections.push({ title: currentOtherSectionTitle, lines: currentOtherLines });
        currentOtherSectionTitle = "";
        currentOtherLines = [];
      }

      if (lower.includes("clinical intake") || lower.includes("ai triage summary") || lower.includes("intake & ai triage")) {
        result.headerTitle = headerText;
        result.isStructured = true;
        currentSection = "header";
        continue;
      } else if (lower.includes("critical alert") || lower.includes("red flag") || lower.includes("warning")) {
        result.isStructured = true;
        currentSection = "red_flags";
        continue;
      } else if (lower.includes("extracted clinical") || lower.includes("entities") || lower.includes("clinical entities")) {
        result.isStructured = true;
        currentSection = "entities";
        continue;
      } else if (lower.includes("intake q&a") || lower.includes("q&a progression") || lower.includes("conversation") || lower.includes("progression")) {
        result.isStructured = true;
        currentSection = "qa";
        continue;
      } else if (lower.includes("clinical recommendation") || lower.includes("recommendations") || lower.includes("physician guidance")) {
        result.isStructured = true;
        currentSection = "recommendations";
        continue;
      } else {
        currentSection = "other";
        currentOtherSectionTitle = headerText;
        currentOtherLines = [];
        continue;
      }
    }

    // Process lines according to current section
    if (currentSection === "header") {
      const kvMatch = trimmed.match(/^[-*•]?\s*\*\*([^*]+)\*\*\s*:\s*(.+)$/i) || trimmed.match(/^[-*•]?\s*([^:]+):\s*(.+)$/i);
      if (kvMatch) {
        const key = kvMatch[1].trim().toLowerCase();
        const val = cleanInlineMd(kvMatch[2].trim());

        if (key.includes("chief complaint")) {
          result.chiefComplaint = val;
          result.isStructured = true;
        } else if (key.includes("pathway") || key.includes("consultation type")) {
          result.consultationPathway = val;
          result.isStructured = true;
        } else if (key.includes("language") || key.includes("intake language")) {
          result.intakeLanguage = val;
        } else if (key.includes("urgency") || key.includes("triage")) {
          result.triageUrgency = val;
          result.isUrgent = /🔴|high|urgent|emergency|critical/i.test(val);
          result.isStructured = true;
        } else {
          result.entities.push({ label: formatFieldLabel(key), value: val });
        }
      } else {
        result.narrativeLines.push(trimmed);
      }
    } else if (currentSection === "red_flags") {
      let item = trimmed.replace(/^[-*•]\s*/, "");
      item = item.replace(/^[🚨⚠️\s]+/, "");
      item = cleanInlineMd(item);
      if (item && !/^(?:none|no red flags|nil|n\/a)$/i.test(item)) {
        result.redFlags.push(item);
        result.isUrgent = true;
      }
    } else if (currentSection === "entities") {
      const kvMatch = trimmed.match(/^[-*•]?\s*\*\*([^*]+)\*\*\s*:\s*(.+)$/i) || trimmed.match(/^[-*•]?\s*([^:]+):\s*(.+)$/i);
      if (kvMatch) {
        const rawKey = kvMatch[1].trim();
        const val = cleanInlineMd(kvMatch[2].trim());
        result.entities.push({ label: formatFieldLabel(rawKey), value: val });
      } else {
        const bullet = trimmed.replace(/^[-*•]\s*/, "");
        if (bullet) result.entities.push({ label: "Observation", value: cleanInlineMd(bullet) });
      }
    } else if (currentSection === "qa") {
      // Handle Q&A formats:
      // Pattern 1: - **Q**: *Question text*\n  **A**: Answer text
      // Pattern 2: - **Q**: Question text
      //            - **A**: Answer text
      // Pattern 3: - **Patient Response**: ...
      if (/^[-*•]?\s*\*\*Q\*\*\s*:\s*(.+)$/i.test(trimmed)) {
        const qMatch = trimmed.match(/^[-*•]?\s*\*\*Q\*\*\s*:\s*(.+)$/i);
        pendingQuestion = cleanInlineMd(qMatch[1]);
      } else if (/^[-*•]?\s*\*\*A\*\*\s*:\s*(.+)$/i.test(trimmed)) {
        const aMatch = trimmed.match(/^[-*•]?\s*\*\*A\*\*\s*:\s*(.+)$/i);
        const answer = cleanInlineMd(aMatch[1]);
        if (pendingQuestion) {
          result.qaProgression.push({ question: pendingQuestion, answer });
          pendingQuestion = "";
        } else {
          result.qaProgression.push({ question: "Clinical Inquiry", answer });
        }
      } else if (/^[-*•]?\s*\*\*Patient Response\*\*\s*:\s*(.+)$/i.test(trimmed)) {
        const respMatch = trimmed.match(/^[-*•]?\s*\*\*Patient Response\*\*\s*:\s*(.+)$/i);
        result.qaProgression.push({ question: "Follow-up question", answer: cleanInlineMd(respMatch[1]) });
      } else if (trimmed.includes("**Q**:") && trimmed.includes("**A**:")) {
        const parts = trimmed.split("**A**:");
        const qPart = parts[0].replace(/^[-*•]?\s*\*\*Q\*\*\s*:\s*/i, "");
        const aPart = parts[1] || "";
        result.qaProgression.push({
          question: cleanInlineMd(qPart),
          answer: cleanInlineMd(aPart)
        });
      } else if (pendingQuestion) {
        // Maybe the next line is the answer without **A**:
        const possibleAnswer = trimmed.replace(/^[-*•]?\s*(?:\*\*A\*\*:?)?\s*/i, "");
        result.qaProgression.push({ question: pendingQuestion, answer: cleanInlineMd(possibleAnswer) });
        pendingQuestion = "";
      }
    } else if (currentSection === "recommendations") {
      const item = trimmed.replace(/^[-*•]\s*/, "");
      if (item) result.recommendations.push(cleanInlineMd(item));
    } else if (currentSection === "other") {
      currentOtherLines.push(trimmed);
    }
  }

  // Flush remaining other section
  if (currentSection === "other" && currentOtherSectionTitle) {
    result.otherSections.push({ title: currentOtherSectionTitle, lines: currentOtherLines });
  }

  // Check if anything meaningful was parsed
  if (
    result.chiefComplaint ||
    result.redFlags.length > 0 ||
    result.entities.length > 0 ||
    result.qaProgression.length > 0 ||
    result.recommendations.length > 0
  ) {
    result.isStructured = true;
  }

  return result;
}

/**
 * Generic Markdown formatter fallback component
 */
function GenericMarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = String(content).split(/\r?\n/);
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} style={{ height: "6px" }} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h3 key={`h1-${i}`} className={styles.mdHeading1}>
          <Stethoscope size={16} /> {cleanInlineMd(trimmed.replace(/^#\s*/, ""))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h4 key={`h2-${i}`} className={styles.mdHeading2}>
          <Activity size={15} /> {cleanInlineMd(trimmed.replace(/^##\s*/, ""))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h5 key={`h3-${i}`} className={styles.mdHeading3}>
          <FileText size={14} /> {cleanInlineMd(trimmed.replace(/^###\s*/, ""))}
        </h5>
      );
      continue;
    }

    // Key-Value rows: - **Key**: Value
    const kvMatch = trimmed.match(/^[-*•]?\s*\*\*([^*]+)\*\*\s*:\s*(.+)$/i);
    if (kvMatch) {
      elements.push(
        <div key={`kv-${i}`} className={styles.mdKvRow}>
          <span className={styles.mdKvKey}>{cleanInlineMd(kvMatch[1])}:</span>
          <span className={styles.mdKvVal}>{cleanInlineMd(kvMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet items: - item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const itemText = trimmed.replace(/^[-*•]\s*/, "");
      elements.push(
        <div key={`li-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: "3px 0", fontSize: "13px", color: "#334155" }}>
          <span style={{ color: "#0d9488", fontWeight: "bold", marginTop: "1px" }}>•</span>
          <span>{cleanInlineMd(itemText)}</span>
        </div>
      );
      continue;
    }

    // Plain paragraph
    elements.push(
      <p key={`p-${i}`} className={styles.mdParagraph}>
        {cleanInlineMd(trimmed)}
      </p>
    );
  }

  return <div className={styles.markdownBody}>{elements}</div>;
}

/**
 * Main Clinical Summary View & Renderer Component
 */
export default function ClinicalSummaryRenderer({
  summary = "",
  compact = false,
  showQaByDefault = true,
  className = "",
  style = {}
}) {
  const [isQaExpanded, setIsQaExpanded] = useState(showQaByDefault);

  // Parse structured summary or JSON object
  const parsedData = useMemo(() => {
    if (!summary) return null;

    // Check if summary is a JSON object or stringified JSON
    let jsonObj = null;
    if (typeof summary === "object" && summary !== null) {
      jsonObj = summary;
    } else if (typeof summary === "string" && (summary.trim().startsWith("{") || summary.trim().startsWith("["))) {
      try {
        jsonObj = JSON.parse(summary);
      } catch (e) {}
    }

    if (jsonObj) {
      return { isJson: true, data: jsonObj };
    }

    if (typeof summary === "string") {
      const parsed = parseStructuredClinicalMarkdown(summary);
      if (parsed.isStructured) {
        return { isStructured: true, ...parsed };
      }
    }

    return { isFallback: true, raw: summary };
  }, [summary]);

  if (!summary || !parsedData) {
    return (
      <div className={`${styles.emptyState} ${className}`} style={style}>
        No clinical summary recorded for this session.
      </div>
    );
  }

  // Handle JSON Objects (Medications, Lab results, etc.)
  if (parsedData.isJson) {
    const { data } = parsedData;
    const meds = data.medications || [];
    const labs = data.lab_results || [];
    const diags = data.diagnoses || [];
    const procs = data.procedures || [];
    const textSum = data.summary || "";

    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {textSum && (
          <div className={styles.headerCard}>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.6", color: "#1e293b", fontWeight: "500" }}>
              {cleanInlineMd(textSum)}
            </p>
          </div>
        )}

        {meds.length > 0 && (
          <div className={styles.entitiesSection}>
            <h4 className={styles.sectionTitle}>
              <Pill size={15} /> Prescribed Medications ({meds.length})
            </h4>
            <div className={styles.entitiesGrid}>
              {meds.map((m, idx) => (
                <div key={idx} className={styles.entityCard}>
                  <span className={styles.entityLabel}>
                    {m.medicine || m.name || `Medication #${idx + 1}`}
                  </span>
                  <span className={styles.entityValue}>
                    {m.dose || ""} {m.frequency ? `(${m.frequency})` : ""} {m.duration ? `• ${m.duration}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {labs.length > 0 && (
          <div className={styles.entitiesSection}>
            <h4 className={styles.sectionTitle}>
              <TestTube size={15} /> Laboratory Findings ({labs.length})
            </h4>
            <div className={styles.entitiesGrid}>
              {labs.map((l, idx) => (
                <div key={idx} className={styles.entityCard}>
                  <span className={styles.entityLabel}>{l.test || "Lab Test"}</span>
                  <span className={styles.entityValue}>
                    {l.value} {l.unit || ""} {l.reference_range ? `(Ref: ${l.reference_range})` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {diags.length > 0 && (
          <div className={styles.entitiesSection}>
            <h4 className={styles.sectionTitle}>
              <Activity size={15} /> Clinical Diagnoses
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {diags.map((d, idx) => (
                <span key={idx} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                  {typeof d === "string" ? d : d.diagnosis || d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {procs.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h4 className={styles.sectionTitle}>
              <CheckCircle2 size={15} /> Care Plan & Procedures
            </h4>
            <ul className={styles.recommendationsList}>
              {procs.map((p, idx) => (
                <li key={idx} className={styles.recommendationItem}>
                  <ArrowRight size={14} className={styles.recIcon} />
                  <span>{cleanInlineMd(typeof p === "string" ? p : p.name || p.instruction)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Handle Structured Clinical Markdown Intake
  if (parsedData.isStructured) {
    const isAyush = /ayush|ayurveda|yoga|unani|siddha|homeopathy/i.test(parsedData.consultationPathway);

    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {/* 1. Header & Triage Status Card */}
        <div className={styles.headerCard}>
          <div className={styles.headerTop}>
            <h4 className={styles.headerTitle}>
              <Sparkles size={16} /> Clinical Intake & AI Triage Summary
            </h4>
            {parsedData.triageUrgency && (
              <span
                className={`${styles.triageBadge} ${
                  parsedData.isUrgent ? styles.triageUrgent : styles.triageStandard
                }`}
              >
                {parsedData.isUrgent ? (
                  <>
                    <ShieldAlert size={14} /> High Priority / Urgent Attention
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Standard Outpatient
                  </>
                )}
              </span>
            )}
          </div>

          <div className={styles.metaTagsRow}>
            {parsedData.chiefComplaint && (
              <div className={styles.chiefComplaintHighlight}>
                <Stethoscope size={15} color="#0d9488" />
                <span>
                  <strong>Chief Complaint:</strong> {parsedData.chiefComplaint}
                </span>
              </div>
            )}

            {parsedData.consultationPathway && (
              <span
                className={`${styles.metaTag} ${
                  isAyush ? styles.pathwayAyush : styles.pathwayAllopathic
                }`}
              >
                {isAyush ? <Leaf size={13} /> : <Stethoscope size={13} />}
                <span>{parsedData.consultationPathway}</span>
              </span>
            )}

            {parsedData.intakeLanguage && (
              <span className={styles.metaTag}>
                <Globe size={13} />
                <span>Language: <strong>{parsedData.intakeLanguage.toUpperCase()}</strong></span>
              </span>
            )}
          </div>

          {parsedData.narrativeLines.length > 0 && (
            <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#475569", lineHeight: "1.5" }}>
              {parsedData.narrativeLines.map(cleanInlineMd).join(" ")}
            </p>
          )}
        </div>

        {/* 2. Critical Alerts / Red Flags */}
        {parsedData.redFlags.length > 0 && (
          <div className={styles.redFlagSection}>
            <div className={styles.redFlagHeader}>
              <ShieldAlert size={16} />
              <span>Critical Clinical Alerts / Red Flags Detected ({parsedData.redFlags.length})</span>
            </div>
            <ul className={styles.redFlagList}>
              {parsedData.redFlags.map((flag, idx) => (
                <li key={idx} className={styles.redFlagChip}>
                  <span>🚨</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Extracted Clinical Entities */}
        {parsedData.entities.length > 0 && (
          <div className={styles.entitiesSection}>
            <h4 className={styles.sectionTitle}>
              <Activity size={15} /> Extracted Clinical Entities
            </h4>
            <div className={styles.entitiesGrid}>
              {parsedData.entities.map((ent, idx) => (
                <div key={idx} className={styles.entityCard}>
                  <span className={styles.entityLabel}>{ent.label}</span>
                  <span className={styles.entityValue}>{ent.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Intake Q&A Progression */}
        {parsedData.qaProgression.length > 0 && (
          <div className={styles.qaSection}>
            <div className={styles.qaHeader}>
              <h4 className={styles.sectionTitle}>
                <MessageSquare size={15} /> Intake Q&A Progression ({parsedData.qaProgression.length} turns)
              </h4>
              <button
                type="button"
                className={styles.qaToggleBtn}
                onClick={() => setIsQaExpanded(!isQaExpanded)}
              >
                {isQaExpanded ? (
                  <>
                    <span>Collapse Q&A</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>Expand Q&A</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            </div>

            {isQaExpanded && (
              <div className={styles.qaList}>
                {parsedData.qaProgression.map((item, idx) => (
                  <div key={idx} className={styles.qaItem}>
                    <div className={styles.qaQuestion}>
                      <span className={styles.qaBadgeQ}>Q</span>
                      <span>{item.question}</span>
                    </div>
                    <div className={styles.qaAnswer}>
                      <span className={styles.qaBadgeA}>A</span>
                      <span>{item.answer}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Clinical Recommendations */}
        {parsedData.recommendations.length > 0 && (
          <div className={styles.recommendationsSection}>
            <h4 className={styles.sectionTitle}>
              <CheckCircle2 size={15} /> Clinical Recommendations & Guidance
            </h4>
            <ul className={styles.recommendationsList}>
              {parsedData.recommendations.map((rec, idx) => (
                <li key={idx} className={styles.recommendationItem}>
                  <ArrowRight size={14} className={styles.recIcon} />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 6. Other Parsed Custom Sections */}
        {parsedData.otherSections.map((sec, idx) => (
          <div key={idx} className={styles.entitiesSection}>
            <h4 className={styles.sectionTitle}>
              <FileText size={15} /> {sec.title}
            </h4>
            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <GenericMarkdownRenderer content={sec.lines.join("\n")} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: General Markdown Parser
  return (
    <div className={`${styles.container} ${className}`} style={style}>
      <GenericMarkdownRenderer content={parsedData.raw} />
    </div>
  );
}
