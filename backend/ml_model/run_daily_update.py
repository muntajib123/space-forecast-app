# backend/ml_model/run_daily_update.py
import subprocess
import sys
import os

print("🚀 Running daily forecast update...")

# Always resolve paths relative to this script's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def run_script(script_path, cwd=None):
    """Run a script with Python, print start/finish logs."""
    abs_path = os.path.join(cwd or BASE_DIR, script_path)
    print(f"▶️ Running {script_path} ...")
    result = subprocess.run([sys.executable, abs_path])
    if result.returncode != 0:
        print(f"❌ {script_path} failed with code {result.returncode}")
    else:
        print(f"✅ Finished {script_path}")

# Step 1: Seed present NOAA days
run_script("seed_present_forecast.py")

# Step 1.5: Ensure tomorrow+ entries exist (idempotent)
run_script("seed_future_forecast.py")

# Step 2: Save ML forecasts for the future days
run_script("save_ml_forecast_json.py")

# Step 3: Update MongoDB future forecasts
API_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "api"))
run_script("seed_mongo_future.py", cwd=API_DIR)

print("🎉 Daily forecast update completed.")
