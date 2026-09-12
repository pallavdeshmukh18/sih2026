import json
import re
import requests
from config import GROQ_TEXT_MODEL

POLICY_PROMPT = """Extract structured health-insurance policy data from the OCR text below.
Use document meaning, headings, and table relationships—not just adjacent words.
For example, a title such as 'AarogyaSure Health Insurance' is the insurer name even if
there is no explicit Insurer Name row. Never take insurer/TPA wording from disclaimers.

Return ONLY valid JSON with this exact shape:
{
  "insurer_name": string or null,
  "policy_number": string or null,
  "member_id": string or null,
  "plan_name": string or null,
  "policy_type": string or null,
  "policy_start_date": "YYYY-MM-DD" or null,
  "policy_end_date": "YYYY-MM-DD" or null,
  "sum_insured": number or null,
  "remaining_sum_insured": number or null,
  "deductible": number or null,
  "copay_percent": number or null,
  "room_rent_limit_per_day": number or null,
  "icu_limit_per_day": number or null,
  "network_required": boolean or null,
  "waiting_period_general_days": integer or null,
  "procedure_limits": [{"procedure_name": string, "procedure_code": null, "max_eligible_amount": number or null, "waiting_period_days": integer, "notes": string or null}],
  "exclusions": [{"exclusion_name": string, "description": string or null}]
}

Convert lakh/crore amounts to rupees and month/year waiting periods to approximate days.
Do not guess values that are not supported by the document.

OCR TEXT:
{ocr_text}
"""

def extract_policy_entities(ocr_text: str, api_key: str | None) -> dict:
    if not api_key or not (ocr_text or "").strip():
        return {}
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": GROQ_TEXT_MODEL,
            "messages": [
                {"role": "system", "content": "You extract insurance data into strict JSON. Never calculate claim eligibility."},
                {"role": "user", "content": POLICY_PROMPT.replace("{ocr_text}", ocr_text[:24000])},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "max_tokens": 4096,
        },
        timeout=35,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Policy extraction API returned {response.status_code}: {response.text[:500]}")
    content = response.json()["choices"][0]["message"]["content"] or "{}"
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content)
    result = json.loads(content)
    return result if isinstance(result, dict) else {}
