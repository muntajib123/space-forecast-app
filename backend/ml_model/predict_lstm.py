# backend/ml_model/predict_lstm.py
import os
import sys
import django
import random
import json
from datetime import datetime, timedelta
from typing import List, Optional

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

BASE_DIR = os.path.dirname(__file__)
NOAA_JSON = os.path.join(BASE_DIR, "forecast_3day.json")


def _parse_date_str(s: str) -> Optional[datetime.date]:
    """Parse a YYYY-MM-DD-like string to a date, return None on failure."""
    try:
        return datetime.strptime(str(s), "%Y-%m-%d").date()
    except Exception:
        return None


def get_noaa_latest_date_from_json() -> Optional[datetime.date]:
    """
    Return the latest present date from forecast_3day.json.
    Accepts multiple JSON shapes:
      - {"present_dates": ["YYYY-MM-DD", ...]}
      - ["YYYY-MM-DD", ...]
      - [{"date":"YYYY-MM-DD", ...}, ...]
    """
    if not os.path.exists(NOAA_JSON):
        print(f"⚠️ NOAA JSON not found at {NOAA_JSON}")
        return None

    try:
        with open(NOAA_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading NOAA JSON: {e}")
        return None

    candidates: List[datetime.date] = []

    # Case A: dict with 'present_dates' key
    if isinstance(data, dict) and "present_dates" in data and isinstance(data["present_dates"], list):
        for s in data["present_dates"]:
            d = _parse_date_str(s)
            if d:
                candidates.append(d)
            else:
                print(f"⚠️ Skipping unparseable present_dates entry: {s}")

    # Case B: top-level list of date strings
    elif isinstance(data, list) and all(isinstance(x, str) for x in data):
        for s in data:
            d = _parse_date_str(s)
            if d:
                candidates.append(d)
            else:
                print(f"⚠️ Skipping unparseable date string in NOAA JSON list: {s}")

    # Case C: top-level list of objects, each possibly with 'date' field
    elif isinstance(data, list) and any(isinstance(x, dict) for x in data):
        for item in data:
            if isinstance(item, dict) and "date" in item:
                d = _parse_date_str(item.get("date"))
                if d:
                    candidates.append(d)
                else:
                    print(f"⚠️ Skipping unparseable 'date' in NOAA JSON item: {item.get('date')}")
            else:
                # ignore items without 'date' but log
                print(f"⚠️ Ignoring item without 'date' field in NOAA JSON: {item}")

    else:
        print("⚠️ NOAA JSON has an unexpected shape. Expected dict with 'present_dates' or a list.")

    if not candidates:
        print("⚠️ No valid dates found in NOAA JSON after parsing.")
        return None

    last = max(candidates)
    print(f"ℹ️ NOAA JSON max present date: {last.isoformat()}")
    return last


def get_db_latest_date() -> Optional[datetime.date]:
    """Return latest date in Forecast3Day table or None."""
    latest = Forecast3Day.objects.order_by("-date").first()
    if latest:
        print(f"ℹ️ Latest date in DB: {latest.date.isoformat()}")
        return latest.date
    else:
        print("ℹ️ No entries in DB.")
        return None


def determine_baseline_date() -> Optional[datetime.date]:
    """
    Prefer NOAA JSON latest present date as the baseline when available.
    Fall back to DB latest date only if NOAA JSON is missing or contains no valid dates.
    """
    noaa_date = get_noaa_latest_date_from_json()
    if noaa_date:
        print(f"ℹ️ Using NOAA JSON date as baseline: {noaa_date.isoformat()}")
        return noaa_date

    print("⚠️ NOAA JSON missing/invalid — attempting to use DB latest date as fallback.")
    db_date = get_db_latest_date()
    if db_date:
        print(f"⚠️ Using DB date as baseline (fallback): {db_date.isoformat()}")
        return db_date

    print("❌ Could not determine baseline present date (no NOAA JSON and DB empty).")
    return None


def generate_fake_predictions(num_days: int = 3) -> List[dict]:
    """Return fake/random predictions for testing. Replace with real LSTM later."""
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


def save_next_3_day_predictions(num_days: int = 3):
    """Main entry: determine baseline and save predictions for baseline+1 .. baseline+num_days."""
    baseline = determine_baseline_date()
    if not baseline:
        print("❌ Aborting: no baseline date to base predictions on.")
        return

    # Start predictions one day AFTER baseline
    first_pred_date = baseline + timedelta(days=1)
    last_pred_date = first_pred_date + timedelta(days=num_days - 1)
    print(f"📈 Will attempt to generate predictions for: {first_pred_date.isoformat()} to {last_pred_date.isoformat()}")

    # Defensive check: if DB already has the first_pred_date, skip to avoid overlap
    if Forecast3Day.objects.filter(date=first_pred_date).exists():
        print(f"⏳ DB already has forecast for {first_pred_date.isoformat()}. Aborting to avoid duplicate/overlap.")
        return

    preds = generate_fake_predictions(num_days=num_days)
    entries = []
    # <-- FIX: build dates as baseline + (i + 1) days to ensure predictions START the next day
    for i in range(num_days):
        d = baseline + timedelta(days=i+1)   # <-- explicit i+1 fix here
        p = preds[i]
        entry = Forecast3Day(
            date=d,
            kp_index=p.get("kp_index"),
            solar_radiation=p.get("solar_radiation"),
            radio_blackout=p.get("radio_blackout"),
            rationale_geomagnetic=p.get("rationale_geomagnetic"),
            rationale_radiation=p.get("rationale_radiation"),
            rationale_blackout=p.get("rationale_blackout"),
        )
        entries.append(entry)

    try:
        Forecast3Day.objects.bulk_create(entries, ignore_conflicts=True)
        print(f"✅ Saved predictions: {entries[0].date.isoformat()} to {entries[-1].date.isoformat()}")
    except Exception as e:
        print(f"❌ Error saving predictions: {e}")


if __name__ == "__main__":
    save_next_3_day_predictions()
