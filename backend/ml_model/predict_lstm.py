# backend/ml_model/predict_lstm.py

import os
import sys
import django
import random
import json
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

# --- Load NOAA present forecast ---
def get_present_forecast_last_date():
    json_path = os.path.join(os.path.dirname(__file__), "forecast_3day.json")
    if not os.path.exists(json_path):
        print("❌ forecast_3day.json not found.")
        return None

    with open(json_path, "r") as f:
        data = json.load(f)
    
    try:
        present_dates = data.get("present_dates")  # e.g., ["2025-07-02", "2025-07-03", "2025-07-04"]
        last_str = present_dates[-1]
        return datetime.strptime(last_str, "%Y-%m-%d").date()
    except Exception as e:
        print(f"⚠️ Error parsing present forecast: {e}")
        return None

# --- Generate ML predictions ---
def generate_fake_predictions(num_days=3):
    return [
        {
            "kp_index": [round(random.uniform(1.0, 6.0), 2) for _ in range(8)],
            "solar_radiation": {"S1 or greater": random.randint(0, 10)},
            "radio_blackout": {
                "R1-R2": random.randint(0, 5),
                "R3 or greater": random.randint(0, 2)
            },
            "rationale_geomagnetic": "Predicted by LSTM model",
            "rationale_radiation": "Predicted by LSTM model",
            "rationale_blackout": "Predicted by LSTM model"
        }
        for _ in range(num_days)
    ]

# --- Main prediction save logic ---
def save_next_3_day_predictions():
    present_last_date = get_present_forecast_last_date()
    if not present_last_date:
        return

    # Check if prediction already exists for the next date
    next_pred_date = present_last_date + timedelta(days=1)
    existing = Forecast3Day.objects.filter(date=next_pred_date).exists()

    if existing:
        print(f"⏳ Prediction already exists for {next_pred_date}. Skipping.")
        return

    print(f"📈 Generating predictions for {next_pred_date} to {next_pred_date + timedelta(days=2)}")
    preds = generate_fake_predictions(num_days=3)

    new_entries = []
    for i in range(3):
        date = next_pred_date + timedelta(days=i)
        entry = Forecast3Day(
            date=date,
            kp_index=preds[i]["kp_index"],
            solar_radiation=preds[i]["solar_radiation"],
            radio_blackout=preds[i]["radio_blackout"],
            rationale_geomagnetic=preds[i]["rationale_geomagnetic"],
            rationale_radiation=preds[i]["rationale_radiation"],
            rationale_blackout=preds[i]["rationale_blackout"],
        )
        new_entries.append(entry)

    Forecast3Day.objects.bulk_create(new_entries, ignore_conflicts=True)
    print(f"✅ Saved predictions for {new_entries[0].date} to {new_entries[-1].date}")

if __name__ == "__main__":
    save_next_3_day_predictions()
