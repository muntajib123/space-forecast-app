# backend/forecast/views.py

from rest_framework import viewsets
from rest_framework.response import Response
from datetime import datetime, date, timedelta
import os, json
from .models import Forecast3Day
from .serializers import Forecast3DaySerializer

# Path to NOAA JSON
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
NOAA_JSON_PATH = os.path.join(BASE_DIR, "ml_model", "forecast_3day.json")


def get_noaa_last_date():
    """Read forecast_3day.json and return the latest present date."""
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
        try:
            parsed.append(datetime.strptime(d, "%Y-%m-%d").date())
        except Exception:
            continue

    return max(parsed) if parsed else None


class Forecast3DayViewSet(viewsets.ViewSet):
    """
    Custom ViewSet for cleaned 3-day forecast output.
    Ensures:
      - Deduplicated dates
      - Normalized Kp/Ap/Solar/Radio values
      - Only next 3 future rows returned
    """

    def list(self, request):
        noaa_last = get_noaa_last_date()

        if noaa_last:
            qs = Forecast3Day.objects.filter(date__gt=noaa_last).order_by("date")
        else:
            start = date.today() + timedelta(days=1)
            end = start + timedelta(days=2)
            qs = Forecast3Day.objects.filter(date__range=(start, end)).order_by("date")

        cleaned = []
        seen_dates = set()

        for f in qs:
            # Ensure valid date
            d = f.date if isinstance(f.date, date) else None
            if not d:
                try:
                    d = datetime.fromisoformat(str(f.date)).date()
                except Exception:
                    continue

            date_str = d.isoformat()
            if date_str in seen_dates:
                continue
            seen_dates.add(date_str)

            # Normalize Kp
            kp = f.kp_index
            if isinstance(kp, list) and kp:
                kp_val = max([float(x) for x in kp if x is not None])
            elif isinstance(kp, (int, float)):
                kp_val = kp
            else:
                kp_val = None

            # Ap Index (direct if exists, else None)
            ap_val = getattr(f, "a_index", None)

            # Normalize Solar
            solar = f.solar_radiation
            if isinstance(solar, dict) and solar:
                solar_val = list(solar.values())[0]
            elif isinstance(solar, list) and solar:
                solar_val = solar[0]
            else:
                solar_val = getattr(f, "radio_flux", None)

            # Radio blackout
            blackout = f.radio_blackout or {}

            cleaned.append({
                "date": date_str,
                "kp_index": kp_val,
                "a_index": ap_val,
                "solar_radiation": solar_val,
                "radio_blackout": blackout,
            })

        # ✅ Keep only the next 3 days (starting from tomorrow)
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)

        future = [
            c for c in cleaned
            if datetime.fromisoformat(c["date"]).date() >= tomorrow
        ]
        future = sorted(future, key=lambda x: x["date"])[:3]

        return Response({"data": future})
