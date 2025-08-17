import subprocess
import sys

print("🚀 Running daily forecast update...")

python_exec = sys.executable  # this will use your current venv's Python

# Step 1: Seed present forecast (NOAA)
subprocess.run([python_exec, "ml_model/seed_present_forecast.py"])

# Step 2: Save ML forecast
subprocess.run([python_exec, "ml_model/save_ml_forecast_json.py"])

print("✅ All done.")
