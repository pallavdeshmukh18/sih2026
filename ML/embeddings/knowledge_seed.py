import logging
from typing import Dict, List, Any

logger = logging.getLogger("medikiosk.embeddings.knowledge_seed")

CLINICAL_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "id": "cardiac_chest_pain",
        "category": "cardiology",
        "condition": "chest_pain",
        "keywords": ["chest pain", "angina", "tightness in chest", "heart pain", "pressure in chest"],
        "disease_specific_questions": [
            "Does the pain radiate or spread to your left arm, shoulder, neck, jaw, or back?",
            "Are you experiencing any shortness of breath, heavy sweating, nausea, or lightheadedness alongside the chest pain?",
            "Did the pain start during physical exertion, exercise, or emotional stress?"
        ],
        "parameter_rephrasing": {
            "onset": "Did this chest pressure begin suddenly or build up gradually over hours?",
            "character": "Is the feeling a sharp stabbing pain, heavy crushing pressure, or burning sensation?",
            "radiation": "Does the discomfort travel to your left arm, jaw, or upper back?",
            "aggravating_factors": "Does walking or climbing stairs make the chest discomfort worse?"
        },
        "red_flag_triggers": ["pain radiating to left arm", "diaphoresis/sweating", "dyspnea/shortness of breath"]
    },
    {
        "id": "gastrointestinal_abdominal_pain",
        "category": "gastroenterology",
        "condition": "abdominal_pain",
        "keywords": ["stomach pain", "abdominal pain", "belly ache", "gastritis", "acidity", "indigestion"],
        "disease_specific_questions": [
            "Is the pain related to your meals—does it get worse right after eating or when your stomach is empty?",
            "Have you noticed any change in your bowel habits, such as diarrhea, constipation, or dark-colored stool?",
            "Are you feeling bloated or experiencing frequent acid reflux or heartburn?"
        ],
        "parameter_rephrasing": {
            "location": "Which quadrant or area of your abdomen is most painful (e.g., upper middle, lower right)?",
            "last_meal": "When did you last eat, and did the meal include oily, spicy, or heavy foods?",
            "relieving_factors": "Does taking antacids, passing gas, or resting bring you relief?"
        },
        "red_flag_triggers": ["black tarry stool", "severe right lower quadrant pain", "persistent vomiting"]
    },
    {
        "id": "respiratory_dyspnea_cough",
        "category": "pulmonology",
        "condition": "respiratory",
        "keywords": ["shortness of breath", "cough", "wheezing", "asthma", "breathlessness", "phlegm"],
        "disease_specific_questions": [
            "Are you coughing up any phlegm or sputum, and if so, what color is it?",
            "Does your breathing sound like a whistling or wheezing sound when you exhale?",
            "Do you feel breathless even when resting or lying flat in bed?"
        ],
        "parameter_rephrasing": {
            "onset": "Did the shortness of breath develop suddenly or worsen gradually over days?",
            "character": "Do you feel like you can't catch a full breath or is your chest feeling tight?",
            "aggravating_factors": "Does cold air, dust, pollen, or physical exertion trigger the coughing?"
        },
        "red_flag_triggers": ["stridor", "bluish lips/cyanosis", "unable to speak full sentences"]
    },
    {
        "id": "infectious_fever",
        "category": "infectious_disease",
        "condition": "fever",
        "keywords": ["fever", "chills", "high body temperature", "body ache", "flu", "viral"],
        "disease_specific_questions": [
            "Do you have severe chills, shivering, or sweating spells that come and go?",
            "Are you experiencing severe headaches, eye pain, or extreme body aches?",
            "Have you noticed any skin rash, sore throat, or joint swelling?"
        ],
        "parameter_rephrasing": {
            "severity": "What was your highest measured temperature, or does your body feel burning hot?",
            "duration": "For how many consecutive days have you had this fever?",
            "associated_symptoms": "Along with the fever, do you have chills, body aches, or nausea?"
        },
        "red_flag_triggers": ["fever > 103F", "stiff neck", "confusion or extreme lethargy"]
    },
    {
        "id": "ayush_dashavidha_pariksha",
        "category": "ayush",
        "condition": "ayush_general",
        "keywords": ["prakriti", "dosha", "vata", "pitta", "kapha", "ayush", "agni", "digestion"],
        "disease_specific_questions": [
            "How would you describe your digestive capacity (Agni) and appetite regularity?",
            "Do you generally tolerate cold weather or hot weather better (Prakriti assessment)?",
            "How is your physical endurance, daily stamina, and sleep quality?"
        ],
        "parameter_rephrasing": {
            "prakriti": "What is your natural thermal preference (do you easily feel cold or feel excessively hot)?",
            "ahara_shakti": "How is your appetite, and how well do you digest heavy meals?",
            "satwa": "How is your mental stress resilience and emotional steady state?",
            "vyayama_shakti": "How much physical exercise or hard labor can your body sustain without fatigue?"
        },
        "red_flag_triggers": []
    }
]

def seed_clinical_knowledge_base(force_reseed: bool = False) -> Dict[str, Any]:
    """In-memory clinical knowledge base ready."""
    logger.info(f"Loaded {len(CLINICAL_KNOWLEDGE_BASE)} clinical knowledge protocols.")
    return {"status": "seeded", "count": len(CLINICAL_KNOWLEDGE_BASE)}

if __name__ == "__main__":
    res = seed_clinical_knowledge_base(force_reseed=True)
    print("Seeding Result:", res)
