import jsPDF from "jspdf";

/**
 * Clean and normalize any markdown or LLM artifacts from a text string
 */
function cleanMarkdownText(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'") // Normalize smart single quotes & backticks
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"') // Normalize smart double quotes & guillemets
    .replace(/[\u2013\u2014\u2015\u2212]/g, "-") // Normalize all dashes
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ") // Replace non-breaking and zero-width spaces
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks keeping content
    .replace(/`/g, "") // Remove lingering backticks
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown keeping content
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown keeping content
    .replace(/__([^_]+)__/g, "$1") // Remove bold underscore keeping content
    .replace(/_([^_]+)_/g, "$1") // Remove italic underscore keeping content
    .replace(/~~([^~]+)~~/g, "$1") // Remove strikethrough keeping content
    .replace(/^[#]+\s*/, "") // Remove leading hashes
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "") // Remove emojis
    .replace(/🩺|📋|🚨|💬|💊|🧪|⚠️|🔍/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ") // Strip any non-standard unicode that breaks Helvetica kerning
    .replace(/\s+/g, " ") // Normalize multiple spaces and tabs to a single space
    .trim();
}

/**
 * Parses markdown into structured blocks (headers, list items, full paragraphs)
 * preventing mid-sentence line breaks or fragmented markdown lines.
 */
function parseMarkdownBlocks(rawText) {
  if (!rawText) return [];
  const lines = String(rawText).split(/\r?\n/);
  const blocks = [];
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(" ").trim();
      if (text) {
        blocks.push({ type: "paragraph", content: text });
      }
      currentParagraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i++;
      continue;
    }

    // Check if line looks like a table row: starts & ends with | (or contains multiple |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")) {
      flushParagraph();
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // Process tableLines into headers and rows
      const parsedRows = tableLines
        .map((rowStr) =>
          rowStr
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        )
        .filter((rowArr) => rowArr.length > 0);

      // Filter out markdown table header separator rows like ['---', '---'] or [':---', ':---']
      const dataRows = parsedRows.filter(
        (rowArr) => !rowArr.every((cell) => /^[:\s-]*$/.test(cell))
      );

      if (dataRows.length > 0) {
        const headers = dataRows[0];
        const rows = dataRows.slice(1);
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,4})\s*(.*)/);
    if (headerMatch) {
      flushParagraph();
      blocks.push({ type: "header", level: headerMatch[1].length, content: headerMatch[2].trim() });
      i++;
      continue;
    }

    const isBullet = trimmed.match(/^[-*•]\s+(.*)/);
    const isNumbered = trimmed.match(/^(\d+[\.\)])\s+(.*)/);
    if (isBullet || isNumbered) {
      flushParagraph();
      const prefix = isNumbered ? isNumbered[1] : "*";
      const body = isNumbered ? isNumbered[2] : isBullet[1];
      blocks.push({ type: "list_item", prefix, content: body.trim() });
      i++;
      continue;
    }

    currentParagraph.push(trimmed);
    i++;
  }
  flushParagraph();
  return blocks;
}

/**
 * Generates and downloads a beautifully formatted, official MediKiosk Clinical AI Assessment PDF Report
 */
export async function downloadSummaryPDF({
  title = "Clinical AI Intake Assessment Report",
  patientName = "Patient",
  chiefComplaint = "",
  date = new Date().toLocaleDateString(),
  answeredFields = {},
  redFlags = [],
  summaryText = "",
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (typeof doc.setCharSpace === "function") {
    doc.setCharSpace(0);
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 20;

  const tealDark = [13, 110, 100]; // Primary teal #0d6e64
  const tealPrimary = [13, 148, 136]; // Teal #0d9488
  const tealLight = [240, 253, 250]; // Light teal #f0fdfa
  const tealBorder = [153, 246, 228]; // Border #99f6e4
  const textDark = [30, 41, 59]; // Slate #1e293b
  const textMuted = [100, 116, 139]; // Slate muted #64748b
  const redAlert = [220, 38, 38]; // Red #dc2626
  const redLight = [254, 242, 242]; // Red background #fef2f2
  const redBorder = [254, 202, 202]; // Red border #fecaca

  let y = 0;

  const ensureSpace = (neededHeight) => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 5;
      return true;
    }
    return false;
  };

  // ==========================================
  // 1. TOP HEADER BANNER
  // ==========================================
  doc.setFillColor(...tealDark);
  doc.rect(0, 0, pageWidth, 26, "F");

  // Top accent stripe
  doc.setFillColor(45, 212, 191);
  doc.rect(0, 0, pageWidth, 2.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("MediKiosk Clinical Intelligence", margin, 13);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("AI PRE-CONSULTATION INTAKE & TRIAGE DOSSIER", margin, 19);

  const formattedDate = date ? String(date) : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  doc.text(`Generated: ${formattedDate}`, pageWidth - margin, 13, { align: "right" });
  doc.text("Confidential Medical Record", pageWidth - margin, 19, { align: "right" });

  y = 32;

  // ==========================================
  // 2. PATIENT DEMOGRAPHICS & INTAKE OVERVIEW
  // ==========================================
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2.5, 2.5, "FD");

  // Left accent bar
  doc.setFillColor(...tealPrimary);
  doc.roundedRect(margin, y, 3, 22, 1, 1, "F");

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Patient: ${patientName || "Patient"}`, margin + 6, y + 7.5);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Chief Complaint:`, margin + 6, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...tealDark);
  doc.text(` ${chiefComplaint || "General Health Assessment"}`, margin + 35, y + 15.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text("Verification: AI Structured Intake", pageWidth - margin - 5, y + 7.5, { align: "right" });
  doc.text("Target: Attending Physician Review", pageWidth - margin - 5, y + 15.5, { align: "right" });

  y += 27;

  // ==========================================
  // 3. PHYSICIAN NOTICE BRIEFING BOX
  // ==========================================
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 15, 2, 2, "FD");

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PHYSICIAN CLINICAL NOTICE:", margin + 4, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const noticeStr = "This provisional clinical summary is generated using patient-reported data and RAG medical knowledge. Verify all reported symptoms, red flags, and diagnostic differentials during clinical consultation.";
  const splitNotice = doc.splitTextToSize(noticeStr, contentWidth - 8);
  doc.text(splitNotice, margin + 4, y + 9.5);

  y += 19;

  // ==========================================
  // 4. RED FLAGS & TRIAGE SECTION (IF ANY)
  // ==========================================
  if (redFlags && Array.isArray(redFlags) && redFlags.length > 0) {
    ensureSpace(16 + redFlags.length * 5.5);
    doc.setFillColor(...redLight);
    doc.setDrawColor(...redBorder);
    const boxHeight = 10 + redFlags.length * 5.5;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");

    // Red left bar
    doc.setFillColor(...redAlert);
    doc.roundedRect(margin, y, 3, boxHeight, 1, 1, "F");

    doc.setTextColor(...redAlert);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("PRIORITY TRIAGE / IDENTIFIED RED FLAGS", margin + 6, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(153, 27, 27);
    redFlags.forEach((flag, idx) => {
      const cleanFlag = cleanMarkdownText(flag);
      doc.text(`* ${cleanFlag}`, margin + 8, y + 12 + idx * 5.5);
    });

    y += boxHeight + 5;
  }

  // ==========================================
  // 5. STRUCTURED PARAMETERS (ANSWERED FIELDS)
  // ==========================================
  if (answeredFields && typeof answeredFields === "object" && Object.keys(answeredFields).length > 0) {
    const entries = Object.entries(answeredFields).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== "");
    if (entries.length > 0) {
      ensureSpace(16 + entries.length * 6);

      doc.setFillColor(...tealLight);
      doc.setDrawColor(...tealBorder);
      doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "FD");

      doc.setTextColor(...tealDark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Structured Patient Parameters & Intake History", margin + 5, y + 5.5);
      y += 11;

      entries.forEach(([k, v]) => {
        ensureSpace(6.5);
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(235, 240, 245);
        doc.roundedRect(margin + 2, y - 4, contentWidth - 4, 6, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text(`${label}:`, margin + 6, y);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        const valStr = cleanMarkdownText(v);
        const splitVal = doc.splitTextToSize(valStr, contentWidth - 65);
        doc.text(splitVal[0] || "", margin + 60, y);

        y += 6.5;
      });

      y += 4;
    }
  }

  // ==========================================
  // 6. DETAILED CLINICAL SUMMARY & SECTIONS
  // ==========================================
  let rawText = "";
  let extractedMeds = [];
  let extractedLabs = [];

  if (typeof summaryText === "object" && summaryText !== null) {
    rawText = summaryText.summary || "";
    extractedMeds = summaryText.medications || [];
    extractedLabs = summaryText.lab_results || [];
  } else {
    rawText = String(summaryText || "");
  }

  // Render Prescriptions if provided
  if (extractedMeds && extractedMeds.length > 0) {
    ensureSpace(15 + extractedMeds.length * 6);
    doc.setFillColor(...tealDark);
    doc.rect(margin, y, contentWidth, 6.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PRESCRIBED MEDICATIONS & REGIMEN", margin + 4, y + 4.5);
    y += 9;

    extractedMeds.forEach((m) => {
      ensureSpace(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...textDark);
      doc.text(`- ${m.medicine || m.name}:`, margin + 6, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMuted);
      const details = `${m.dose || ""} ${m.frequency ? `(${m.frequency})` : ""} ${m.duration || ""}`.trim();
      doc.text(details, margin + 45, y);
      y += 5.5;
    });
    y += 4;
  }

  // Render Lab Results if provided
  if (extractedLabs && extractedLabs.length > 0) {
    ensureSpace(15 + extractedLabs.length * 6);
    doc.setFillColor(...tealDark);
    doc.rect(margin, y, contentWidth, 6.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("LABORATORY & INVESTIGATION FINDINGS", margin + 4, y + 4.5);
    y += 9;

    extractedLabs.forEach((l) => {
      ensureSpace(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...textDark);
      doc.text(`- ${l.test}:`, margin + 6, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textDark);
      doc.text(`${l.value} ${l.unit || ""} ${l.reference_range ? `(Ref: ${l.reference_range})` : ""}`, margin + 50, y);
      y += 5.5;
    });
    y += 4;
  }

  // Parse Markdown Summary Text into Structured Blocks
  if (rawText && rawText.trim()) {
    const blocks = parseMarkdownBlocks(rawText);

    for (const block of blocks) {
      if (block.type === "header") {
        const headingText = cleanMarkdownText(block.content);
        ensureSpace(14);

        if (headingText.toLowerCase().includes("patient summary")) {
          doc.setFillColor(240, 253, 244); // light green
          doc.setDrawColor(187, 247, 208);
          doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, "FD");
          doc.setTextColor(22, 101, 52);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.text("Patient-Friendly Summary (Plain Language)", margin + 4, y + 4.8);
        } else {
          // Normal section header
          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, "FD");

          // Teal accent pill
          doc.setFillColor(...tealPrimary);
          doc.rect(margin, y, 2.5, 7, "F");

          doc.setTextColor(...tealDark);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.text(headingText, margin + 5, y + 4.8);
        }

        y += 10.5;
      } else if (block.type === "list_item") {
        const cleanBody = cleanMarkdownText(block.content);
        const prefix = block.prefix || "*";
        const fullLine = `${prefix}  ${cleanBody}`;
        const splitBullet = doc.splitTextToSize(fullLine, contentWidth - 12);

        splitBullet.forEach((bLine, bIdx) => {
          ensureSpace(5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...textDark);
          doc.text(bLine, margin + (bIdx === 0 ? 4 : 8), y);
          y += 4.5;
        });
        y += 1;
      } else if (block.type === "table" && block.headers && block.headers.length > 0) {
        const colCount = block.headers.length;
        const tableWidth = contentWidth - 4;
        const startX = margin + 2;

        let colWidths = [];
        if (colCount === 2) {
          colWidths = [45, tableWidth - 45];
        } else {
          const equalW = tableWidth / colCount;
          colWidths = Array(colCount).fill(equalW);
        }

        ensureSpace(14 + (block.rows.length + 1) * 7);

        // Header row box
        const headerHeight = 7;
        doc.setFillColor(...tealDark);
        doc.roundedRect(startX, y, tableWidth, headerHeight, 1, 1, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);

        let currentX = startX;
        block.headers.forEach((hText, hIdx) => {
          const w = colWidths[hIdx] || 30;
          const cleanH = cleanMarkdownText(hText);
          doc.text(cleanH, currentX + 3, y + 4.8);
          currentX += w;
        });

        y += headerHeight;

        // Data rows
        block.rows.forEach((rowCells, rIdx) => {
          let maxLinesInRow = 1;
          rowCells.forEach((cText, cIdx) => {
            const w = colWidths[cIdx] || 30;
            const cleanC = cleanMarkdownText(cText);
            const lines = doc.splitTextToSize(cleanC, w - 5);
            if (lines.length > maxLinesInRow) {
              maxLinesInRow = lines.length;
            }
          });

          const rowHeight = Math.max(6.5, maxLinesInRow * 4 + 2.5);
          ensureSpace(rowHeight + 2);

          if (rIdx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
          } else {
            doc.setFillColor(255, 255, 255);
          }
          doc.rect(startX, y, tableWidth, rowHeight, "F");

          doc.setDrawColor(226, 232, 240);
          doc.line(startX, y + rowHeight, startX + tableWidth, y + rowHeight);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...textDark);

          let cellX = startX;
          rowCells.forEach((cText, cIdx) => {
            const w = colWidths[cIdx] || 30;
            const cleanC = cleanMarkdownText(cText);
            const splitCell = doc.splitTextToSize(cleanC, w - 5);
            splitCell.forEach((cLine, lIdx) => {
              doc.text(cLine, cellX + 3, y + 4 + lIdx * 4);
            });
            cellX += w;
          });

          y += rowHeight;
        });

        y += 3.5;
      } else if (block.type === "paragraph") {
        const cleanParagraph = cleanMarkdownText(block.content);
        const isAutoGenerated = cleanParagraph.toLowerCase().startsWith("auto-generated");

        const splitText = doc.splitTextToSize(cleanParagraph, contentWidth - 12);
        splitText.forEach((pLine) => {
          ensureSpace(5);
          doc.setFont("helvetica", isAutoGenerated ? "italic" : "normal");
          doc.setFontSize(isAutoGenerated ? 7.5 : 8.5);
          doc.setTextColor(...(isAutoGenerated ? textMuted : textDark));
          doc.text(pLine, margin + 4, y);
          y += 4.5;
        });
        y += 2;
      }
    }
  }

  // ==========================================
  // 7. RUNNING FOOTER ON ALL PAGES
  // ==========================================
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Bottom rule
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MediKiosk AI Clinical Assessment • Confidential Medical Record • Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 7
    );
    doc.text(
      "Validated by RAG Clinical Knowledge Engine",
      pageWidth - margin,
      pageHeight - 7,
      { align: "right" }
    );
  }

  const cleanStr = (str, fallback) => {
    if (!str) return fallback;
    return String(str)
      .replace(/&/g, "and")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const safePatient = cleanStr(patientName, "Patient");
  const safeComplaint = cleanStr(chiefComplaint, "Assessment");
  const dateStamp = new Date().toISOString().slice(0, 10);

  const safeFilename = `MediKiosk_Assessment_${safePatient}_${safeComplaint}_${dateStamp}.pdf`;
  doc.save(safeFilename);
}


