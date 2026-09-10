import json
import re
import requests
from config import GROQ_TEXT_MODEL
from schemas import ExtractedDocument

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
      "medicine": "Clean medication name (e.g. Paracetamol, Azithromycin, Levocetirizine, Ambrodil or Tab. Paracetamol)",
      "dose": "Dosage strength e.g. 500 mg, 5 mg, 15 ml, 1 tablet, 2 teaspoonful, or null",
      "frequency": "Frequency instructions e.g. Twice daily after food, Once daily at night, or null",
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

CRITICAL INSTRUCTIONS FOR MEDICATIONS:
1. Examine the entire OCR text line by line for ALL prescribed items. Look for numbered items (1), (2), (3), (4), prefixes like Tab., Cap., Syp., Inj., Oint., Drp., or drug names.
2. DO NOT skip any medication listed in the prescription. If 4 items are listed, extract ALL 4 items into the 'medications' array.
3. Clean up the 'medicine' field so it contains the drug name (e.g. 'Tab. Paracetamol', 'Cap. Azithromycin', 'Tab. Levocetirizine', 'Syp. Ambrodil').
4. Separate the dose (e.g. '500 mg'), frequency (e.g. 'Twice daily after food'), and duration (e.g. '3 days') into their respective fields.
5. Include any lifestyle or dietary advice (e.g. 'Take plenty of fluids', 'Steam inhalation') in the 'procedures' array.

OCR TEXT:
{ocr_text}
"""

def extract_entities_fallback(ocr_text: str) -> ExtractedDocument:
    raw = ocr_text or ""
    txt = raw.lower()
    doc_type = "prescription" if ("rx" in txt or "prescr" in txt or "medication" in txt) else "other"
    summary_text = (raw[:200] + "...") if len(raw) > 200 else (raw if raw.strip() else None)
    data = {
        "document_type": doc_type,
        "document_date": None,
        "diagnoses": [],
        "medications": [],
        "lab_results": [],
        "procedures": [],
        "summary": summary_text,
        "alerts": [],
        "raw_text": raw
    }
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