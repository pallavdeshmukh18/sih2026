from typing import List, Dict

def evaluate_red_flags(entities: List[Dict[str, str]]) -> List[str]:
    """
    Evaluates a list of extracted entities against deterministic safety rules.
    Returns a list of identified red flag warnings.
    """
    flags = []
    
    # Flatten entities for easier rule checking
    # In a real system, we'd use normalized concepts (e.g. SNOMED CT codes)
    values_str = " ".join([str(e.get("value", "")).lower() for e in entities])
    
    # Rule 1: Cardiac / Respiratory Distress
    if "chest" in values_str and ("pain" in values_str or "pressure" in values_str):
        if "shortness of breath" in values_str or "sweating" in values_str or "jaw" in values_str:
            flags.append("Potential cardiac event (Chest pain with associated symptoms). Priority triage recommended.")
            
    # Rule 2: Stroke signs
    if "weakness" in values_str and ("face" in values_str or "arm" in values_str) or "slurred speech" in values_str:
        flags.append("Potential neurological event (FAST signs). Priority triage recommended.")
        
    # Rule 3: Severe abdominal pain
    if "abdominal" in values_str and "severe" in values_str and "vomiting" in values_str:
        flags.append("Severe acute abdominal pain with vomiting. Immediate evaluation recommended.")
        
    return flags
