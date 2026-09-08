# schemas.py
from pydantic import BaseModel
from typing import Optional, List

class Medication(BaseModel):
    medicine: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None

class LabResult(BaseModel):
    test: str
    value: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    flag: Optional[str] = None  # "high" | "low" | "normal" | None

class ExtractedDocument(BaseModel):
    document_type: str            # prescription | lab_report | discharge_summary | certificate
    document_date: Optional[str] = None
    diagnoses: List[str] = []
    medications: List[Medication] = []
    lab_results: List[LabResult] = []
    procedures: List[str] = []
    summary: Optional[str] = None
    alerts: List[str] = []
    raw_text: str