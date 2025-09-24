# backend/ml_model/seed_future_forecast.py
import os
import sys
import django
from datetime import datetime, date, timedelta
import logging
from dateutil import parser

# Setup Django environment (assumes this file is in backend/ml_model/)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("seed_future_forecast")


def to_date_obj(d):
    """
    Normalize a value to a datetime.date or return None.
    Accepts datetime, date or ISO-like strings.
    """
    if d is None:
        return None
    if isinstance(d, date) and not isinstance(d, datetime):
        return d
    if isinstance(d, datetime):
        return d.date()
    try:
        parsed = parser.parse(str(d))
        return parsed.date()
    except Exception:
        return None


def safe_float_list(lst, fallback=0.0):
    out = []
    for v in lst or []:
        try:
            f = float(v)
            # guard NaN
            if f != f:
                out.append(fallback)
            else:
                out.append(round(f, 2))
        except Exception:
            out.append(fallback)
    return out


def generate_placeholder_for(date_obj):
    """
    Generate a simple placeholder forecast payload for a given python.date.
    Replace with ML model outputs when available.
    """
    base = 3.0
    offset = (date_obj - datetime.utcnow().date()).days
    kp_list = [round(base + (offset * 0.15) + i * 0.1, 2) for i in range(8)]
    radio_flux_val = round(70.0 + offset * 0.5, 2)

    return {
        "date": date_obj,
        "kp_index": kp_list,
        "a_index": int(max(0, 4 + offset)),
        "radio_flux": radio_flux_val,
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 0, "R3 or greater": 0},
        "rationale_geomagnetic": "Auto-seeded future placeholder",
        "rationale_radiation": "Auto-seeded future placeholder",
        "rationale_blackout": "Auto-seeded future placeholder",
    }


def get_latest_noaa_date():
    """
    Return the most recent NOAA-related Forecast3Day.date (as a date object).
    Preference: rationale_geomagnetic contains 'noaa' (case-insensitive).
    Falls back to the latest record if no explicit NOAA rationale found.
    """
    try:
        noaa_doc = (
            Forecast3Day.objects.filter(rationale_geomagnetic__icontains="noaa")
            .order_by("-date")
            .first()
        )
        if noaa_doc:
            return to_date_obj(noaa_doc.date)
        latest = Forecast3Day.objects.order_by("-date").first()
        return to_date_obj(latest.date) if latest else None
    except Exception:
        log.exception("Error querying DB for latest NOAA date")
        return None


def seed_future(n_days=3):
    """
    Seed n_days forecasts starting after NOAA's 3-day product.
    NOAA product convention: 'latest_noaa' is the NOAA product START date and covers
    latest_noaa .. latest_noaa + 2 (3 days). We therefore seed starting from
    latest_noaa + 3 so seeded days are the next 3 days after NOAA's product.
    Example:
      if latest_noaa == 2025-09-24 (NOAA covers 24-26) -> seed 27,28,29
    """
    latest_noaa = get_latest_noaa_date()
    if not latest_noaa:
        log.error("[seed] No NOAA baseline found. Aborting.")
        return {"created": 0, "updated": 0}

    # Seed starting from day after NOAA's 3-day block (i.e., start = latest_noaa + 3)
    start_date = latest_noaa + timedelta(days=3)
    log.info(f"[seed] NOAA baseline start: {latest_noaa}; seeding from {start_date}")

    created, updated = 0, 0
    model_field_names = {f.name for f in Forecast3Day._meta.get_fields()}

    for i in range(n_days):
        target = start_date + timedelta(days=i)
        payload = generate_placeholder_for(target)

        # Normalize fields
        payload["kp_index"] = safe_float_list(payload.get("kp_index"), 0.0)
        try:
            payload["a_index"] = int(payload.get("a_index", 0) or 0)
        except Exception:
            payload["a_index"] = 0
        try:
            payload["radio_flux"] = float(payload.get("radio_flux", 0.0) or 0.0)
        except Exception:
            payload["radio_flux"] = 0.0

        payload_date = to_date_obj(payload["date"])
        if not payload_date:
            log.error(f"[seed] Invalid date {payload['date']}, skipping.")
            continue
        payload["date"] = payload_date

        defaults = {k: v for k, v in payload.items() if k != "date" and k in model_field_names}
        if not defaults:
            log.warning(f"[seed] No valid fields to upsert for {payload_date}, skipping.")
            continue

        try:
            obj, created_flag = Forecast3Day.objects.update_or_create(date=payload_date, defaults=defaults)
            if created_flag:
                created += 1
                log.info(f"[seed] created {payload_date}")
            else:
                updated += 1
                log.info(f"[seed] updated {payload_date}")
        except Exception:
            log.exception(f"[seed] DB upsert failed for {payload_date}")

    log.info(f"[seed] done — created: {created}, updated: {updated}")
    return {"created": created, "updated": updated}


if __name__ == "__main__":
    seed_future(n_days=3)
