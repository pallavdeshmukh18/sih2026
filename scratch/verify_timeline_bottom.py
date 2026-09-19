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
chrome_options.add_argument("--window-size=1440,1100")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=chrome_options)

try:
    driver.get("http://localhost:5173/")
    time.sleep(1)
    
    driver.execute_script(f"""
        localStorage.setItem('medikiosk_token', '{TOKEN}');
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('role', 'patient');
        localStorage.setItem('user', JSON.stringify({{ id: 'ec153e14-45e3-4baf-be21-5fff56e9b67e', role: 'patient', firstName: 'Amit', lastName: 'Kumar' }}));
        localStorage.setItem('medikiosk_isl_enabled', 'false');
    """)

    driver.get("http://localhost:5173/patient/medical-passport")
    print("Navigated to /patient/medical-passport...")
    
    wait = WebDriverWait(driver, 15)
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'MEDICAL PASSPORT')]")))
    time.sleep(2)

    # Find all h2 headings inside sections
    h2_elements = driver.find_elements(By.XPATH, "//main//section//h2")
    headings = [h.text.strip() for h in h2_elements if h.text.strip()]
    print("Section headings in order:")
    for idx, h in enumerate(headings, 1):
        print(f"  {idx}. {h}")

    # Capture top viewport screenshot
    screenshot_path = os.path.join(ARTIFACT_DIR, "passport_top_with_qr.png")
    driver.save_screenshot(screenshot_path)
    print(f"Saved screenshot to {screenshot_path}")

    assert "SECURE PROVIDER CONNECTION" in headings[:3], f"Expected SECURE PROVIDER CONNECTION near the top, got order: {headings}"
    print("SUCCESS: Verified SECURE PROVIDER CONNECTION is now at the top!")

finally:
    driver.quit()
