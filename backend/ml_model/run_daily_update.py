import subprocess

print("🚀 Running daily forecast update...")

# Step 1: Seed the latest present forecast (Jul 2–4)
subprocess.run(["python", "ml_model/seed_present_forecast.py"])

# Step 2: Save ML forecasts for next 3 days (Jul 5–7)
subprocess.run(["python", "ml_model/save_ml_forecast_json.py"])

print("✅ Daily forecast update completed.")
