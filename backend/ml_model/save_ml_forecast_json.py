# backend/ml_model/save_ml_forecast_json.py

import os
import sys
import json
import django
from datetime import datetime, timedelta

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

# Load ML-predicted forecast from JSON file
JSON_FILE_PATH = os.path.join(os.path.dirname(__file__), "ml_forecast.json")

def load_ml_forecast():
    with open(JSON_FILE_PATH, "r") as f:
        return json.load(f)

def get_latest_present_forecast_date():
    """Check latest date in existing NOAA forecast (e.g., July 2–4 → return July 4)."""
    latest_entry = Forecast3Day.objects.order_by("-date").first()
    return latest_entry.date if latest_entry else None

def save_future_forecast():
    ml_data = load_ml_forecast()
    if not ml_data:
        print("❌ No forecast data in JSON.")
        return

    latest_present_date = get_latest_present_forecast_date()
    if not latest_present_date:
        print("❌ No existing data in database.")
        return

    print(f"📅 Latest NOAA forecasted date in DB: {latest_present_date}")

    # Save only ML-predictions from (latest + 1), (latest + 2), (latest + 3)
    target_dates = [latest_present_date + timedelta(days=i) for i in range(1, 4)]
    print(f"💾 Trying to save ML forecast for: {target_dates}")

    saved_count = 0
    for entry in ml_data:
        entry_date = datetime.strptime(entry["date"], "%Y-%m-%d").date()

        if entry_date not in target_dates:
            continue

        if Forecast3Day.objects.filter(date=entry_date).exists():
            print(f"⏭️ Forecast for {entry_date} already exists. Skipping.")
            continue

        f = Forecast3Day(
            date=entry_date,
            kp_index=entry["kp_index"],
            solar_radiation=entry["solar_radiation"],
            radio_blackout=entry["radio_blackout"],
            rationale_geomagnetic=entry["rationale_geomagnetic"],
            rationale_radiation=entry["rationale_radiation"],
            rationale_blackout=entry["rationale_blackout"],
        )
        f.save()
        print(f"✅ Saved forecast for {entry_date}")
        saved_count += 1

    if saved_count == 0:
        print("ℹ️ No new forecasts saved.")
    else:
        print(f"✅ Total new forecasts saved: {saved_count}")

if __name__ == "__main__":
    save_future_forecast()
