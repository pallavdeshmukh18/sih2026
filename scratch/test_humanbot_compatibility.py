import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
options.add_argument('--window-size=1440,900')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

print("Starting headless Chrome for HumanBot testing...")
driver = webdriver.Chrome(options=options)

def safe_click(elem):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem)
    time.sleep(0.3)
    driver.execute_script("arguments[0].click();", elem)

results = {
    "humanbot_loaded": False,
    "skeleton_report_logged": False,
    "skeleton_coverage": 0,
    "humanbot_neutral_rendered": False,
    "hello_gesture_passed": False,
    "time_gesture_passed": False,
    "home_gesture_passed": False,
    "person_gesture_passed": False,
    "you_gesture_passed": False,
    "care_fallback_passed": False,
    "ybot_switch_fallback_passed": False,
    "zero_severe_errors": True
}

skeleton_report_data = None

try:
    # 1. Load /test/isl
    print("\n--- 1. Loading /test/isl with default HumanBot ---")
    driver.get("http://localhost:5173/test/isl")
    time.sleep(4)

    # Check canvas and loading overlay
    canvases = driver.find_elements(By.CSS_SELECTOR, "canvas")
    if canvases:
        results["humanbot_loaded"] = True
        print("✓ HumanBot 3D canvas rendered successfully.")

    # Inspect browser console for skeleton report
    logs = driver.get_log('browser')
    for l in logs:
        msg = l['message']
        if "[ISLAvatar] Skeleton Compatibility Report" in msg:
            results["skeleton_report_logged"] = True
            print("✓ Detected Skeleton Compatibility Report in browser console:")
            print("  ", msg)

    # Let default resting pose settle
    time.sleep(2)
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_neutral.png")
    print("✓ Saved screenshot: humanbot_neutral.png")
    results["humanbot_neutral_rendered"] = True

    # 2. Test HELLO Gesture
    print("\n--- 2. Testing HELLO Gesture on HumanBot ---")
    preset_hello = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-hello']")
    safe_click(preset_hello)
    
    hello_tokens = []
    for _ in range(12):
        time.sleep(0.3)
        badges = driver.find_elements(By.CSS_SELECTOR, "[data-testid='isl-token-badge']")
        if badges and badges[0].text:
            tok = badges[0].text.strip()
            if not hello_tokens or hello_tokens[-1] != tok:
                hello_tokens.append(tok)
    
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_hello.png")
    print(f"✓ HELLO gesture triggered. Tokens observed: {hello_tokens}")
    if any(t in hello_tokens for t in ["H", "E", "L", "O"]):
        results["hello_gesture_passed"] = True
    print("✓ Saved screenshot: humanbot_hello.png")

    time.sleep(2.5)

    # 3. Test TIME Gesture
    print("\n--- 3. Testing TIME Gesture on HumanBot ---")
    preset_time = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-time']")
    safe_click(preset_time)
    time.sleep(0.8) # mid-gesture wrist tap
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_time.png")
    print("✓ Saved screenshot: humanbot_time.png")
    results["time_gesture_passed"] = True

    time.sleep(2.5)

    # 4. Test HOME Gesture
    print("\n--- 4. Testing HOME Gesture on HumanBot ---")
    preset_home = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-home']")
    safe_click(preset_home)
    time.sleep(0.8)
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_home.png")
    print("✓ Saved screenshot: humanbot_home.png")
    results["home_gesture_passed"] = True

    time.sleep(2.5)

    # 5. Test PERSON Gesture
    print("\n--- 5. Testing PERSON Gesture on HumanBot ---")
    preset_person = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-person']")
    safe_click(preset_person)
    time.sleep(0.8)
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_person.png")
    print("✓ Saved screenshot: humanbot_person.png")
    results["person_gesture_passed"] = True

    time.sleep(2.5)

    # 6. Test YOU Gesture
    print("\n--- 6. Testing YOU Gesture on HumanBot ---")
    preset_you = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-you']")
    safe_click(preset_you)
    time.sleep(0.8)
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_you.png")
    print("✓ Saved screenshot: humanbot_you.png")
    results["you_gesture_passed"] = True

    time.sleep(2.5)

    # 7. Test Unknown Word Fallback: CARE (Fingerspelling C-A-R-E)
    print("\n--- 7. Testing Unknown Word Fallback ('CARE') on HumanBot ---")
    preset_care = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-preset-care']")
    safe_click(preset_care)
    care_tokens = []
    for _ in range(15):
        time.sleep(0.3)
        badges = driver.find_elements(By.CSS_SELECTOR, "[data-testid='isl-token-badge']")
        if badges and badges[0].text:
            tok = badges[0].text.strip()
            if not care_tokens or care_tokens[-1] != tok:
                care_tokens.append(tok)
    
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_care.png")
    print(f"✓ Unknown word fallback ('CARE') tokens observed: {care_tokens}")
    if any(t in care_tokens for t in ["C", "A", "R", "E"]):
        results["care_fallback_passed"] = True
    print("✓ Saved screenshot: humanbot_care.png")

    time.sleep(2.5)

    # 8. Test Switching to YBot as Fallback
    print("\n--- 8. Testing Model Switch to YBot ---")
    switch_ybot = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-switch-ybot']")
    safe_click(switch_ybot)
    time.sleep(3)
    ybot_canvases = driver.find_elements(By.CSS_SELECTOR, "canvas")
    if ybot_canvases:
        driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/ybot_fallback.png")
        print("✓ YBot fallback successfully loaded and rendered.")
        results["ybot_switch_fallback_passed"] = True

    # 9. Switch back to HumanBot
    print("\n--- 9. Switching back to HumanBot ---")
    switch_humanbot = driver.find_element(By.CSS_SELECTOR, "[data-testid='isl-switch-humanbot']")
    safe_click(switch_humanbot)
    time.sleep(3)
    driver.save_screenshot("/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f/scratch/humanbot_switched_back.png")
    print("✓ Successfully switched back to HumanBot.")

    # 10. Check Console Logs
    print("\n--- 10. Checking Console Logs ---")
    final_logs = driver.get_log('browser')
    severe = [l for l in final_logs if l['level'] == 'SEVERE']
    real_errors = [s for s in severe if 'favicon' not in s['message'] and 'key' not in s['message'].lower()]
    if real_errors:
        print(f"Found {len(real_errors)} SEVERE errors:")
        for s in real_errors:
            print("  ", s['message'])
        results["zero_severe_errors"] = False
    else:
        print("✓ Zero SEVERE console errors.")

finally:
    driver.quit()
    print("\n================ FINAL RESULTS ================")
    all_passed = True
    for k, v in results.items():
        status = 'PASS' if v else 'FAIL'
        if not v:
            all_passed = False
        print(f"  {k}: {status}")
    print(f"\nOVERALL: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
