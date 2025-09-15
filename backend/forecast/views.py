# backend/forecast/views.py

from rest_framework import viewsets
from datetime import datetime, date, timedelta
import os, json
from .models import Forecast3Day
from .serializers import Forecast3DaySerializer

# Path to NOAA JSON
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
NOAA_JSON_PATH = os.path.join(BASE_DIR, "ml_model", "forecast_3day.json")


def get_noaa_last_date():
    """
    Read forecast_3day.json and return the latest present date.
    Supports both {"present_dates": [...]} and list of objects with "date".
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
        try:
            parsed.append(datetime.strptime(d, "%Y-%m-%d").date())
        except Exception:
            continue

    return max(parsed) if parsed else None


class Forecast3DayViewSet(viewsets.ModelViewSet):
    serializer_class = Forecast3DaySerializer

    def get_queryset(self):
        """
        Return the 3 forecast rows strictly AFTER NOAA's last present date.
        Fallback to tomorrow..+2 if NOAA JSON is missing.
        """
        noaa_last = get_noaa_last_date()
        if noaa_last:
            return Forecast3Day.objects.filter(date__gt=noaa_last).order_by("date")[:3]

        # Fallback if NOAA JSON missing
        start = date.today() + timedelta(days=1)
        end = start + timedelta(days=2)
        return Forecast3Day.objects.filter(date__range=(start, end)).order_by("date")
