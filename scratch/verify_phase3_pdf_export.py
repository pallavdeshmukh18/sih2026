import time
import os
import glob
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ARTIFACT_DIR = "/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f"
DOWNLOAD_DIR = os.path.join(ARTIFACT_DIR, "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYzE1M2UxNC00NWUzLTRiYWYtYmUyMS01ZmZmNTZlOWI2N2UiLCJyb2xlIjoicGF0aWVudCIsImlhdCI6MTc4OTI4Mzg2MiwiZXhwIjoxNzg5ODg4NjYyfQ.53y5DZGTmQMmj1zuWxdLeA2tfOWOoJ88oS2lJ_A94go"

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
    print("Step 1: Navigating and establishing auth...")
    driver.get("http://localhost:5173/")
    time.sleep(1)
    driver.execute_script(f"""
        localStorage.setItem('medikiosk_token', '{TOKEN}');
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('role', 'patient');
        localStorage.setItem('user', JSON.stringify({{ id: 'ec153e14-45e3-4baf-be21-5fff56e9b67e', role: 'patient', firstName: 'Amit', lastName: 'Kumar' }}));
        localStorage.setItem('medikiosk_isl_enabled', 'false');
    """)

    print("Step 2: Loading /patient/medical-passport...")
    driver.get("http://localhost:5173/patient/medical-passport")
    
    wait = WebDriverWait(driver, 15)
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'MEDICAL PASSPORT')]")))
    time.sleep(2)

    # Clean previous test PDFs in download dir
    for f in glob.glob(os.path.join(DOWNLOAD_DIR, "*.pdf")):
        try:
            os.remove(f)
        except:
            pass

    print("Step 3: Finding and clicking 'Export Medical Passport' button...")
    export_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Export Medical Passport')]")))
    export_btn.click()
    time.sleep(1)

    print("Step 4: Verifying Export Passport Modal opened...")
    modal_title = wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(text(), 'Export Medical Passport')]")))
    assert modal_title.is_displayed(), "Modal title should be visible"

    # Screenshot modal open
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "export_modal_opened.png"))
    print("Saved screenshot export_modal_opened.png")

    print("Step 5: Testing Period Selection toggling in modal...")
    three_months_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 3 Months')]")
    three_months_btn.click()
    time.sleep(0.5)

    custom_range_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Custom Range')]")
    custom_range_btn.click()
    time.sleep(0.5)
    custom_inputs = driver.find_elements(By.XPATH, "//input[@type='date']")
    assert len(custom_inputs) >= 2, f"Expected 2 date inputs for custom range, found {len(custom_inputs)}"

    one_year_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 1 Year')]")
    one_year_btn.click()
    time.sleep(0.5)

    print("Step 6: Testing Privacy Controls in modal...")
    # Find phone checkbox
    phone_cb = driver.find_element(By.XPATH, "//span[contains(text(), 'Phone Number')]/ancestor::label//input[@type='checkbox']")
    assert not phone_cb.is_selected(), "Phone should be unchecked by default"
    phone_cb.click()
    assert phone_cb.is_selected(), "Phone should now be checked"

    print("Step 7: Testing Section Checkboxes in modal...")
    qr_cb = driver.find_element(By.XPATH, "//span[contains(text(), 'Secure Provider Connection QR')]/ancestor::label//input[@type='checkbox']")
    assert not qr_cb.is_selected(), "QR should be unchecked by default"

    providers_cb = driver.find_element(By.XPATH, "//span[contains(text(), 'Connected Care Providers')]/ancestor::label//input[@type='checkbox']")
    assert not providers_cb.is_selected(), "Connected care providers should be unchecked by default"

    # Screenshot configured modal
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "export_modal_configured.png"))
    print("Saved screenshot export_modal_configured.png")

    print("Step 8: Clicking Export PDF action button...")
    action_export_btn = driver.find_element(By.XPATH, "//button[contains(., 'Export PDF')]")
    action_export_btn.click()

    print("Step 9: Waiting for PDF generation and download...")
    # Wait for success message or downloaded file
    time.sleep(4)

    pdf_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.pdf"))
    print("PDF files found in download dir:", pdf_files)

    if not pdf_files:
        # Check default system Downloads directory as backup
        user_downloads = os.path.expanduser("~/Downloads")
        recent_pdfs = glob.glob(os.path.join(user_downloads, "MediKiosk_Medical_Passport_*.pdf"))
        if recent_pdfs:
            # Pick newest
            newest_pdf = max(recent_pdfs, key=os.path.getmtime)
            if time.time() - os.path.getmtime(newest_pdf) < 60:
                pdf_files = [newest_pdf]
                print(f"Found downloaded PDF in ~/Downloads: {newest_pdf}")

    assert len(pdf_files) > 0, "PDF file was not downloaded!"
    pdf_path = pdf_files[0]
    file_size = os.path.getsize(pdf_path)
    print(f"Downloaded PDF: {pdf_path} (size: {file_size} bytes)")
    assert file_size > 500, f"PDF file size is suspiciously small ({file_size} bytes)"

    with open(pdf_path, "rb") as pf:
        header = pf.read(5)
        assert header == b"%PDF-", f"Expected valid PDF header %PDF-, got {header}"
        pf.seek(0)
        content = pf.read().decode("latin-1", errors="ignore")
        assert "MEDIKIOSK MEDICAL PASSPORT" in content, "PDF missing MEDIKIOSK title text"
        assert "PORTABLE CLINICAL RESUME" in content, "PDF missing subtitle"
        assert "ALLERGIES" in content, "PDF missing ALLERGIES section"
        assert "MEDICATIONS" in content, "PDF missing MEDICATIONS section"
        assert "Confidential Medical Information" in content, "PDF missing footer confidentiality note"

    print("Step 10: PDF document structure, headers, and text selectability VERIFIED!")
    print("SUCCESS: Phase 3 PDF Export completed with flying colors!")

finally:
    driver.quit()
