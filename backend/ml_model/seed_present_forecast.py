# backend/ml_model/seed_future_forecast.py
import os
import sys
import django
from datetime import datetime, timedelta, timezone as dt_timezone

# Setup Django (same approach as your existing scripts)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from django.utils import timezone
from forecast.models import Forecast3Day

def to_date(d):
    """Return a date object from datetime/date/string; None on failure."""
    if d is None:
        return None
    if hasattr(d, "date") and not isinstance(d, str):
        # datetime or date
        try:
            return d.date() if hasattr(d, "date") and not isinstance(d, d.__class__) else d
        except Exception:
            pass
    # try parsing ISO date string
    try:
        return datetime.fromisoformat(str(d)).date()
    except Exception:
        try:
            return datetime.strptime(str(d), "%Y-%m-%d").date()
        except Exception:
            return None

def generate_placeholder_for(date_obj):
    """Return a simple placeholder forecast dict for the given date.
       Replace this with your ML call when ready."""
    # Example simple heuristic: small kp values that increase slightly each day
    base_kp = 3.0
    day_offset = (date_obj - datetime.utcnow().date()).days
    kp_list = [round(base_kp + (day_offset * 0.2) + i * 0.1, 2) for i in range(8)]

    return {
        "date": date_obj,
        "kp_index": kp_list,
        "a_index": None,
        "solar_radiation": [1],          # placeholder %
        "radio_blackout": {"R1-R2": 0, "R3 or greater": 0},
        "rationale_geomagnetic": "Auto-seeded placeholder",
        "rationale_radiation": "Auto-seeded placeholder",
        "rationale_blackout": "Auto-seeded placeholder",
    }

def seed_future(n_days=3):
    # Use UTC now and start at tomorrow (UTC)
    now = timezone.now()
    try:
        now_utc = now.astimezone(dt_timezone.utc)
    except Exception:
        now_utc = now
    start = (now_utc + timedelta(days=1)).date()

    created = 0
    updated = 0

    for i in range(n_days):
        target = start + timedelta(days=i)
        payload = generate_placeholder_for(target)

        # Normalize date
        payload_date = to_date(payload.get("date") or target)
        if payload_date is None:
            print(f"Skipping invalid date for payload: {payload}")
            continue

        defaults = {
            "kp_index": payload.get("kp_index"),
            "solar_radiation": payload.get("solar_radiation"),
            "radio_blackout": payload.get("radio_blackout"),
            "rationale_geomagnetic": payload.get("rationale_geomagnetic"),
            "rationale_radiation": payload.get("rationale_radiation"),
            "rationale_blackout": payload.get("rationale_blackout"),
            "a_index": payload.get("a_index"),
        }

        obj, created_flag = Forecast3Day.objects.update_or_create(date=payload_date, defaults=defaults)
        if created_flag:
            created += 1
            print(f"Created forecast for {payload_date.isoformat()}")
        else:
            updated += 1
            print(f"Updated forecast for {payload_date.isoformat()}")

    print(f"Seed complete — created: {created}, updated: {updated}")

if __name__ == "__main__":
    seed_future(n_days=3)  # change to 7 if you want a larger buffer
