# backend/ml_model/save_ml_forecast_json.py
import os
import sys
import json
import django
from datetime import datetime, timedelta
from typing import Optional, List

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

# Paths
BASE_DIR = os.path.dirname(__file__)
JSON_FILE_PATH = os.path.join(BASE_DIR, "ml_forecast.json")
NOAA_JSON_PATH = os.path.join(BASE_DIR, "forecast_3day.json")


def load_ml_forecast() -> Optional[List[dict]]:
    """Load ML forecast data from ml_forecast.json"""
    if not os.path.exists(JSON_FILE_PATH):
        print(f"❌ {JSON_FILE_PATH} not found.")
        return None
    try:
        with open(JSON_FILE_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error reading {JSON_FILE_PATH}: {e}")
        return None


def _parse_date_str(s: str) -> Optional[datetime.date]:
    """Try parse a YYYY-MM-DD string into a date, return None on failure."""
    try:
        return datetime.strptime(str(s), "%Y-%m-%d").date()
    except Exception:
        return None


def get_latest_noaa_date_from_json() -> Optional[datetime.date]:
    """
    Read forecast_3day.json -> present_dates and return the latest parsed date.
    This is preferred because it represents NOAA's present forecast end.
    """
    if not os.path.exists(NOAA_JSON_PATH):
        print(f"⚠️ {NOAA_JSON_PATH} not found. Will attempt to fallback to DB.")
        return None

    try:
        with open(NOAA_JSON_PATH, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading {NOAA_JSON_PATH}: {e}")
        return None

    present_dates = data.get("present_dates")
    if not present_dates or not isinstance(present_dates, list):
        print("⚠️ 'present_dates' missing or malformed in forecast_3day.json")
        return None

    parsed = []
    for s in present_dates:
        d = _parse_date_str(s)
        if d:
            parsed.append(d)
        else:
            print(f"⚠️ Skipping invalid present date in NOAA JSON: {s}")

    if not parsed:
        print("⚠️ No valid present dates found in NOAA JSON.")
        return None

    last = max(parsed)
    print(f"ℹ️ Latest NOAA present date (from JSON) = {last.isoformat()}")
    return last


def get_latest_present_forecast_date_from_db() -> Optional[datetime.date]:
    """
    Fallback: return the latest date currently in Forecast3Day DB table.
    WARNING: If DB already contains ML-generated predictions, this value might
    reflect them (not NOAA). Prefer the NOAA JSON when available.
    """
    latest_entry = Forecast3Day.objects.order_by("-date").first()
    if latest_entry:
        print(f"ℹ️ Latest date in DB = {latest_entry.date.isoformat()}")
        return latest_entry.date
    else:
        print("⚠️ No entries found in Forecast3Day DB.")
        return None


def save_future_forecast():
    """
    Save ML predictions for days (noaa_last + 1) .. (noaa_last + 3).
    Uses NOAA JSON to determine noaa_last. Falls back to DB if needed.
    """
    ml_data = load_ml_forecast()
    if not ml_data:
        print("❌ No forecast data in ml_forecast.json.")
        return

    # Prefer NOAA JSON to determine the present latest date
    latest_present_date = get_latest_noaa_date_from_json()
    if latest_present_date is None:
        # Fallback to DB (useful if NOAA JSON missing)
        latest_present_date = get_latest_present_forecast_date_from_db()
        if latest_present_date is None:
            print("❌ Could not determine latest present date (neither NOAA JSON nor DB). Aborting.")
            return
        else:
            print("⚠️ Using DB latest date as baseline (fallback).")

    print(f"📅 Latest present date baseline: {latest_present_date.isoformat()}")

    # Save only ML-predictions for (latest + 1), (latest + 2), (latest + 3)
    target_dates = [(latest_present_date + timedelta(days=i)).isoformat() for i in range(1, 4)]
    target_dates_dt = [(latest_present_date + timedelta(days=i)) for i in range(1, 4)]
    print(f"💾 Attempting to save ML forecast for: {target_dates}")

    saved_count = 0

    # ml_data might be a list of entries with "date" field; robustly iterate
    for entry in ml_data:
        # expect entry["date"] as YYYY-MM-DD
        entry_date_str = entry.get("date")
        entry_date = _parse_date_str(entry_date_str)
        if not entry_date:
            print(f"⚠️ Skipping ML entry with invalid/missing date: {entry}")
            continue

        # only process if entry_date is one of the desired target dates
        if entry_date not in target_dates_dt:
            # not in the three targets -> skip
            continue

        if Forecast3Day.objects.filter(date=entry_date).exists():
            print(f"⏭️ Forecast for {entry_date.isoformat()} already exists. Skipping.")
            continue

        # Build and save model instance
        try:
            f = Forecast3Day(
                date=entry_date,
                kp_index=entry.get("kp_index"),
                solar_radiation=entry.get("solar_radiation"),
                radio_blackout=entry.get("radio_blackout"),
                rationale_geomagnetic=entry.get("rationale_geomagnetic"),
                rationale_radiation=entry.get("rationale_radiation"),
                rationale_blackout=entry.get("rationale_blackout"),
            )
            f.save()
            print(f"✅ Saved forecast for {entry_date.isoformat()}")
            saved_count += 1
        except Exception as e:
            print(f"❌ Error saving forecast for {entry_date.isoformat()}: {e}")

    if saved_count == 0:
        print("ℹ️ No new forecasts saved (either none matched target dates, or all existed).")
    else:
        print(f"✅ Total new forecasts saved: {saved_count}")


if __name__ == "__main__":
    save_future_forecast()
