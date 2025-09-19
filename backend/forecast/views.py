# backend/forecast/views.py
from rest_framework import viewsets
from rest_framework.response import Response
from datetime import date, datetime, timedelta
from .models import Forecast3Day
from .serializers import Forecast3DaySerializer

class Forecast3DayViewSet(viewsets.ViewSet):
    """
    Return only the next 3 future days, normalized.
    """

    def list(self, request):
        today = datetime.utcnow().date()

        # Query for all records on/after tomorrow (safer) and order by date
        start = today + timedelta(days=1)
        qs = Forecast3Day.objects.filter(date__gte=start).order_by("date")

        cleaned = []
        seen = set()
        for f in qs:
            try:
                d = f.date if isinstance(f.date, date) else datetime.fromisoformat(str(f.date)).date()
            except Exception:
                continue
            sdate = d.isoformat()
            if sdate in seen:
                continue
            seen.add(sdate)

            # Normalize kp_index (list -> max, int -> itself)
            kp = None
            if isinstance(f.kp_index, list) and f.kp_index:
                try:
                    kp = max([float(x) for x in f.kp_index if x is not None])
                except Exception:
                    kp = None
            elif isinstance(f.kp_index, (int, float)):
                kp = f.kp_index

            # ap index
            ap = getattr(f, "a_index", None)

            # solar_radiation normalization
            solar_val = None
            if isinstance(f.solar_radiation, dict) and f.solar_radiation:
                solar_val = list(f.solar_radiation.values())[0]
            elif isinstance(f.solar_radiation, list) and f.solar_radiation:
                solar_val = f.solar_radiation[0]
            else:
                solar_val = getattr(f, "radio_flux", None)

            blackout = f.radio_blackout or {}

            cleaned.append({
                "date": sdate,
                "kp_index": kp,
                "a_index": ap,
                "solar_radiation": solar_val,
                "radio_blackout": blackout,
            })

            if len(cleaned) >= 3:
                break

        return Response({"data": cleaned})
