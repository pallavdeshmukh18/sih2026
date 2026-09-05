import json
import requests

from config import GEMINI_URL, GEMINI_TIMEOUT_SECONDS
from schemas import ExtractedDocument


EXTRACTION_PROMPT = """You are a medical document structuring engine.

Given raw OCR text from a medical document, extract structured data.

Respond with ONLY valid JSON.
Do not include markdown fences.
Do not include commentary.

Use exactly this schema:

{{
  "document_type": "prescription | lab_report | discharge_summary | certificate",
  "document_date": "string or null",
  "diagnoses": ["string", "..."],
  "medications": [
    {{
      "medicine": "string",
      "dose": "string or null",
      "frequency": "string or null",
      "duration": "string or null"
    }}
  ],
  "lab_results": [
    {{
      "test": "string",
      "value": "string or null",
      "unit": "string or null",
      "reference_range": "string or null",
      "flag": "high | low | normal | null"
    }}
  ],
  "procedures": ["string", "..."]
}}

Rules:

1. Do not guess information.
2. If information is not present, use null or an empty list.
3. Preserve medication names and dosages exactly as written.
4. Do not infer a diagnosis from a medication.
5. Do not infer a lab result from a reference range.
6. Use the document type that best matches the OCR text.

OCR TEXT:
{ocr_text}
"""


def extract_entities(ocr_text: str, api_key: str):
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": EXTRACTION_PROMPT.format(
                            ocr_text=ocr_text
                        )
                    }
                ]
            }
        ]
    }

    resp = requests.post(
        f"{GEMINI_URL}?key={api_key}",
        json=payload,
        timeout=GEMINI_TIMEOUT_SECONDS
    )

    if not resp.ok:
        print("Entity extraction status code:", resp.status_code)
        print("Entity extraction response:", resp.text)

    resp.raise_for_status()

    text = (
        resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        .strip()
    )

    # Remove markdown fences if Gemini returns them
    if text.startswith("```json"):
        text = text[len("```json"):]

    if text.startswith("```"):
        text = text[len("```"):]

    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned invalid JSON: {e}\n"
            f"Response was: {text}"
        )

    data["raw_text"] = ocr_text

    return ExtractedDocument(**data)