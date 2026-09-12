import logging
from .state import ClinicalSession

try:
    from groq import Groq
except ImportError:
    Groq = None

from config import GROQ_API_KEY, GROQ_TEXT_MODEL

logger = logging.getLogger("medikiosk.clinical.summarizer")

groq_client = None
if GROQ_API_KEY and Groq is not None:
    groq_client = Groq(api_key=GROQ_API_KEY)

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "gu": "Gujarati",
    "bn": "Bengali", "ta": "Tamil", "te": "Telugu", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese"
}

# ─── OLDCARTS field mapping ───────────────────────────────────────────
# Maps ontology field names to their OLDCARTS / SOCRATES category for
# structured HPI narrative generation.
OLDCARTS_MAP = {
    "onset":                "Onset",
    "location":             "Location",
    "duration":             "Duration",
    "character":            "Character / Quality",
    "aggravating_factors":  "Aggravating Factors",
    "relieving_factors":    "Relieving Factors",
    "radiation":            "Radiation",
    "severity":             "Severity",
    "associated_symptoms":  "Associated Symptoms / Timing",
}

GI_FIELDS = {"last_meal": "Last Meal", "bowel_movements": "Bowel Movements / GI Status"}
DASHAVIDHA_FIELDS = {
    "prakriti": "Prakriti (Constitution)",
    "vikriti": "Vikriti (Imbalance)",
    "sara": "Sara (Tissue Quality)",
    "samhanana": "Samhanana (Body Build)",
    "pramana": "Pramana (Body Proportions)",
    "satmya": "Satmya (Adaptability)",
    "sattva": "Sattva (Mental Strength)",
    "ahara_shakti": "Ahara Shakti (Digestive Power)",
    "vyayama_shakti": "Vyayama Shakti (Exercise Capacity)",
    "vaya": "Vaya (Age Factor)",
}

ADDITIONAL_AYURVEDIC_FIELDS = {
    "agni": "Agni (Digestive Fire)",
    "koshtha": "Koshtha (Bowel Nature)",
    "ahara_vihara": "Ahara-Vihara (Diet & Lifestyle)",
    "nidana": "Nidana (Causative Factors)",
    "samprapti": "Samprapti (Pathogenesis)",
    "dushya": "Dushya (Affected Tissues/Doshas)",
    "desha": "Desha (Habitat/Region)",
    "bala": "Bala (Strength)",
    "kala": "Kala (Time/Season)",
}


def _build_structured_hpi(session: ClinicalSession) -> str:
    """Builds a structured HPI section from answered_fields using OLDCARTS mapping."""
    lines = []
    for field_key, label in OLDCARTS_MAP.items():
        val = session.answered_fields.get(field_key)
        if val:
            lines.append(f"- **{label}**: {val}")
    return "\n".join(lines) if lines else "- No HPI parameters captured."


def _build_gi_section(session: ClinicalSession) -> str:
    lines = []
    for field_key, label in GI_FIELDS.items():
        val = session.answered_fields.get(field_key)
        if val:
            lines.append(f"- **{label}**: {val}")
    return "\n".join(lines) if lines else ""


def _build_dashavidha_section(session: ClinicalSession) -> str:
    lines = []
    for field_key, label in DASHAVIDHA_FIELDS.items():
        val = session.answered_fields.get(field_key)
        if val:
            lines.append(f"- **{label}**: {val}")
    return "\n".join(lines) if lines else ""


def _build_additional_ayurvedic_section(session: ClinicalSession) -> str:
    lines = []
    for field_key, label in ADDITIONAL_AYURVEDIC_FIELDS.items():
        val = session.answered_fields.get(field_key)
        if val:
            lines.append(f"- **{label}**: {val}")
    return "\n".join(lines) if lines else ""


def generate_summary(session: ClinicalSession, document_data: dict = None) -> str:
    """
    Generates a structured, physician-ready Markdown summary of the clinical session.
    Uses the OLDCARTS framework for HPI and standard medical documentation sections
    (CC, HPI, ROS, PMH, Medications, Red Flags, Clinical Impression).
    """
    lang_name = LANGUAGE_NAMES.get(session.language.lower(), "English")

    # Build structured answered fields for the prompt
    hpi_block = _build_structured_hpi(session)
    gi_block = _build_gi_section(session)
    dashavidha_block = _build_dashavidha_section(session)
    additional_ayurvedic_block = _build_additional_ayurvedic_section(session)

    # Conversation transcript for the LLM to synthesize from
    convo_text = ""
    if session.conversation_history:
        convo_lines = []
        for msg in session.conversation_history:
            role = "Doctor (AI)" if msg["role"] == "system" else "Patient"
            convo_lines.append(f"  {role}: {msg['content']}")
        convo_text = "\n".join(convo_lines)

    # Inject Patient Profile
    profile_text = ""
    age_gender_str = "the patient"
    if session.patient_profile:
        prof = session.patient_profile
        profile_parts = []
        if prof.get("age") is not None:
            profile_parts.append(f"Age: {prof.get('age')}")
            age_gender_str = f"A {prof.get('age')}-year-old"
        if prof.get("gender"):
            profile_parts.append(f"Gender: {prof.get('gender')}")
            age_gender_str += f" {prof.get('gender').lower()}" if "year-old" in age_gender_str else f"A {prof.get('gender').lower()} patient"
        if prof.get("medical_history"):
            hist_str = ", ".join([f"{h.get('condition')} ({h.get('status')})" for h in prof.get("medical_history")])
            profile_parts.append(f"Medical History: {hist_str}")
        
        if profile_parts:
            profile_text = "\n=== PATIENT DEMOGRAPHICS & HISTORY ===\n" + "\n".join(profile_parts) + "\n"

    if groq_client:
        prompt = f"""You are a senior physician documentation specialist generating a clinical handoff report.
Your audience is an EXPERIENCED ATTENDING DOCTOR who will see this patient next.
The report must save them time — they should be able to scan it in 30 seconds and understand the patient's full presentation.

=== SESSION DATA ===
Patient ID: {session.patient_id}
Consultation Type: {session.consultation_type.title()}
Chief Complaint: {session.chief_complaint}
Session Language: {lang_name} ({session.language})
{profile_text}

=== STRUCTURED CLINICAL PARAMETERS (OLDCARTS) ===
{hpi_block}
{f"GI-Specific: {gi_block}" if gi_block else ""}
{f"AYUSH / DASHAVIDHA PARIKSHA:\n{dashavidha_block}" if dashavidha_block else ""}
{f"ADDITIONAL AYURVEDIC HISTORY:\n{additional_ayurvedic_block}" if additional_ayurvedic_block else ""}

=== RED FLAGS IDENTIFIED ===
{', '.join(session.red_flags) if session.red_flags else 'None identified'}

=== FULL CONVERSATION TRANSCRIPT ===
{convo_text if convo_text else 'No conversation recorded.'}

=== ATTACHED DOCUMENTS / OCR DATA ===
{document_data if document_data else 'None'}

=== OUTPUT FORMAT (STRICTLY FOLLOW THIS STRUCTURE) ===
Generate a Markdown report with EXACTLY these sections:

## Executive Summary
A short 2-3 sentence high-level summary of the patient's presentation and key findings for the doctor to quickly glance at.

## Chief Complaint (CC)
One-liner summarizing the primary complaint.

## History of Presenting Illness (HPI)
A narrative paragraph synthesizing the patient's story using the OLDCARTS framework:
Onset, Location, Duration, Character, Aggravating/Relieving Factors, Radiation, Timing, Severity.
Write this as a flowing clinical narrative, NOT a bullet list. Use the patient's actual words where informative.

## Review of Systems (ROS)
List associated symptoms organized by body system (Cardiovascular, Respiratory, GI, Neuro, MSK, etc.).
Only include systems that have relevant findings from the patient's responses.

## Past Medical History & Medications
Include ONLY if document data or patient responses mention prior conditions, surgeries, medications, or allergies.
If nothing is available, write "Not available from this intake."

{"## AYUSH / DASHAVIDHA PARIKSHA" + chr(10) + "Summarize the Ayurvedic constitutional assessment findings." if dashavidha_block else ""}
{"## ADDITIONAL AYURVEDIC HISTORY" + chr(10) + "Summarize the additional Ayurvedic history." if additional_ayurvedic_block else ""}

## 🚨 Red Flags & Triage Priority
List any identified red flags and recommend triage priority level (Immediate / Urgent / Routine).
If no red flags, state "No red flags identified. Routine priority."

## Clinical Impression & Recommended Next Steps
- Provide 2-3 possible differential considerations based on the presentation (NOT a diagnosis).
- Suggest specific examination maneuvers, investigations, or labs the attending should consider.

## Patient Summary ({lang_name})
2-3 sentence patient-friendly summary in {lang_name} that the patient can understand.

CRITICAL RULES:
- Do NOT use generic boilerplate. Every sentence must reference THIS patient's specific data.
- If age and gender are provided in PATIENT DEMOGRAPHICS, use them naturally in the Executive Summary (e.g., "{age_gender_str} presents with..."). If they are not provided, use gender-neutral language (they/them/the patient) and omit age entirely. Do NOT hallucinate.
- Do NOT diagnose. Only suggest differentials and next steps.
- Keep the report scannable with clear section headers.
- Write the HPI as a narrative paragraph, not bullets.
"""
        try:
            res = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=GROQ_TEXT_MODEL,
            )
            summary_out = res.choices[0].message.content.strip()
            if summary_out:
                return summary_out
        except Exception as e:
            logger.error(f"Failed to generate LLM summary: {e}")

    # ─── Fallback: structured template without LLM ───────────────────
    summary = f"# Clinical Intake Summary\n\n"
    summary += f"**Patient ID**: {session.patient_id}\n"
    summary += f"**Consultation Type**: {session.consultation_type.title()}\n"
    summary += f"**Chief Complaint**: {session.chief_complaint}\n"
    summary += f"**Language**: {lang_name}\n\n"
    
    # Executive Summary
    summary += "## Executive Summary\n"
    summary += f"Patient presenting with {session.chief_complaint}.\n\n"

    # Red Flags
    if session.red_flags:
        summary += "## 🚨 Red Flags & Triage Priority\n"
        for flag in session.red_flags:
            summary += f"- ⚠️ {flag}\n"
        summary += "**Triage Priority**: Urgent\n\n"
    else:
        summary += "## 🚨 Red Flags & Triage Priority\n"
        summary += "No red flags identified. **Triage Priority**: Routine\n\n"

    # HPI (OLDCARTS)
    summary += "## History of Presenting Illness (HPI — OLDCARTS)\n"
    summary += hpi_block + "\n\n"

    # GI
    if gi_block:
        summary += "## GI Assessment\n"
        summary += gi_block + "\n\n"

    # AYUSH
    if dashavidha_block:
        summary += "## AYUSH / DASHAVIDHA PARIKSHA\n"
        summary += dashavidha_block + "\n\n"
    if additional_ayurvedic_block:
        summary += "## ADDITIONAL AYURVEDIC HISTORY\n"
        summary += additional_ayurvedic_block + "\n\n"

    # Documents
    if document_data:
        summary += "## Past Medical History & Medications (from Documents)\n"
        meds = document_data.get("medications", [])
        if meds:
            summary += "### Medications\n"
            for med in meds:
                med_name = med.get("medicine", "Unknown")
                dose = med.get("dose", "")
                freq = med.get("frequency", "")
                summary += f"- {med_name} {dose} {freq}\n"

        labs = document_data.get("lab_results", [])
        if labs:
            summary += "### Lab Results\n"
            for lab in labs:
                test = lab.get("test", "Unknown")
                val = lab.get("value", "")
                unit = lab.get("unit", "")
                flag = lab.get("flag", "")
                summary += f"- {test}: {val} {unit} ({flag})\n"
        summary += "\n"
    else:
        summary += "## Past Medical History & Medications\n"
        summary += "Not available from this intake.\n\n"

    # All answered fields as a reference table
    if session.answered_fields:
        summary += "## All Captured Parameters\n"
        summary += "| Parameter | Value |\n|---|---|\n"
        for field, value in session.answered_fields.items():
            display_field = field.replace('_', ' ').title()
            summary += f"| {display_field} | {value} |\n"
        summary += "\n"

    summary += "---\n*Generated by MediKiosk AI Clinical Intake System*"
    return summary
