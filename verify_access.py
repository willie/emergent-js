
import os
import time
from playwright.sync_api import sync_playwright

def verify_scenario_selector():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Wait for server to start
        max_retries = 30
        for i in range(max_retries):
            try:
                page.goto("http://localhost:3000")
                break
            except Exception:
                if i == max_retries - 1:
                    raise
                time.sleep(1)

        # 1. Verify Tabs exist and have correct roles
        tablist = page.locator('[role="tablist"]')
        if tablist.count() == 0:
            print("❌ Tablist not found")
        else:
            print("✅ Tablist found")

        new_tab = page.locator('#tab-new')
        load_tab = page.locator('#tab-load')

        if new_tab.get_attribute('role') == 'tab' and load_tab.get_attribute('role') == 'tab':
             print("✅ Tabs have correct roles")
        else:
             print("❌ Tabs missing roles")

        # 2. Verify Tab Panels
        new_panel = page.locator('#panel-new')
        if new_panel.get_attribute('role') == 'tabpanel':
             print("✅ Tab panel has correct role")
        else:
             print("❌ Tab panel missing role")

        # 3. Verify Scenario Card Structure
        # The built-in scenario should be a button now, or contain a stretched link button
        scenario_button = page.locator('#panel-new button.text-left')
        if scenario_button.count() > 0:
            print("✅ Scenario card is interactable (button found)")
        else:
            print("❌ Scenario card button not found")

        # Take screenshot of the Scenario Selector
        os.makedirs("verification", exist_ok=True)
        screenshot_path = "verification/scenario_selector.png"
        page.screenshot(path=screenshot_path)
        print(f"✅ Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    try:
        verify_scenario_selector()
    except Exception as e:
        print(f"❌ Verification failed: {e}")
