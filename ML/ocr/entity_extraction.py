import json
import re
import requests
from typing import Dict, Any, Optional, List
from config import GROQ_TEXT_MODEL
from schemas import ExtractedDocument, Medication, MedicationTiming

EXTRACTION_PROMPT = """You are an expert clinical medical structuring AI.

You will be provided raw OCR text extracted from a medical document (prescription, lab report, discharge summary, or certificate).

Your objective is to extract EVERY SINGLE medical entity present in the text into structured JSON.

Respond with ONLY a single valid JSON object. Do not wrap in markdown ```json or include conversational text.

Schema:
{{
  "document_type": "prescription | lab_report | discharge_summary | certificate",
  "document_date": "YYYY-MM-DD or string date or null",
  "diagnoses": ["string", "..."],
  "medications": [
    {{
      "medicine": "Clean medication name (e.g. Tab. Paracetamol, Cap. Azithromycin, Syp. Ambrodil)",
      "dose": "Dosage strength e.g. 500 mg, 5 mg, 15 ml, 1 tablet, 2 teaspoonful, or null",
      "frequency": "Layman-friendly instructions interpreting any dosage pattern (e.g. '1 morning dose, no afternoon, and 1 night dose (Twice daily)', '1 morning dose, 1 afternoon dose, and 1 night dose (Thrice daily)')",
      "dosage_pattern": "Raw dosage notation e.g. '1-0-1', '1-1-1', '1-0-0', '0-0-1', 'BD', 'TDS', 'OD', or null",
      "timing": {{
        "morning": "dose count e.g. '1', '0', '1/2', or null",
        "afternoon": "dose count e.g. '1', '0', '1/2', or null",
        "evening": "dose count e.g. '1', '0', or null",
        "night": "dose count e.g. '1', '0', '1/2', or null"
      }},
      "instructions": "Specific meal timing or intake advice e.g. 'After food', 'Before food', 'At bedtime', or null",
      "duration": "Treatment duration e.g. 3 days, 5 days, or null"
    }}
  ],
  "lab_results": [
    {{
      "test": "Test name e.g. Hemoglobin, Fasting Blood Sugar",
      "value": "Measured value or null",
      "unit": "Measurement unit e.g. g/dL, mg/dL, or null",
      "reference_range": "Normal range e.g. 13.5 - 17.5, or null",
      "flag": "high | low | normal | null"
    }}
  ],
  "procedures": ["Clinical procedure or advice given by physician"],
  "summary": "Short 1-2 sentence patient-friendly summary explaining the prescription, diagnostic report, or physician advice clearly.",
  "alerts": ["Array of abnormal/high/low lab result warning strings if any. Return [] if none."]
}}

CRITICAL INSTRUCTIONS FOR MEDICATIONS & DOSAGE PATTERNS:
1. Examine the entire OCR text line by line for ALL prescribed items (numbered items 1, 2, 3, Tab., Cap., Syp., Inj., Oint., Drp., or drug names).
2. DO NOT skip any medication listed in the prescription. If 4 items are listed, extract ALL 4 items into the 'medications' array.
3. Clean up the 'medicine' field so it contains the drug name and form (e.g. 'Tab. Paracetamol', 'Cap. Azithromycin', 'Tab. Levocetirizine', 'Syp. Ambrodil').
4. DOSAGE ANALOGY INTERPRETATION (CRITICAL):
   Doctors use numeric patterns (M-A-N / Morning-Afternoon-Night) and clinical abbreviations. You MUST expand these into the 'frequency' field:
   - '1-0-1' -> '1 morning dose, no afternoon, and 1 night dose (Twice daily)'
   - '1-1-1' -> '1 morning dose, 1 afternoon dose, and 1 night dose (Thrice daily)'
   - '1-0-0' -> '1 morning dose, no afternoon, and no night dose (Once daily - Morning)'
   - '0-0-1' -> 'no morning, no afternoon, and 1 night dose (Once daily - Night)'
   - '0-1-0' -> 'no morning, 1 afternoon dose, and no night dose (Once daily - Afternoon)'
   - '1-1-0' -> '1 morning dose, 1 afternoon dose, and no night dose'
   - '0-1-1' -> 'no morning, 1 afternoon dose, and 1 night dose'
   - '2-0-2' -> '2 morning dose, no afternoon, and 2 night dose'
   - '1/2-0-1/2' or '0.5-0-0.5' -> '1/2 morning dose, no afternoon, and 1/2 night dose'
   - '1-1-1-1' -> '1 morning dose, 1 afternoon dose, 1 evening dose, and 1 night dose (Four times daily)'
   - 'BD' / 'BID' -> '1 morning dose, no afternoon, and 1 night dose (Twice daily)'
   - 'TDS' / 'TID' -> '1 morning dose, 1 afternoon dose, and 1 night dose (Thrice daily)'
   - 'OD' -> '1 morning dose, no afternoon, and no night dose (Once daily - Morning)'
   - 'HS' / 'QHS' -> 'no morning, no afternoon, and 1 night dose (At bedtime / Night)'
   - 'SOS' / 'PRN' -> 'As needed in case of pain/emergency (SOS)'
5. MEAL INSTRUCTIONS:
   Extract instructions like 'AC' / 'Before food', 'PC' / 'After food', 'BBF' / 'Before breakfast', 'At bedtime' into the 'instructions' field and incorporate into 'frequency'.
6. Include any lifestyle or dietary advice (e.g. 'Take plenty of fluids', 'Steam inhalation') in the 'procedures' array.

OCR TEXT:
{ocr_text}
"""


def interpret_dosage_analogy(text: str) -> Optional[Dict[str, Any]]:
    """
    Interprets numeric dosage analogies (like 1-0-1, 1-1-1, 1-0-0, 0-0-1, 1/2-0-1/2, 2-0-2, 1-1-1-1)
    and Latin abbreviations (BD, TDS, OD, HS, QID, SOS).
    """
    if not text:
        return None

    # Single dosage unit: fraction "1/2", decimal "0.5", or integer "1"
    SLOT = r'(?:\d+\s*/\s*\d+|\d+(?:\.\d+)?|\d+)'

    # 1. Four-part dosage: M-A-E-N (e.g. 1-1-1-1, 1-0-1-1)
    m4 = re.search(
        rf'\b({SLOT})\s*-\s*({SLOT})\s*-\s*({SLOT})\s*-\s*({SLOT})\b',
        text
    )
    if m4:
        m, a, e, n = [g.replace(" ", "") for g in m4.groups()]
        pattern = f"{m}-{a}-{e}-{n}"
        m_desc = "no morning" if m == "0" else f"{m} morning dose"
        a_desc = "no afternoon" if a == "0" else f"{a} afternoon dose"
        e_desc = "no evening" if e == "0" else f"{e} evening dose"
        n_desc = "no night dose" if n == "0" else f"{n} night dose"
        human_freq = f"{m_desc}, {a_desc}, {e_desc}, and {n_desc}"
        return {
            "dosage_pattern": pattern,
            "frequency": human_freq,
            "timing": {"morning": m, "afternoon": a, "evening": e, "night": n}
        }

    # 2. Three-part dosage: M-A-N (e.g. 1-0-1, 1 - 0 - 1, 1/2-0-1/2, 0.5-0-0.5, 2-0-2, 1-1-1, 1-0-0, 0-0-1)
    m3 = re.search(
        rf'\b({SLOT})\s*-\s*({SLOT})\s*-\s*({SLOT})\b',
        text
    )
    if not m3:
        m3 = re.search(r'\b(\d)\s*/\s*(\d)\s*/\s*(\d)\b', text)

    if m3:
        m, a, n = [g.replace(" ", "") for g in m3.groups()]
        pattern = f"{m}-{a}-{n}"
        m_desc = "no morning" if m == "0" else f"{m} morning dose"
        a_desc = "no afternoon" if a == "0" else f"{a} afternoon dose"
        n_desc = "no night dose" if n == "0" else f"{n} night dose"
        human_freq = f"{m_desc}, {a_desc}, and {n_desc}"
        return {
            "dosage_pattern": pattern,
            "frequency": human_freq,
            "timing": {"morning": m, "afternoon": a, "evening": None, "night": n}
        }

    # 3. Medical Abbreviations
    t_upper = f" {text.upper()} "
    if re.search(r'\b(TDS|TID)\b', t_upper):
        return {
            "dosage_pattern": "1-1-1",
            "frequency": "1 morning dose, 1 afternoon dose, and 1 night dose (Thrice daily)",
            "timing": {"morning": "1", "afternoon": "1", "evening": None, "night": "1"}
        }
    if re.search(r'\b(BD|BID)\b', t_upper):
        return {
            "dosage_pattern": "1-0-1",
            "frequency": "1 morning dose, no afternoon, and 1 night dose (Twice daily)",
            "timing": {"morning": "1", "afternoon": "0", "evening": None, "night": "1"}
        }
    if re.search(r'\b(QID)\b', t_upper):
        return {
            "dosage_pattern": "1-1-1-1",
            "frequency": "1 morning dose, 1 afternoon dose, 1 evening dose, and 1 night dose (Four times daily)",
            "timing": {"morning": "1", "afternoon": "1", "evening": "1", "night": "1"}
        }
    if re.search(r'\b(HS|QHS)\b', t_upper) or "bedtime" in text.lower():
        return {
            "dosage_pattern": "0-0-1",
            "frequency": "no morning, no afternoon, and 1 night dose (At bedtime / Night)",
            "timing": {"morning": "0", "afternoon": "0", "evening": None, "night": "1"}
        }
    if re.search(r'\b(OD)\b', t_upper):
        return {
            "dosage_pattern": "1-0-0",
            "frequency": "1 morning dose, no afternoon, and no night dose (Once daily - Morning)",
            "timing": {"morning": "1", "afternoon": "0", "evening": None, "night": "0"}
        }
    if re.search(r'\b(SOS|PRN)\b', t_upper) or "as needed" in text.lower():
        return {
            "dosage_pattern": "SOS",
            "frequency": "As needed in case of pain/emergency (SOS)",
            "timing": {"morning": None, "afternoon": None, "evening": None, "night": None}
        }

    return None


def extract_meal_instructions(text: str) -> Optional[str]:
    """Extracts food/meal timing instructions (e.g. After food, Before food, Before breakfast)."""
    if not text:
        return None
    t_lower = text.lower()
    t_upper = f" {text.upper()} "
    if re.search(r'\b(BBF)\b', t_upper) or "before breakfast" in t_lower:
        return "Before breakfast"
    if re.search(r'\b(AC|A\.C\.)\b', t_upper) or "before food" in t_lower or "before meal" in t_lower or "khali pet" in t_lower or "empty stomach" in t_lower:
        return "Before food"
    if re.search(r'\b(PC|P\.C\.)\b', t_upper) or "after food" in t_lower or "after meal" in t_lower or "post meal" in t_lower or "khana khane ke baad" in t_lower:
        return "After food"
    if "with food" in t_lower or "with meal" in t_lower:
        return "With food"
    if "at bedtime" in t_lower or "before sleep" in t_lower:
        return "At bedtime"
    return None


def normalize_medication(med_dict: Dict[str, Any]) -> Medication:
    """
    Normalizes and enriches a medication dictionary with dosage analogy interpretation,
    timing breakdown, and clear instructions.
    """
    med_name = str(med_dict.get("medicine") or med_dict.get("name") or "Medication").strip()
    dose = med_dict.get("dose")
    freq = med_dict.get("frequency")
    duration = med_dict.get("duration")
    dosage_pattern = med_dict.get("dosage_pattern")
    timing_data = med_dict.get("timing") or {}
    instructions = med_dict.get("instructions")

    # Aggregate all text associated with this medication to scan for patterns
    combined_text = f"{med_name} {dose or ''} {freq or ''} {dosage_pattern or ''} {instructions or ''}"

    # 1. Interpret dosage pattern
    analogy = interpret_dosage_analogy(combined_text)
    if analogy:
        dosage_pattern = dosage_pattern or analogy["dosage_pattern"]
        if not freq or freq == analogy["dosage_pattern"] or re.match(r'^\d+[-/]\d+[-/]\d+', str(freq).strip()):
            freq = analogy["frequency"]
        elif "morning dose" not in str(freq).lower() and "dose" not in str(freq).lower():
            freq = f"{analogy['frequency']}"

        if not timing_data or all(v is None for v in (timing_data.values() if isinstance(timing_data, dict) else [])):
            timing_data = analogy["timing"]

    # 2. Interpret meal instructions
    meal_inst = extract_meal_instructions(combined_text)
    if meal_inst:
        instructions = instructions or meal_inst
        if freq and meal_inst.lower() not in freq.lower():
            freq = f"{freq} ({meal_inst})"

    # Convert timing dict to MedicationTiming model
    timing_model = None
    if isinstance(timing_data, dict) and any(v is not None for v in timing_data.values()):
        timing_model = MedicationTiming(
            morning=timing_data.get("morning"),
            afternoon=timing_data.get("afternoon"),
            evening=timing_data.get("evening"),
            night=timing_data.get("night")
        )
    elif isinstance(timing_data, MedicationTiming):
        timing_model = timing_data

    return Medication(
        medicine=med_name,
        dose=dose,
        frequency=freq,
        duration=duration,
        dosage_pattern=dosage_pattern,
        timing=timing_model,
        instructions=instructions
    )


def extract_entities_fallback(ocr_text: str) -> ExtractedDocument:
    raw = ocr_text or ""
    txt = raw.lower()
    doc_type = "prescription" if ("rx" in txt or "prescr" in txt or "medication" in txt) else "other"

    data = {
        "document_type": doc_type,
        "document_date": None,
        "diagnoses": [],
        "medications": [],
        "lab_results": [],
        "procedures": [],
        "summary": None,
        "alerts": [],
        "raw_text": raw
    }

    # Only attempt rule-based line parsing if document is multi-line or looks like a prescription
    lines = [line.strip() for line in raw.split("\n") if line.strip()]
    if len(lines) > 1 or any(k in txt for k in ["tab.", "cap.", "syp.", "inj.", "rx"]):
        for line in lines:
            analogy = interpret_dosage_analogy(line)
            is_med_line = (
                any(line.lower().startswith(prefix) for prefix in ["tab", "cap", "syp", "inj", "1.", "2.", "3.", "4.", "rx"])
                or analogy is not None
            )
            if is_med_line and len(line) > 3:
                # Extract duration if present e.g. "3 days", "5 days"
                dur_match = re.search(r'\b(\d+\s*(?:days?|weeks?|months?))\b', line, re.IGNORECASE)
                duration = dur_match.group(1) if dur_match else None

                # Extract dose strength if present e.g. "500 mg", "650mg", "5 ml"
                dose_match = re.search(r'\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablet|tab|cap))\b', line, re.IGNORECASE)
                dose = dose_match.group(1) if dose_match else None

                med_obj = normalize_medication({
                    "medicine": line,
                    "dose": dose,
                    "frequency": analogy["frequency"] if analogy else None,
                    "duration": duration,
                    "dosage_pattern": analogy["dosage_pattern"] if analogy else None
                })
                data["medications"].append(med_obj)

    return ExtractedDocument(**data)


def extract_entities(ocr_text: str, api_key: str | None = None) -> ExtractedDocument:
    if not api_key:
        return extract_entities_fallback(ocr_text)

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)
        payload = {
            "model": GROQ_TEXT_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You must output a valid JSON object."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 2048,
        }

        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        if resp.status_code != 200:
            raise RuntimeError(f"Groq API returned status {resp.status_code}: {resp.text}")

        res_json = resp.json()
        raw_text = res_json["choices"][0]["message"]["content"] or "{}"
        clean_text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()

        # If wrapped in markdown ```json ... ```, strip it
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```[a-z]*\n?", "", clean_text)
            clean_text = re.sub(r"\n?```$", "", clean_text)

        data = json.loads(clean_text)
        data["raw_text"] = ocr_text or ""

        # Normalize and enrich all medications with dosage pattern interpretation
        raw_meds = data.get("medications") or []
        normalized_meds = []
        for m in raw_meds:
            if isinstance(m, dict):
                normalized_meds.append(normalize_medication(m))
            elif isinstance(m, Medication):
                normalized_meds.append(normalize_medication(m.model_dump()))
        data["medications"] = normalized_meds

        # Ensure summary is populated safely without throwing NoneType AttributeError
        doc_type_name = str(data.get("document_type") or "medical").replace("_", " ")
        if not data.get("summary"):
            data["summary"] = f"Structured {doc_type_name} record extracted from uploaded document."

        # Ensure alerts are auto-detected from lab results if not provided
        if "alerts" not in data or not isinstance(data["alerts"], list):
            data["alerts"] = []

        if data.get("lab_results") and isinstance(data["lab_results"], list):
            for lab in data["lab_results"]:
                flag = (lab.get("flag") or "").lower()
                if flag in ["high", "low"]:
                    test_name = lab.get("test", "Test")
                    val = lab.get("value", "")
                    unit = lab.get("unit", "")
                    ref = lab.get("reference_range", "")
                    alert_msg = f"🚨 Abnormal {flag.upper()} Result: {test_name} is {val} {unit} ({flag.upper()}). Reference range: {ref}."
                    if alert_msg not in data["alerts"]:
                        data["alerts"].append(alert_msg)

        return ExtractedDocument(**data)
    except Exception as e:
        print(f"Groq entity extraction failed: {e}, using fallback.")
        return extract_entities_fallback(ocr_text)