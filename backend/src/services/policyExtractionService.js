const pool = require("../config/db");

const amountNear = (text, label) => {
    const match = text.match(new RegExp(`${label}[^\\d]{0,50}([\\d,]+(?:\\.\\d+)?)\\s*(crore|cr\\b|lakh|lac)?`, "i"));
    if (!match) return null;
    let value = Number(match[1].replace(/,/g, ""));
    if (/crore|cr/i.test(match[2] || "")) value *= 10000000;
    if (/lakh|lac/i.test(match[2] || "")) value *= 100000;
    return value;
};
const percentNear = (text, label) => Number(text.match(new RegExp(`${label}[^\\d]{0,35}(\\d+(?:\\.\\d+)?)\\s*%`, "i"))?.[1] ?? NaN);

const FIELD_BOUNDARY = "insurer(?:\\s+name)?|insurance\\s+company(?:\\s+name)?|plan(?:\\s+name)?|product(?:\\s+name)?|policy\\s+(?:number|no\\.?|type|start\\s+date|end\\s+date)|policyholder|member\\s+(?:id|number)|annual\\s+sum\\s+insured|sum\\s+insured|remaining\\s+sum\\s+insured|deductible|co[\\s-]?pay|room\\s*rent|icu\\s+rent|network\\s+hospital|waiting\\s+period";

function fieldValue(text, label) {
    const match = text.match(new RegExp(`(?:^|\\s)(?:${label})\\s*[:#\\-]?\\s*(.+?)(?=\\s+(?:${FIELD_BOUNDARY})\\b|$)`, "i"));
    return match?.[1]?.replace(/\s+/g, " ").replace(/[|;,]+$/, "").trim() || "";
}

function isoDate(value) {
    const match = String(value).match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const named = String(value).match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (named) {
        const months = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
        const month = months[named[2].toLowerCase()];
        if (month) return `${named[3]}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function dateAfter(text, label) {
    const value = text.match(new RegExp(`(?:${label})\\s*[:\\-]?\\s*((?:\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4})|(?:\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}))`, "i"))?.[1];
    return value ? isoDate(value) : null;
}

function procedureLimits(text) {
    const names = ["Knee Replacement", "Cataract Surgery", "Hernia Surgery", "Dialysis", "Day-care Chemotherapy"];
    return names.flatMap(name => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = text.match(new RegExp(`${escaped}[^\\d]{0,20}(?:INR|Rs\\.?|₹)?\\s*([\\d,]+)(?:\\s+per\\s+(knee|eye|session))?`, "i"));
        if (!match) return [];
        const waiting = text.match(new RegExp(`${escaped}.{0,80}?(\\d+)\\s*(day|days|month|months)`, "i"));
        const waitingDays = waiting ? Number(waiting[1]) * (/month/i.test(waiting[2]) ? 30 : 1) : 0;
        return [{ procedure_name: name, procedure_code: null, max_eligible_amount: Number(match[1].replace(/,/g, "")), waiting_period_days: waitingDays, notes: match[2] ? `Limit applies per ${match[2].toLowerCase()}.` : null }];
    });
}

function insurerFromTitle(raw) {
    const lines = String(raw).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const standalone = lines.slice(0, 12).find(line => /^[A-Z][A-Za-z0-9&.,'\- ]{1,70}\sHealth\sInsurance$/i.test(line));
    if (standalone) return standalone.replace(/\s+/g, " ").trim();
    const flattened = String(raw).replace(/\s+/g, " ").trim();
    return flattened.match(/^([A-Z][A-Za-z0-9&.,'\- ]{1,70}\sHealth\sInsurance)(?=\s+(?:FICTIONAL|SAMPLE|POLICY\s+SCHEDULE))/i)?.[1]?.trim() || "";
}

function parsePolicyText(raw = "") {
    const text = String(raw).replace(/\s+/g, " ");
    const copay = percentNear(text, "co[\\s-]?pay(?:ment)?");
    const insurerName = fieldValue(text, "insurer\\s+name|insurance\\s+company(?:\\s+name)?") || insurerFromTitle(raw);
    const planName = fieldValue(text, "plan\\s+name|product\\s+name");
    const policyType = fieldValue(text, "policy\\s+type");
    const memberId = fieldValue(text, "member\\s+(?:id|number)");
    const startDate = dateAfter(text, "policy\\s+start\\s+date|start\\s+date");
    const endDate = dateAfter(text, "policy\\s+end\\s+date|end\\s+date|expiry\\s+date");
    return {
        insurer_name: insurerName,
        policy_number: text.match(/policy\s*(?:no\.?|number)\s*[:#\-]?\s*([A-Z0-9\-/]+)/i)?.[1] || "",
        member_id: memberId,
        plan_name: planName,
        policy_type: policyType,
        policy_start_date: startDate,
        policy_end_date: endDate,
        sum_insured: amountNear(text, "(?:annual\\s+|base\\s+|total\\s+)?sum\\s+insured"),
        remaining_sum_insured: amountNear(text, "(?:remaining|available|balance)(?:\\s+sum\\s+insured|\\s+coverage)?"),
        deductible: /deductible[^.;]{0,25}(?:nil|none|not applicable|n\/?a)/i.test(text) ? 0 : amountNear(text, "deductible"),
        copay_percent: /co[\s-]?pay[^.;]{0,25}(?:nil|none|not applicable|n\/?a)/i.test(text) ? 0 : (Number.isFinite(copay) ? copay : null),
        room_rent_limit_per_day: amountNear(text, "room\\s*rent(?:\\s+(?:limit|cap|capping))?"),
        icu_limit_per_day: amountNear(text, "(?:icu|intensive care)(?:\\s+rent)?(?:\\s+(?:limit|cap|capping))?"),
        network_required: /network\s+hospital\s+required(?:\s+for\s+cashless)?\s*[:\-]?\s*(?:yes|true|required)/i.test(text),
        waiting_period_general_days: Number(text.match(/initial\s+waiting\s+period\s*[:\-]?\s*(\d+)\s*days?/i)?.[1] || 0) || null,
        procedure_limits: procedureLimits(text), exclusions: [], waiting_periods: {}, text_available: Boolean(text),
    };
}

async function extractPolicyDataFromDocument(documentId, patientId) {
    const result = await pool.query(`SELECT d.id, o.extracted_text, o.extracted_entities, o.status FROM documents d LEFT JOIN document_ocr o ON o.document_id=d.id WHERE d.id=$1 AND d.patient_id=$2 AND d.document_type='insurance'`, [documentId, patientId]);
    if (!result.rows.length) throw Object.assign(new Error("Insurance document not found."), { statusCode: 404 });
    const deterministic = parsePolicyText(result.rows[0].extracted_text);
    let intelligent = result.rows[0].extracted_entities || {};
    if (typeof intelligent === "string") { try { intelligent = JSON.parse(intelligent); } catch { intelligent = {}; } }
    const allowed = ["insurer_name", "policy_number", "member_id", "plan_name", "policy_type", "policy_start_date", "policy_end_date", "sum_insured", "remaining_sum_insured", "deductible", "copay_percent", "room_rent_limit_per_day", "icu_limit_per_day", "network_required", "waiting_period_general_days", "procedure_limits", "exclusions"];
    const reviewedExtraction = { ...deterministic };
    for (const key of allowed) {
        const value = intelligent?.[key];
        if (value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length)) reviewedExtraction[key] = value;
    }
    return { ...reviewedExtraction, extraction_method: Object.keys(intelligent || {}).length ? "llm_structured_with_rule_fallback" : "rule_based_fallback", document_id: documentId, ocr_status: result.rows[0].status || "pending" };
}

module.exports = { extractPolicyDataFromDocument, parsePolicyText };
