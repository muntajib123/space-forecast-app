# backend/ml_model/seed_present_forecast.py
import os
import sys
import django
from datetime import datetime
from typing import Optional

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

def _parse_date(s: str) -> Optional[datetime.date]:
    """Parse YYYY-MM-DD date string to a date object, return None on failure."""
    try:
        return datetime.strptime(str(s), "%Y-%m-%d").date()
    except Exception as e:
        print(f"⚠️ Invalid date '{s}': {e}")
        return None

# NOAA present_data example (Jul 2–4)
present_data = [
    {
        "date": "2025-07-02",
        "kp_index": [1.33, 1.67, 2.33, 2.67, 3.0, 3.0, 3.67, 4.67],
        "solar_radiation": [5],
        "radio_blackout": {"R1-R2": 20, "R3 or greater": 5},
        "rationale_geomagnetic": "NOAA G1 storm levels possible",
        "rationale_radiation": "Low chance of solar radiation storms",
        "rationale_blackout": "Slight chance due to M-class flares"
    },
    {
        "date": "2025-07-03",
        "kp_index": [4.67, 4.33, 3.33, 2.67, 2.33, 2.67, 3.0, 3.67],
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 15, "R3 or greater": 1},
        "rationale_geomagnetic": "Lingering CME effects",
        "rationale_radiation": "No major events expected",
        "rationale_blackout": "Minor risk remains"
    },
    {
        "date": "2025-07-04",
        "kp_index": [2.67, 4.0, 3.0, 2.67, 1.67, 1.67, 2.0, 2.67],
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 15, "R3 or greater": 1},
        "rationale_geomagnetic": "Conditions returning to normal",
        "rationale_radiation": "Stable activity forecasted",
        "rationale_blackout": "Minor blackouts unlikely"
    },
]

def seed_present_forecast(data_list):
    saved = 0
    for entry in data_list:
        raw_date = entry.get("date")
        if not raw_date:
            print(f"⚠️ Skipping entry without 'date': {entry}")
            continue

        date_obj = _parse_date(raw_date)
        if not date_obj:
            print(f"⚠️ Skipping entry with invalid date: {entry}")
            continue

        # Build defaults dict safely (use get with fallback)
        defaults = {
            "kp_index": entry.get("kp_index"),
            "solar_radiation": entry.get("solar_radiation"),
            "radio_blackout": entry.get("radio_blackout"),
            "rationale_geomagnetic": entry.get("rationale_geomagnetic"),
            "rationale_radiation": entry.get("rationale_radiation"),
            "rationale_blackout": entry.get("rationale_blackout"),
        }

        try:
            obj, created = Forecast3Day.objects.update_or_create(
                date=date_obj,
                defaults=defaults
            )
            action = "Created" if created else "Updated"
            print(f"✅ {action} forecast for {date_obj.isoformat()}")
            saved += 1
        except Exception as e:
            print(f"❌ Error saving forecast for {date_obj.isoformat()}: {e}")

    print(f"ℹ️ Seed complete. Processed {len(data_list)} entries, saved/updated {saved} entries.")

if __name__ == "__main__":
    seed_present_forecast(present_data)
