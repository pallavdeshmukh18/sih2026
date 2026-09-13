import time
import os
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ARTIFACT_DIR = "/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYzE1M2UxNC00NWUzLTRiYWYtYmUyMS01ZmZmNTZlOWI2N2UiLCJyb2xlIjoicGF0aWVudCIsImlhdCI6MTc4OTI4Mzg2MiwiZXhwIjoxNzg5ODg4NjYyfQ.53y5DZGTmQMmj1zuWxdLeA2tfOWOoJ88oS2lJ_A94go"

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1440,1200")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

driver = webdriver.Chrome(options=chrome_options)
results = {}

try:
    print("Step 1: Navigating to base URL and setting up authentication token...")
    driver.get("http://localhost:5173/")
    time.sleep(1)
    
    driver.execute_script(f"""
        localStorage.setItem('medikiosk_token', '{TOKEN}');
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('role', 'patient');
        localStorage.setItem('user', JSON.stringify({{ id: 'ec153e14-45e3-4baf-be21-5fff56e9b67e', role: 'patient', firstName: 'Amit', lastName: 'Kumar' }}));
        localStorage.setItem('medikiosk_isl_enabled', 'false');
    """)

    # 1. Test redirect: navigate to /patient/medical-id
    print("Step 2: Navigating to /patient/medical-id to test redirect...")
    driver.get("http://localhost:5173/patient/medical-id")
    
    wait = WebDriverWait(driver, 15)
    # Wait until h1 is present
    h1_elem = wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'MEDICAL PASSPORT')]")))
    print("Found H1:", h1_elem.text)
    current_url = driver.current_url
    print(f"Current URL: {current_url}")
    results["redirect_success"] = "/patient/medical-passport" in current_url
    results["h1_title"] = h1_elem.text

    # Take screenshot of the initial 1-year view
    time.sleep(1)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_1_default_1year.png"))
    print("Captured passport_1_default_1year.png")

    body_text = driver.find_element(By.TAG_NAME, "body").text
    results["sections"] = {
        "demographic_profile": "PATIENT DEMOGRAPHIC PROFILE" in body_text,
        "health_summary": "HEALTH SUMMARY" in body_text,
        "allergies": "ALLERGIES" in body_text,
        "conditions": "KNOWN CONDITIONS" in body_text,
        "medications": "MEDICATIONS" in body_text,
        "procedures": "PROCEDURES & SURGERIES" in body_text,
        "consultations": "RECENT CONSULTATIONS" in body_text,
        "investigations": "RECENT INVESTIGATIONS" in body_text,
        "timeline": "MEDICAL TIMELINE" in body_text,
        "documents": "MEDICAL DOCUMENTS" in body_text,
        "connected_providers": "CONNECTED CARE PROVIDERS" in body_text,
        "secure_provider_qr": "SECURE PROVIDER CONNECTION" in body_text,
    }

    # Step 3: Test 3 Months Filter
    print("Step 3: Testing 3 Months filter...")
    btn_3m = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 3 months')]")
    btn_3m.click()
    time.sleep(1.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_2_3months.png"))
    print("Captured passport_2_3months.png")

    # Step 4: Test 2 Years Filter
    print("Step 4: Testing 2 Years filter...")
    btn_2y = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 2 years')]")
    btn_2y.click()
    time.sleep(1.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_3_2years.png"))
    print("Captured passport_3_2years.png")

    # Step 5: Test 5 Years Filter
    print("Step 5: Testing 5 Years filter...")
    btn_5y = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 5 years')]")
    btn_5y.click()
    time.sleep(1.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_4_5years.png"))
    print("Captured passport_4_5years.png")

    # Step 6: Test All History Filter
    print("Step 6: Testing All History filter...")
    btn_all = driver.find_element(By.XPATH, "//button[contains(text(), 'All available history')]")
    btn_all.click()
    time.sleep(1.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_5_all.png"))
    print("Captured passport_5_all.png")

    # Step 7: Test Custom Date Range
    print("Step 7: Testing Custom Range...")
    btn_custom = driver.find_element(By.XPATH, "//button[contains(text(), 'Custom date range')]")
    btn_custom.click()
    time.sleep(0.5)
    start_input = driver.find_element(By.ID, "customStart")
    end_input = driver.find_element(By.ID, "customEnd")
    start_input.send_keys("2024-01-01")
    end_input.send_keys("2026-12-31")
    apply_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Apply Filter')]")
    apply_btn.click()
    time.sleep(1.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_6_custom.png"))
    print("Captured passport_6_custom.png")

    # Return to 1 year
    btn_1y = driver.find_element(By.XPATH, "//button[contains(text(), 'Last 1 year')]")
    btn_1y.click()
    time.sleep(1.5)

    # Step 8: Test Export Medical Passport button
    print("Step 8: Testing Export button notice...")
    export_btn = driver.find_element(By.XPATH, "//button[contains(@class, 'exportBtn')]")
    export_btn.click()
    time.sleep(0.8)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_7_export_clicked.png"))
    print("Captured passport_7_export_clicked.png")

    # Step 9: Test Account page to verify Blood Group dropdown option
    print("Step 9: Testing Account page for Blood Group option...")
    driver.get("http://localhost:5173/patient/account")
    time.sleep(2)
    # Click Edit Profile button
    edit_btn = driver.find_element(By.XPATH, "//button[contains(., 'Edit Profile') or contains(., 'Edit')]")
    edit_btn.click()
    time.sleep(1)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_8_account_blood_group.png"))
    print("Captured passport_8_account_blood_group.png")
    
    # Check if select[name='bloodGroup'] exists
    bg_select = driver.find_element(By.NAME, "bloodGroup")
    options = [opt.text for opt in bg_select.find_elements(By.TAG_NAME, "option")]
    results["blood_group_options"] = options
    print(f"Blood Group options in Account: {options}")

    # Step 10: Test Mobile Viewport
    print("Step 10: Testing Mobile Viewport (375x812)...")
    driver.get("http://localhost:5173/patient/medical-passport")
    driver.set_window_size(375, 812)
    time.sleep(2)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "passport_9_mobile_view.png"))
    print("Captured passport_9_mobile_view.png")

    # Step 11: Check console errors
    logs = driver.get_log("browser")
    errors = [l for l in logs if l["level"] == "SEVERE" and "favicon" not in l["message"]]
    results["severe_console_errors"] = errors
    print(f"Severe console errors: {len(errors)}")

    print("\n--- FINAL TEST RESULTS ---")
    print(json.dumps(results, indent=2))
    print("--- SUCCESS ---")

finally:
    driver.quit()
