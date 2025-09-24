# backend/forecast/views.py
from rest_framework import viewsets
from rest_framework.response import Response
from datetime import date, datetime, timedelta, timezone as dt_timezone
from django.utils import timezone as dj_timezone
import logging

from .models import Forecast3Day
from .serializers import Forecast3DaySerializer

logger = logging.getLogger(__name__)


class Forecast3DayViewSet(viewsets.ViewSet):
    """
    Return only the next 3 future days, normalized. Robust to datetimes/strings/timezones.
    """

    def list(self, request):
        # Use Django timezone (aware) and convert to UTC date boundary
        now = dj_timezone.now()
        try:
            now_utc = now.astimezone(dt_timezone.utc)
        except Exception:
            now_utc = now
        today_utc = now_utc.date()

        # Fetch all items ordered by date (DB-side ordering). We'll filter in-Python.
        qs = Forecast3Day.objects.all().order_by("date")

        logger.debug("Forecast3Day: total records fetched=%d", qs.count())

        def to_date_obj(val):
            """Normalize model `date` field to a date object or None."""
            if val is None:
                return None
            # If it's already a date (but not datetime)
            if isinstance(val, date) and not isinstance(val, datetime):
                return val
            # If datetime, convert to UTC date
            if isinstance(val, datetime):
                try:
                    return val.astimezone(dt_timezone.utc).date()
                except Exception:
                    return val.date()
            # Try parse ISO strings (YYYY-MM-DD or ISO datetime)
            try:
                return date.fromisoformat(str(val))
            except Exception:
                try:
                    return datetime.fromisoformat(str(val)).date()
                except Exception:
                    return None

        cleaned = []
        seen = set()

        # iterate ordered queryset and pick dates strictly after today_utc
        for f in qs:
            d_obj = to_date_obj(f.date)
            if not d_obj:
                continue

            # only future dates (strictly after today)
            if not (d_obj > today_utc):
                continue

            sdate = d_obj.isoformat()
            if sdate in seen:
                continue
            seen.add(sdate)

            # Normalize kp_index (list -> max, numeric -> itself)
            kp = None
            try:
                if isinstance(f.kp_index, list) and f.kp_index:
                    kp_candidates = []
                    for x in f.kp_index:
                        try:
                            kp_candidates.append(float(x))
                        except Exception:
                            pass
                    if kp_candidates:
                        kp = max(kp_candidates)
                elif isinstance(f.kp_index, (int, float)):
                    kp = float(f.kp_index)
            except Exception:
                kp = None

            # ap index
            ap = getattr(f, "a_index", None)

            # solar_radiation normalization
            solar_val = None
            try:
                if isinstance(f.solar_radiation, dict) and f.solar_radiation:
                    solar_val = list(f.solar_radiation.values())[0]
                elif isinstance(f.solar_radiation, list) and f.solar_radiation:
                    solar_val = f.solar_radiation[0]
                else:
                    solar_val = getattr(f, "radio_flux", None)
            except Exception:
                solar_val = None

            blackout = f.radio_blackout or {}

            cleaned.append(
                {
                    "date": sdate,
                    "kp_index": kp,
                    "a_index": ap,
                    "solar_radiation": solar_val,
                    "radio_blackout": blackout,
                }
            )

            if len(cleaned) >= 3:
                break

        # Fallback: if we didn't find 3 future items, include earliest available (keeps behavior safe)
        if len(cleaned) < 3:
            logger.debug("Not enough future items; falling back to earliest available records")
            seen = set()
            cleaned = []
            for f in Forecast3Day.objects.all().order_by("date"):
                d_obj = to_date_obj(f.date)
                if not d_obj:
                    continue
                sdate = d_obj.isoformat()
                if sdate in seen:
                    continue
                seen.add(sdate)

                # Normalize kp_index (list -> max, numeric -> itself)
                kp = None
                try:
                    if isinstance(f.kp_index, list) and f.kp_index:
                        kp_candidates = []
                        for x in f.kp_index:
                            try:
                                kp_candidates.append(float(x))
                            except Exception:
                                pass
                        if kp_candidates:
                            kp = max(kp_candidates)
                    elif isinstance(f.kp_index, (int, float)):
                        kp = float(f.kp_index)
                except Exception:
                    kp = None

                ap = getattr(f, "a_index", None)

                solar_val = None
                try:
                    if isinstance(f.solar_radiation, dict) and f.solar_radiation:
                        solar_val = list(f.solar_radiation.values())[0]
                    elif isinstance(f.solar_radiation, list) and f.solar_radiation:
                        solar_val = f.solar_radiation[0]
                    else:
                        solar_val = getattr(f, "radio_flux", None)
                except Exception:
                    solar_val = None

                blackout = f.radio_blackout or {}

                cleaned.append(
                    {
                        "date": sdate,
                        "kp_index": kp,
                        "a_index": ap,
                        "solar_radiation": solar_val,
                        "radio_blackout": blackout,
                    }
                )

                if len(cleaned) >= 3:
                    break

        logger.debug("Returning cleaned dates: %s", [c["date"] for c in cleaned])
        return Response({"data": cleaned})
