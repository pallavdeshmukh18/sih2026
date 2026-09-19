import { jsPDF as JsPDFNamed } from "jspdf";
import jsPDFDefault from "jspdf";
import { parseClinicalSummary } from "./clinicalSummaryParser";

const jsPDF = typeof JsPDFNamed === "function" ? JsPDFNamed : (typeof jsPDFDefault === "function" ? jsPDFDefault : (jsPDFDefault.jsPDF || jsPDFDefault));


/**
 * Normalizes text to avoid encoding / font glitches in standard Helvetica
 */
function cleanText(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^[#]+\s*/, "")
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean and parse raw intake summary text into an executive clinical summary structure.
 * Strips raw markdown, UUIDs, internal identifiers, and extracts:
 * 1. Current Presentation / Clinical Snapshot (key-value grid)
 * 2. Clinical Overview (clean narrative text block)
 * 3. Clinical / Triage Flags (red flags list)
 */
function parseHealthSummaryData(rawSummary, recentAssessment = null) {
  const parsed = parseClinicalSummary(rawSummary, recentAssessment);
  const result = {
    presentation: {},
    overview: parsed.overview || "",
    clinicalFlags: parsed.clinicalFlags || [],
    provenanceDate: parsed.provenanceDate ? formatPdfDate(parsed.provenanceDate) : null,
    source: parsed.source || "MediKiosk clinical intake",
  };

  if (parsed.presentationList) {
    parsed.presentationList.forEach(item => {
      if (item.key === "Assessment Date") {
        result.presentation[item.key] = formatPdfDate(item.value);
      } else {
        result.presentation[item.key] = cleanText(item.value);
      }
    });
  }

  return result;
}

/**
 * Format a date string safely for clinical reports
 */
function formatPdfDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Generate a professional MediKiosk Medical Passport PDF
 */
export async function exportMedicalPassportPDF({
  data,
  periodLabel = "Last 1 Year",
  startDate = null,
  endDate = null,
  sections = {
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
  },
  privacy = {
    name: true,
    dobAge: true,
    gender: true,
    state: true,
    language: true,
    bloodGroup: true,
    abhaId: false,
    phone: false,
    email: false,
  },
}) {
  if (!data) {
    throw new Error("No medical passport data available to export");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (typeof doc.setCharSpace === "function") {
    doc.setCharSpace(0);
  }

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182
  const bottomMargin = 22;

  // Palette - MediKiosk Clinical Print
  const tealDark = [13, 110, 100]; // #0d6e64
  const tealPrimary = [13, 148, 136]; // #0d9488
  const tealLight = [240, 253, 250]; // #f0fdfa
  const tealBorder = [153, 246, 228]; // #99f6e4
  const textDark = [30, 41, 59]; // #1e293b
  const textMuted = [100, 116, 139]; // #64748b
  const redAlert = [185, 28, 28]; // #b91c1c
  const redLight = [254, 242, 242]; // #fef2f2
  const redBorder = [254, 202, 202]; // #fecaca
  const amberAlert = [180, 83, 9]; // #b45309
  const amberLight = [254, 243, 199]; // #fef3c7
  const amberBorder = [253, 230, 138]; // #fde68a
  const cardBg = [248, 250, 252]; // #f8fafc
  const cardBorder = [226, 232, 240]; // #e2e8f0

  let y = margin;

  // Function to ensure space on page, adding page with header if needed
  const ensureSpace = (neededHeight) => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 12; // Leave space for running header on page 2+
      return true;
    }
    return false;
  };

  // Extract Patient Profile
  const demo = data.patient || data.demographics || {};
  const patientDisplayName = privacy.name ? (demo.name || "Patient") : "Confidential Patient";

  // Compute reporting period string
  let periodString = periodLabel;
  if (startDate && endDate) {
    periodString = `${formatPdfDate(startDate)} - ${formatPdfDate(endDate)}`;
  } else if (data.reportingPeriod?.cutoffDate || data.appliedDateRange?.startDate) {
    const cut = data.reportingPeriod?.cutoffDate || data.appliedDateRange?.startDate;
    periodString = `${formatPdfDate(cut)} - Present (${periodLabel})`;
  }

  const generatedTimestamp = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ==========================================
  // 1. PAGE 1 HEADER BANNER
  // ==========================================
  doc.setFillColor(...tealDark);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Accent stripe
  doc.setFillColor(45, 212, 191);
  doc.rect(0, 0, pageWidth, 2.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("MEDIKIOSK MEDICAL PASSPORT", margin, 13);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("PORTABLE CLINICAL RESUME & HEALTH SUMMARY", margin, 19);

  doc.setFontSize(8);
  doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 13, { align: "right" });
  doc.text(`Report Period: ${cleanText(periodString)}`, pageWidth - margin, 19, { align: "right" });

  y = 35;

  // ==========================================
  // 2. PATIENT DEMOGRAPHIC PROFILE (IF ENABLED)
  // ==========================================
  if (sections.patientProfile) {
    ensureSpace(34);

    // Build visible demographic fields based on privacy configuration
    const demoFields = [];
    if (privacy.name && demo.name) demoFields.push({ label: "Patient Name", val: demo.name });
    if (privacy.dobAge) {
      const dobVal = demo.dateOfBirth || demo.dob;
      if (dobVal) demoFields.push({ label: "Date of Birth", val: formatPdfDate(dobVal) });
      if (demo.age !== undefined && demo.age !== null) demoFields.push({ label: "Age", val: `${demo.age} yrs` });
    }
    if (privacy.gender && demo.gender) demoFields.push({ label: "Gender", val: demo.gender });
    if (privacy.state && demo.state) demoFields.push({ label: "State / Region", val: demo.state });
    if (privacy.language && (demo.preferredLanguage || demo.preferred_language)) {
      demoFields.push({ label: "Preferred Language", val: demo.preferredLanguage || demo.preferred_language });
    }
    if (privacy.bloodGroup && (demo.bloodGroup || demo.blood_group)) {
      demoFields.push({ label: "Blood Group", val: demo.bloodGroup || demo.blood_group });
    }
    if (privacy.abhaId && (demo.abhaId || demo.abha_id)) {
      demoFields.push({ label: "ABHA ID", val: demo.abhaId || demo.abha_id });
    }
    if (privacy.phone && demo.phone) demoFields.push({ label: "Phone", val: demo.phone });
    if (privacy.email && demo.email) demoFields.push({ label: "Email", val: demo.email });

    const rowCount = Math.ceil(demoFields.length / 3);
    const boxHeight = 12 + rowCount * 8.5;

    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");

    // Left teal border stripe
    doc.setFillColor(...tealPrimary);
    doc.roundedRect(margin, y, 3, boxHeight, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...tealDark);
    doc.text("PATIENT DEMOGRAPHIC PROFILE", margin + 6, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text("Verified Identity Baseline", pageWidth - margin - 6, y + 6.5, { align: "right" });

    let currentFieldY = y + 13;
    const colWidth = (contentWidth - 12) / 3;

    demoFields.forEach((f, idx) => {
      const col = idx % 3;
      if (col === 0 && idx > 0) currentFieldY += 8.5;
      const x = margin + 6 + col * colWidth;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text(`${f.label.toUpperCase()}:`, x, currentFieldY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...textDark);
      doc.text(cleanText(f.val), x + 2, currentFieldY + 4);
    });

    y += boxHeight + 5;
  }

  // ==========================================
  // HELPER: DRAW SECTION HEADING
  // ==========================================
  const drawSectionHeading = (title, subtitle = null, badge = null, color = tealDark) => {
    ensureSpace(12);
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, "FD");

    // Accent bar
    doc.setFillColor(...color);
    doc.rect(margin, y, 2.5, 7, "F");

    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin + 5, y + 4.8);

    if (badge) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(badge, pageWidth - margin - 4, y + 4.8, { align: "right" });
    }

    y += 9.5;
  };

  // ==========================================
  // 3. HEALTH SUMMARY (IF ENABLED)
  // ==========================================
  if (sections.healthSummary && (data.healthSummary?.summary || data.recentAssessment)) {
    const rawSum = data.healthSummary?.summary || data.recentAssessment?.summary || "";
    const parsed = parseHealthSummaryData(rawSum, data.recentAssessment);

    const presEntries = Object.entries(parsed.presentation);
    const hasPresentation = presEntries.length > 0;
    const hasOverview = !!parsed.overview;
    const hasFlags = parsed.clinicalFlags.length > 0;

    if (hasPresentation || hasOverview || hasFlags) {
      ensureSpace(28);
      drawSectionHeading(
        "HEALTH SUMMARY",
        null,
        data.healthSummary?.isAiGenerated ? "AI-assisted clinical synthesis" : "Clinical intake synthesis"
      );

      // A) CURRENT PRESENTATION / CLINICAL SNAPSHOT
      if (hasPresentation) {
        const colCount = presEntries.length >= 3 ? 3 : (presEntries.length === 2 ? 2 : 1);
        const rowCount = Math.ceil(presEntries.length / colCount);
        const boxH = 9 + rowCount * 11;
        ensureSpace(boxH);

        doc.setFillColor(...tealLight);
        doc.setDrawColor(...tealBorder);
        doc.roundedRect(margin, y, contentWidth, boxH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...tealDark);
        doc.text("CURRENT PRESENTATION", margin + 4, y + 4.8);

        let curY = y + 8.5;
        const colW = (contentWidth - 8) / colCount;

        presEntries.forEach(([lbl, val], idx) => {
          const col = idx % colCount;
          if (col === 0 && idx > 0) curY += 11;
          const x = margin + 4 + col * colW;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...textMuted);
          doc.text(lbl.toUpperCase(), x, curY);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...textDark);
          const splitVal = doc.splitTextToSize(cleanText(val), colW - 4);
          doc.text(splitVal.slice(0, 2), x, curY + 3.8);
        });

        y += boxH + 3.5;
      }

      // B) CLINICAL OVERVIEW
      if (hasOverview) {
        const splitOverview = doc.splitTextToSize(parsed.overview, contentWidth - 10);
        const oBoxH = Math.max(12, splitOverview.length * 4.2 + 8.5);
        ensureSpace(oBoxH);

        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, oBoxH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...tealDark);
        doc.text("CLINICAL OVERVIEW", margin + 5, y + 4.8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        doc.text(splitOverview, margin + 5, y + 9.5);

        y += oBoxH + 3.5;
      }

      // C) SAFETY / TRIAGE INFORMATION (Clinical Flags)
      if (hasFlags) {
        const flagBoxH = 8 + parsed.clinicalFlags.length * 5;
        ensureSpace(flagBoxH);

        doc.setFillColor(...redLight);
        doc.setDrawColor(...redBorder);
        doc.roundedRect(margin, y, contentWidth, flagBoxH, 1.5, 1.5, "FD");

        doc.setFillColor(...redAlert);
        doc.roundedRect(margin, y, 2.5, flagBoxH, 1, 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...redAlert);
        doc.text("CLINICAL FLAGS / TRIAGE IDENTIFIERS", margin + 5, y + 4.8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(153, 27, 27);
        parsed.clinicalFlags.forEach((fl, idx) => {
          const itemY = y + 9.2 + idx * 5;
          doc.setFillColor(...redAlert);
          doc.circle(margin + 6, itemY - 1, 0.7, "F");
          doc.text(cleanText(fl), margin + 8.5, itemY);
        });

        y += flagBoxH + 3.5;
      }

      // D) PROVENANCE & DISCLAIMER
      ensureSpace(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...textMuted);
      const provDate = parsed.provenanceDate ? ` • ${parsed.provenanceDate}` : "";
      doc.text(`Source: ${cleanText(parsed.source)}${provDate}`, margin + 2, y + 3);
      doc.text(
        "Summarized from verified clinical records. Not a substitute for physician diagnosis.",
        pageWidth - margin - 2,
        y + 3,
        { align: "right" }
      );

      y += 6.5;
    }
  }

  // ==========================================
  // 4. CRITICAL INFORMATION: ALLERGIES (IF ENABLED)
  // ==========================================
  if (sections.allergies) {
    ensureSpace(20);
    drawSectionHeading("ALLERGIES & ADVERSE REACTIONS", null, "Safety-Critical Record", redAlert);

    const allergies = data.allergies || [];
    if (allergies.length > 0) {
      allergies.forEach((alg) => {
        ensureSpace(12);
        doc.setFillColor(...redLight);
        doc.setDrawColor(...redBorder);
        doc.roundedRect(margin, y, contentWidth, 10.5, 1.5, 1.5, "FD");

        // Red left accent
        doc.setFillColor(...redAlert);
        doc.roundedRect(margin, y, 2.5, 10.5, 1, 1, "F");

        const allergyName = cleanText(alg.allergy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...redAlert);
        const nameWidth = doc.getTextWidth(allergyName);
        doc.text(allergyName, margin + 5, y + 4.5);

        if (alg.isCurrentlyActive) {
          const badgeX = margin + 5 + nameWidth + 3;
          doc.setFillColor(...redAlert);
          doc.roundedRect(badgeX, y + 1.8, 14, 3.8, 0.8, 0.8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6.5);
          doc.text("ACTIVE", badgeX + 2.2, y + 4.4);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(153, 27, 27);
        const details = [
          alg.reaction ? `Reaction: ${cleanText(alg.reaction)}` : null,
          alg.severity ? `Severity: ${cleanText(alg.severity)}` : null,
          alg.source ? `Source: ${cleanText(alg.source)}` : null,
          alg.date ? `Recorded: ${formatPdfDate(alg.date)}` : null,
        ].filter(Boolean).join("  |  ");
        doc.text(details || "No reaction details provided", margin + 5, y + 8.5);

        y += 12.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No allergies recorded in the available records.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 5. KNOWN CONDITIONS (IF ENABLED)
  // ==========================================
  if (sections.conditions) {
    ensureSpace(16);
    drawSectionHeading("KNOWN CONDITIONS & DIAGNOSES", null, null, [37, 99, 235]);

    const conditions = data.conditions || [];
    if (conditions.length > 0) {
      conditions.forEach((cond) => {
        ensureSpace(11);
        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, 9.5, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text(cleanText(cond.condition), margin + 4, y + 4.2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const isActive = cond.status === "active";
        doc.setTextColor(isActive ? 22 : 100, isActive ? 101 : 116, isActive ? 52 : 139);
        doc.text((cond.status || "ACTIVE").toUpperCase(), pageWidth - margin - 4, y + 4.2, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...textMuted);
        const meta = [
          cond.diagnosedDate ? `Diagnosed: ${formatPdfDate(cond.diagnosedDate)}` : null,
          cond.source ? `Source: ${cleanText(cond.source)}` : null,
        ].filter(Boolean).join("  |  ");
        doc.text(meta || "Clinical diagnosis record", margin + 4, y + 7.8);

        y += 11.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No diagnosed conditions recorded in the available records.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 6. MEDICATIONS (IF ENABLED)
  // ==========================================
  if (sections.medications) {
    ensureSpace(16);
    drawSectionHeading("MEDICATIONS", null, "Recently recorded regimens");

    const meds = data.medications || [];
    if (meds.length > 0) {
      meds.forEach((m) => {
        ensureSpace(11);
        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, 9.5, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text(cleanText(m.medicine), margin + 4, y + 4.2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...tealDark);
        const dosageStr = [m.dosage, m.frequency, m.duration].filter(Boolean).join(" • ");
        doc.text(cleanText(dosageStr) || "As directed", pageWidth - margin - 4, y + 4.2, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        const mDate = m.prescribedDate ? formatPdfDate(m.prescribedDate) : "Recorded";
        doc.text(`Prescribed: ${mDate}  |  Source: ${cleanText(m.source || "Prescription record")}`, margin + 4, y + 7.8);

        y += 11.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No medications recorded for this period.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 7. PROCEDURES & SURGERIES (IF ENABLED)
  // ==========================================
  if (sections.procedures) {
    ensureSpace(16);
    drawSectionHeading("PROCEDURES & SURGERIES");

    const procs = data.procedures || [];
    if (procs.length > 0) {
      procs.forEach((p) => {
        ensureSpace(11);
        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, 9.5, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text(cleanText(p.procedure), margin + 4, y + 4.2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...textMuted);
        const pDate = p.performedDate ? formatPdfDate(p.performedDate) : "N/A";
        doc.text(`Date: ${pDate}  |  Provider: ${cleanText(p.provider || "Medical Facility")}`, margin + 4, y + 7.8);

        y += 11.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No procedures or surgeries recorded for this period.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 8. CONSULTATIONS (IF ENABLED)
  // ==========================================
  if (sections.consultations) {
    ensureSpace(20);
    drawSectionHeading("RECENT CONSULTATIONS");

    const consults = data.consultations || [];
    if (consults.length > 0) {
      // Table header
      ensureSpace(7);
      doc.setFillColor(...tealDark);
      doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("DATE", margin + 3, y + 4.2);
      doc.text("DOCTOR / SPECIALTY", margin + 28, y + 4.2);
      doc.text("CHIEF COMPLAINT / DIAGNOSIS", margin + 85, y + 4.2);
      doc.text("TREATMENT SUMMARY", margin + 140, y + 4.2);
      y += 7;

      consults.forEach((c, idx) => {
        const cDate = formatPdfDate(c.consultationDate);
        const docInfo = `${cleanText(c.doctorName || "Physician")}\n${cleanText(c.specialization || "General")}`;
        const complaint = `${cleanText(c.chiefComplaint || "General checkup")}\nDx: ${cleanText(c.diagnosis || "Evaluated")}`;
        let treatment = cleanText(c.treatment || c.clinicalNotes || "Consultation completed");
        if (treatment.length > 70) {
          treatment = `${treatment.slice(0, 65)}... (See source consultation record for complete notes)`;
        }

        const linesDoc = doc.splitTextToSize(docInfo, 54);
        const linesComp = doc.splitTextToSize(complaint, 52);
        const linesTreat = doc.splitTextToSize(treatment, 38);
        const maxLines = Math.max(linesDoc.length, linesComp.length, linesTreat.length, 2);
        const rowH = maxLines * 4 + 3;

        const pageBroken = ensureSpace(rowH + 1);
        if (pageBroken) {
          doc.setFillColor(...tealDark);
          doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(255, 255, 255);
          doc.text("DATE", margin + 3, y + 4.2);
          doc.text("DOCTOR / SPECIALTY", margin + 28, y + 4.2);
          doc.text("CHIEF COMPLAINT / DIAGNOSIS", margin + 85, y + 4.2);
          doc.text("TREATMENT SUMMARY (CONT.)", margin + 140, y + 4.2);
          y += 7;
        }

        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, rowH, "F");
        doc.setDrawColor(...cardBorder);
        doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...textDark);
        doc.text(cDate, margin + 3, y + 4);
        doc.text(linesDoc, margin + 28, y + 4);
        doc.text(linesComp, margin + 85, y + 4);
        doc.setTextColor(...textMuted);
        doc.text(linesTreat, margin + 140, y + 4);

        y += rowH;
      });
      y += 4;
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No consultations recorded for this period.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 9. INVESTIGATIONS & LAB RESULTS (IF ENABLED)
  // ==========================================
  if (sections.investigations) {
    ensureSpace(24);
    drawSectionHeading("INVESTIGATIONS & LAB RESULTS", null, "Verified clinical & OCR-extracted labs");

    const rawLabs = data.investigations || [];

    // Deduplicate identical repeated lab entries if exact same test, value, unit, and date were extracted from multiple OCR passes
    const uniqueLabs = [];
    const seenLabKeys = new Set();
    rawLabs.forEach((l) => {
      const tName = cleanText(l.test || l.testName || l.name || "").toLowerCase();
      const tVal = cleanText(l.value !== undefined && l.value !== null ? l.value : (l.resultValue !== undefined && l.resultValue !== null ? l.resultValue : (l.result || ""))).toLowerCase();
      const tUnit = cleanText(l.unit || "").toLowerCase();
      const tDate = l.date ? formatPdfDate(l.date) : "";
      const dedupeKey = `${tName}|${tVal}|${tUnit}|${tDate}`;
      if (!seenLabKeys.has(dedupeKey)) {
        seenLabKeys.add(dedupeKey);
        uniqueLabs.push(l);
      }
    });

    if (uniqueLabs.length > 0) {
      ensureSpace(7);
      doc.setFillColor(...tealDark);
      doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("TEST NAME", margin + 3, y + 4.2);
      doc.text("RESULT", margin + 68, y + 4.2);
      doc.text("REFERENCE RANGE", margin + 110, y + 4.2);
      doc.text("STATUS / FLAG", margin + 152, y + 4.2);
      y += 7;

      uniqueLabs.forEach((l, idx) => {
        const testName = cleanText(l.test || l.testName || l.name || "Laboratory Test");
        const val = cleanText(l.value !== undefined && l.value !== null ? l.value : (l.resultValue !== undefined && l.resultValue !== null ? l.resultValue : (l.result || "N/A")));
        const unit = cleanText(l.unit || "");
        const resultDisplay = unit && !val.toLowerCase().includes(unit.toLowerCase()) ? `${val} ${unit}` : val;
        const refRange = cleanText(l.referenceRange || l.reference_range || l.range || "Not specified");
        const rawFlag = String(l.flag || l.status || (l.abnormalFlag ? "abnormal" : "normal")).trim().toUpperCase();

        const metaParts = [];
        if (l.date) metaParts.push(formatPdfDate(l.date));
        if (l.source) metaParts.push(`Source: ${cleanText(l.source)}`);
        const metaStr = metaParts.join(" • ");

        const testLines = doc.splitTextToSize(testName, 62);
        const refLines = doc.splitTextToSize(refRange, 39);
        const hasMeta = Boolean(metaStr);

        const rowH = Math.max(testLines.length * 3.8 + (hasMeta ? 3.4 : 0) + 2.2, refLines.length * 3.8 + 2.2, 7.5);

        const pageBroken = ensureSpace(rowH + 1);
        if (pageBroken) {
          doc.setFillColor(...tealDark);
          doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(255, 255, 255);
          doc.text("TEST NAME (CONT.)", margin + 3, y + 4.2);
          doc.text("RESULT", margin + 68, y + 4.2);
          doc.text("REFERENCE RANGE", margin + 110, y + 4.2);
          doc.text("STATUS / FLAG", margin + 152, y + 4.2);
          y += 7;
        }

        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, rowH, "F");
        doc.setDrawColor(...cardBorder);
        doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

        // TEST NAME
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...textDark);
        doc.text(testLines, margin + 3, y + 3.8);

        // Date and provenance underneath test name
        if (hasMeta) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(...textMuted);
          const metaY = y + 3.8 + testLines.length * 3.5;
          const metaLines = doc.splitTextToSize(metaStr, 62);
          doc.text(metaLines, margin + 3, metaY);
        }

        // RESULT
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...textDark);
        doc.text(resultDisplay, margin + 68, y + 3.8);

        // REFERENCE RANGE
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.text(refLines, margin + 110, y + 3.8);

        // STATUS / FLAG
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const isAbnormal = rawFlag.includes("ABNORMAL") || rawFlag.includes("HIGH") || rawFlag.includes("LOW") || rawFlag.includes("CRITICAL") || rawFlag === "ALERT" || l.abnormalFlag === true;
        if (isAbnormal) {
          doc.setTextColor(...redAlert);
          doc.text(rawFlag || "ABNORMAL", margin + 152, y + 3.8);
        } else {
          doc.setTextColor(22, 101, 52); // green
          doc.text(rawFlag === "NORMAL" || !rawFlag ? "NORMAL" : rawFlag, margin + 152, y + 3.8);
        }

        y += rowH;
      });
      y += 4;
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No investigations or lab results recorded for this period.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 10. AYUSH HEALTH PROFILE (IF ENABLED & DATA EXISTS)
  // ==========================================
  if (sections.ayush && (data.ayush || data.ayushProfile)) {
    const ayush = data.ayush || data.ayushProfile;
    ensureSpace(24);
    drawSectionHeading("AYUSH HEALTH PROFILE", null, "Traditional Constitutional Assessment", [22, 101, 52]);

    const ayushItems = [
      { label: "Prakriti (Constitution)", val: ayush.prakriti },
      { label: "Vikriti (Current Imbalance)", val: ayush.vikriti },
      { label: "Agni (Digestive Fire)", val: ayush.agni },
      { label: "Koshtha (Bowel Type)", val: ayush.koshtha },
      { label: "Satmya (Adaptability)", val: ayush.satmya },
      { label: "Ahara & Vihara (Regimen)", val: ayush.aharaVihara },
    ].filter((i) => i.val);

    if (ayushItems.length > 0) {
      const rows = Math.ceil(ayushItems.length / 2);
      const boxH = 6 + rows * 8.5;
      ensureSpace(boxH);

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, y, contentWidth, boxH, 1.5, 1.5, "FD");

      let aY = y + 5.5;
      const aColW = (contentWidth - 8) / 2;

      ayushItems.forEach((item, idx) => {
        const col = idx % 2;
        if (col === 0 && idx > 0) aY += 8.5;
        const x = margin + 5 + col * aColW;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(22, 101, 52);
        doc.text(`${item.label.toUpperCase()}:`, x, aY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...textDark);
        doc.text(cleanText(item.val), x, aY + 3.8);
      });
      y += boxH + 4;
    }

    if (ayush.summary) {
      ensureSpace(14);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...textDark);
      const splitNarrative = doc.splitTextToSize(`Ayurvedic Narrative: ${cleanText(ayush.summary)}`, contentWidth - 8);
      doc.text(splitNarrative, margin + 4, y + 4);
      y += splitNarrative.length * 4 + 4;
    }
  }

  // ==========================================
  // 11. CONNECTED CARE PROVIDERS (IF ENABLED - DEFAULT OFF)
  // ==========================================
  if (sections.connectedProviders) {
    ensureSpace(16);
    drawSectionHeading("CONNECTED CARE PROVIDERS", null, "Authorized Clinicians");

    const providers = data.connectedDoctors || [];
    if (providers.length > 0) {
      providers.forEach((p) => {
        ensureSpace(10);
        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, 8.5, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        doc.text(cleanText(p.doctorName), margin + 4, y + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.text(`${cleanText(p.specialization || "General")}  |  Connected: ${formatPdfDate(p.connectedAt)}`, margin + 4, y + 7);

        y += 10.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No external care providers connected.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 13. SECURE PROVIDER PAIRING (IF EXPLICITLY ENABLED - DEFAULT OFF)
  // ==========================================
  if (sections.secureQr) {
    ensureSpace(18);
    drawSectionHeading("SECURE PROVIDER CONNECTION", null, "Temporary Pairing Credential", amberAlert);

    doc.setFillColor(...amberLight);
    doc.setDrawColor(...amberBorder);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...amberAlert);
    doc.text("Pairing Code: Active Handshake Code", margin + 4, y + 5);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text("Raw cryptographic credentials and live QR tokens are omitted from printed documents for patient security.", margin + 4, y + 9);

    y += 15;
  }

  // ==========================================
  // 14. MEDICAL TIMELINE (IF ENABLED - LAST CLINICAL SECTION)
  // ==========================================
  if (sections.timeline) {
    ensureSpace(20);
    drawSectionHeading("MEDICAL TIMELINE", null, "Chronological Sequence (Newest First)");

    const timeline = data.timeline || [];
    if (timeline.length > 0) {
      timeline.forEach((item) => {
        ensureSpace(12);
        doc.setFillColor(...cardBg);
        doc.setDrawColor(...cardBorder);
        doc.roundedRect(margin, y, contentWidth, 10.5, 1, 1, "FD");

        // Type pill tag
        doc.setFillColor(...tealPrimary);
        doc.roundedRect(margin + 3, y + 2, 22, 3.8, 0.8, 0.8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(cleanText(item.type).toUpperCase().slice(0, 12), margin + 4.5, y + 4.6);

        // Date
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...textMuted);
        doc.text(formatPdfDate(item.date), margin + 28, y + 4.6);

        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        doc.text(cleanText(item.title).slice(0, 50), margin + 55, y + 4.6);

        // Subtitle / details
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        const sub = [item.subtitle, item.details].filter(Boolean).join(" • ");
        doc.text(cleanText(sub).slice(0, 95), margin + 4, y + 8.8);

        y += 12.5;
      });
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No timeline events recorded for this period.", margin + 4, y + 4);
      y += 8;
    }
  }

  // ==========================================
  // 15. OFFICIAL MEDICAL DISCLAIMER
  // ==========================================
  ensureSpace(18);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text("OFFICIAL MEDICAL DISCLAIMER:", margin + 4, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const disclaimer =
    "Medical Passport is a patient-controlled summary generated from available MediKiosk records for the selected reporting period. It may not represent the complete medical record. Clinical decisions should be based on the appropriate underlying medical records and professional physician evaluation.";
  const splitDisc = doc.splitTextToSize(disclaimer, contentWidth - 8);
  doc.text(splitDisc, margin + 4, y + 8);

  y += 16;

  // ==========================================
  // 16. RUNNING HEADER & RUNNING FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header on Pages 2+
    if (i > 1) {
      doc.setDrawColor(...cardBorder);
      doc.line(margin, 8, pageWidth - margin, 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text("MediKiosk Medical Passport", margin, 6.5);
      doc.text(`Patient: ${cleanText(patientDisplayName)}`, pageWidth / 2, 6.5, { align: "center" });
      doc.text(`Period: ${cleanText(periodString)}`, pageWidth - margin, 6.5, { align: "right" });
    }

    // Running Footer on all pages
    doc.setDrawColor(...cardBorder);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Confidential Medical Information • Generated by MediKiosk • Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 6.5
    );
    doc.text(
      "Verified against canonical MediKiosk clinical records",
      pageWidth - margin,
      pageHeight - 6.5,
      { align: "right" }
    );
  }

  // ==========================================
  // 17. SANITIZE FILENAME & DOWNLOAD AUTOMATICALLY
  // ==========================================
  const sanitize = (name) =>
    String(name || "Patient")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const safeName = sanitize(patientDisplayName);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `MediKiosk_Medical_Passport_${safeName}_${dateStamp}.pdf`;

  doc.save(filename);
  return { filename, pageCount: totalPages, doc };
}
