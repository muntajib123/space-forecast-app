# backend/forecast/views.py
from rest_framework import viewsets
from rest_framework.response import Response
from datetime import datetime, date, timedelta
import os, json
from .models import Forecast3Day

# Path to NOAA JSON (keeps original pattern you used)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
NOAA_JSON_PATH = os.path.join(BASE_DIR, "ml_model", "forecast_3day.json")


def get_noaa_last_date():
    """
    Read forecast_3day.json and return the latest present date if available.
    Accepts either {"present_dates": [...]} or list-of-objects-with-date.
    Returns a datetime.date or None.
    """
    if not os.path.exists(NOAA_JSON_PATH):
        return None

    try:
        with open(NOAA_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None

    # Case A: dict with present_dates
    if isinstance(data, dict) and "present_dates" in data:
        dates = data["present_dates"]
    # Case B: list of objects with date
    elif isinstance(data, list) and any(isinstance(x, dict) for x in data):
        dates = [item.get("date") for item in data if isinstance(item, dict) and "date" in item]
    else:
        return None

    parsed = []
    for d in dates:
        if not d:
            continue
        # Accept "YYYY-MM-DD" or full ISO
        try:
            parsed_date = datetime.fromisoformat(d).date()
        except Exception:
            try:
                parsed_date = datetime.strptime(d, "%Y-%m-%d").date()
            except Exception:
                continue
        parsed.append(parsed_date)

    return max(parsed) if parsed else None


class Forecast3DayViewSet(viewsets.ViewSet):
    """
    Return a cleaned / normalized 3-day forecast.
    Always returns the next 3 calendar days starting from tomorrow,
    preferring DB rows whose date >= tomorrow; dedupe and normalize.
    """

    def list(self, request):
        # Determine starting date: tomorrow (local date)
        start_date = date.today() + timedelta(days=1)

        # If NOAA JSON exists, optionally shift start_date to NOAA's last + 1
        noaa_last = get_noaa_last_date()
        if noaa_last and noaa_last >= start_date:
            start_date = noaa_last + timedelta(days=1)

        # Query DB for rows with date >= start_date, order ascending.
        qs = Forecast3Day.objects.filter(date__gte=start_date).order_by("date")

        cleaned = []
        seen = set()

        for f in qs:
            # ensure f.date is a date
            try:
                d = f.date if isinstance(f.date, date) else datetime.fromisoformat(str(f.date)).date()
            except Exception:
                continue

            iso = d.isoformat()
            if iso in seen:
                continue
            seen.add(iso)

            # Normalize kp_index -> kp_value (max of list or numeric)
            kp_raw = getattr(f, "kp_index", None)
            kp_val = None
            if isinstance(kp_raw, list) and kp_raw:
                try:
                    kp_val = max(float(x) for x in kp_raw if x is not None)
                except Exception:
                    kp_val = None
            elif isinstance(kp_raw, (int, float)):
                kp_val = kp_raw

            # Ap: prefer stored a_index field if present
            ap_val = getattr(f, "a_index", None)

            # Solar radiation: extract numeric summary from dict/list/float
            solar_raw = getattr(f, "solar_radiation", None)
            if isinstance(solar_raw, dict) and solar_raw:
                # take first value (e.g., {"S1 or greater": 10})
                solar_val = list(solar_raw.values())[0]
            elif isinstance(solar_raw, list) and solar_raw:
                solar_val = solar_raw[0]
            else:
                solar_val = getattr(f, "radio_flux", None)

            # Radio blackout: ensure dict
            blackout = getattr(f, "radio_blackout", {}) or {}

            cleaned.append({
                "date": iso,
                "kp_index": kp_val,
                "a_index": ap_val,
                "solar_radiation": solar_val,
                "radio_blackout": blackout,
                "rationale_geomagnetic": getattr(f, "rationale_geomagnetic", "") or "",
                "rationale_radiation": getattr(f, "rationale_radiation", "") or "",
                "rationale_blackout": getattr(f, "rationale_blackout", "") or "",
            })

            if len(cleaned) >= 3:
                break

        # If DB did not provide 3 days, synthesize remaining calendar days using empty placeholders
        idx = 0
        while len(cleaned) < 3:
            target = (start_date + timedelta(days=idx)).isoformat()
            if not any(c["date"] == target for c in cleaned):
                cleaned.append({
                    "date": target,
                    "kp_index": None,
                    "a_index": None,
                    "solar_radiation": None,
                    "radio_blackout": {},
                    "rationale_geomagnetic": "",
                    "rationale_radiation": "",
                    "rationale_blackout": "",
                })
            idx += 1

        return Response({"data": cleaned})
