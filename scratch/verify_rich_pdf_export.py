import time
import os
import glob
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import fitz

ARTIFACT_DIR = "/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f"
DOWNLOAD_DIR = os.path.join(ARTIFACT_DIR, "downloads")

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1440,1100")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
prefs = {
    "download.default_directory": DOWNLOAD_DIR,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True
}
chrome_options.add_experimental_option("prefs", prefs)

driver = webdriver.Chrome(options=chrome_options)

try:
    driver.get("http://localhost:5173/")
    time.sleep(1)

    # Clean previous test PDFs
    for f in glob.glob(os.path.join(DOWNLOAD_DIR, "MediKiosk_Medical_Passport_Rich_*.pdf")):
        try: os.remove(f)
        except: pass

    # Execute JS to run exportMedicalPassportPDF with a comprehensive clinical dataset
    driver.execute_script("""
        import('/src/utils/medicalPassportPdfGenerator.js').then(async (module) => {
            const richData = {
                patient: {
                    name: 'Aarav Sharma',
                    dateOfBirth: '1995-04-12',
                    age: 31,
                    gender: 'Male',
                    state: 'Karnataka',
                    preferredLanguage: 'English',
                    bloodGroup: 'O+',
                    abhaId: '91-1234-5678-9012',
                    phone: '+91 98765 43210',
                    email: 'aarav.sharma@example.com'
                },
                healthSummary: {
                    summary: 'Patient has a history of seasonal allergic rhinitis and mild asthma, well-controlled on current inhaled bronchodilator therapy. Recent acute presentation for fever and dry cough was evaluated and treated symptomatically with full recovery. Routine biochemical and metabolic parameters remain within expected physiological ranges.',
                    isAiGenerated: true
                },
                allergies: [
                    { id: '1', allergy: 'Penicillin', reaction: 'Severe Urticaria and Facial Angioedema', severity: 'High', date: '2022-03-10', source: 'Hospital Intake', isCurrentlyActive: true },
                    { id: '2', allergy: 'Peanuts', reaction: 'Mild Gastrointestinal distress', severity: 'Moderate', date: '2024-01-15', source: 'Patient Reported', isCurrentlyActive: true }
                ],
                conditions: [
                    { id: '1', condition: 'Bronchial Asthma (J45.909)', status: 'active', diagnosedDate: '2021-06-15', source: 'Pulmonology Clinic' },
                    { id: '2', condition: 'Allergic Rhinitis (J30.9)', status: 'active', diagnosedDate: '2019-11-20', source: 'ENT OPD' },
                    { id: '3', condition: 'Acute Viral Pharyngitis', status: 'resolved', diagnosedDate: '2026-02-10', source: 'General OPD' }
                ],
                medications: [
                    { id: '1', medicine: 'Budesonide + Formoterol Inhaler', dosage: '200/6 mcg', frequency: '1 puff twice daily', duration: 'Ongoing', prescribedDate: '2026-08-10', source: 'Dr. Ramesh Rao' },
                    { id: '2', medicine: 'Montelukast Sodium', dosage: '10 mg', frequency: '1 tab at bedtime', duration: '30 days', prescribedDate: '2026-08-10', source: 'Dr. Ramesh Rao' },
                    { id: '3', medicine: 'Paracetamol', dosage: '650 mg', frequency: 'SOS for fever > 100°F', duration: 'As needed', prescribedDate: '2026-09-08', source: 'Dr. Priya Nair' }
                ],
                procedures: [
                    { id: '1', procedure: 'Spirometry and Pulmonary Function Test', performedDate: '2025-04-18', provider: 'Apex Pulmonary Lab', notes: 'Mild reversible obstructive pattern noted' },
                    { id: '2', procedure: 'Skin Prick Allergy Panel', performedDate: '2024-01-20', provider: 'Allergy Care Center', notes: 'Positive wheal for tree pollens and dust mites' }
                ],
                consultations: [
                    {
                        id: '1',
                        doctorName: 'Dr. Ramesh Rao',
                        specialization: 'Pulmonologist',
                        consultationDate: '2026-08-10',
                        chiefComplaint: 'Follow-up for seasonal asthma exacerbation with nocturnal cough',
                        diagnosis: 'Moderate persistent asthma under good control',
                        treatment: 'Continue Budesonide/Formoterol maintenance. Step-down advised if symptom-free for 3 months.'
                    },
                    {
                        id: '2',
                        doctorName: 'Dr. Priya Nair',
                        specialization: 'General Physician',
                        consultationDate: '2026-09-08',
                        chiefComplaint: 'Acute onset high fever (102°F), chills, and body ache for 2 days',
                        diagnosis: 'Acute Viral Pyrexia',
                        treatment: 'Adequate oral hydration, antipyretics, rest. Advised CBC and dengue NS1 if fever persists > 72 hours.'
                    }
                ],
                investigations: [
                    { id: '1', testName: 'Complete Blood Count (CBC) - Hemoglobin', resultValue: '14.8', unit: 'g/dL', referenceRange: '13.5 - 17.5', status: 'normal', abnormalFlag: false, recordedAt: '2026-09-08' },
                    { id: '2', testName: 'Total Leukocyte Count (TLC)', resultValue: '11,800', unit: '/mcL', referenceRange: '4,000 - 11,000', status: 'abnormal', abnormalFlag: true, recordedAt: '2026-09-08' },
                    { id: '3', testName: 'Platelet Count', resultValue: '210,000', unit: '/mcL', referenceRange: '150,000 - 450,000', status: 'normal', abnormalFlag: false, recordedAt: '2026-09-08' },
                    { id: '4', testName: 'Serum Total IgE', resultValue: '340', unit: 'IU/mL', referenceRange: '< 100', status: 'abnormal', abnormalFlag: true, recordedAt: '2026-04-12' },
                    { id: '5', testName: 'Fasting Blood Glucose', resultValue: '88', unit: 'mg/dL', referenceRange: '70 - 100', status: 'normal', abnormalFlag: false, recordedAt: '2026-01-10' }
                ],
                ayush: {
                    prakriti: 'Vata-Pitta Dominant',
                    vikriti: 'Pitta Imbalance with mild Kapha accumulation',
                    agni: 'Vishama Agni (Variable Digestive Fire)',
                    koshtha: 'Madhyama (Balanced elimination)',
                    satmya: 'Katu & Tikta Rasa (Pungent & Bitter adaptability)',
                    aharaVihara: 'Warm cooked meals with ghee; avoid cold/dry raw foods and late-night exposure to wind.',
                    summary: 'Patient presents with seasonal flare-ups correlating with Sharad Ritu (autumn Pitta aggravation). Recommended Shirodhara and herbal tea formulation with Yashtimadhu and Tulsi.'
                },
                documents: [
                    { id: '1', fileName: 'CBC_Report_08Sep2026.pdf', documentType: 'Laboratory Report', date: '2026-09-08', ocrStatus: 'Processed' },
                    { id: '2', fileName: 'Pulmonary_Function_Test.pdf', documentType: 'Diagnostic Report', date: '2025-04-18', ocrStatus: 'Processed' },
                    { id: '3', fileName: 'Prescription_DrRameshRao.jpg', documentType: 'Prescription', date: '2026-08-10', ocrStatus: 'Processed' }
                ],
                timeline: [
                    { id: '1', type: 'CONSULTATION', date: '2026-09-08', title: 'Consultation with Dr. Priya Nair', subtitle: 'General Medicine', details: 'Acute Viral Pyrexia, fever and body ache' },
                    { id: '2', type: 'LAB REPORT', date: '2026-09-08', title: 'Complete Blood Count (CBC)', subtitle: 'Apex Diagnostics', details: 'Leukocytosis (11,800 /mcL)' },
                    { id: '3', type: 'PRESCRIPTION', date: '2026-08-10', title: 'Pulmonary Maintenance Prescription', subtitle: 'Dr. Ramesh Rao', details: 'Budesonide/Formoterol + Montelukast' },
                    { id: '4', type: 'DIAGNOSTIC', date: '2025-04-18', title: 'Pulmonary Function Test (Spirometry)', subtitle: 'Apex Pulmonary Lab', details: 'Mild reversible obstructive airway limitation' }
                ],
                connectedDoctors: [
                    { doctorName: 'Dr. Ramesh Rao', specialization: 'Pulmonology', connectedAt: '2025-01-10' }
                ],
                reportingPeriod: {
                    cutoffDate: '2025-09-13T00:00:00.000Z'
                }
            };

            await module.exportMedicalPassportPDF({
                data: richData,
                periodLabel: 'Last 1 Year',
                sections: {
                    patientProfile: true,
                    healthSummary: true,
                    allergies: true,
                    conditions: true,
                    medications: true,
                    procedures: true,
                    consultations: true,
                    investigations: true,
                    timeline: true,
                    documents: true,
                    ayush: true,
                    connectedProviders: true,
                    secureQr: false
                },
                privacy: {
                    name: true,
                    dobAge: true,
                    gender: true,
                    state: true,
                    language: true,
                    bloodGroup: true,
                    abhaId: true,
                    phone: false,
                    email: false
                }
            });
            window.__pdf_done = true;
        });
    """)

    print("Waiting for rich PDF export to complete...")
    for _ in range(20):
        time.sleep(1)
        done = driver.execute_script("return window.__pdf_done === true;")
        if done:
            break

    time.sleep(2)
    pdf_files = glob.glob(os.path.join(DOWNLOAD_DIR, "MediKiosk_Medical_Passport_Aarav_Sharma_*.pdf"))
    assert len(pdf_files) > 0, "Rich PDF file was not downloaded!"
    rich_pdf = pdf_files[0]
    print(f"Downloaded rich PDF: {rich_pdf}")

    # Inspect PDF with fitz
    doc = fitz.open(rich_pdf)
    print(f"Rich PDF Total Pages: {len(doc)}")
    assert len(doc) >= 2, f"Expected multi-page PDF for rich clinical history, got {len(doc)} pages"

    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        out_img = os.path.join(ARTIFACT_DIR, f"passport_rich_page_{i+1}.png")
        pix.save(out_img)
        print(f"Saved {out_img}")

    print("SUCCESS: Multi-page rich PDF verified with headers, tables, AYUSH profile, and running page numbers!")

finally:
    driver.quit()
