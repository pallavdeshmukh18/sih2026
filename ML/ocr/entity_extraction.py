import json
from config import GROQ_TEXT_MODEL
from groq import Groq
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
    client = Groq(api_key=api_key)

    prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You must output a valid JSON object."
            },
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model=GROQ_TEXT_MODEL,
        response_format={"type": "json_object"}
    )

    text = chat_completion.choices[0].message.content.strip()

    try:
        data = json.loads(text)

    except json.JSONDecodeError as e:
        raise ValueError(
            f"Groq returned invalid JSON: {e}\n"
            f"Response was: {text}"
        )

    data["raw_text"] = ocr_text

    return ExtractedDocument(**data)