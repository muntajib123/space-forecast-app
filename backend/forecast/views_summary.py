# backend/forecast/views_summary.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone

from .models import Forecast3Day
from .formatter import generate_forecast_text


class Forecast3DaySummaryView(APIView):
    """
    Returns a human-readable text summary of the next 3 forecast days.
    - Ensures only future forecasts (strictly after today).
    - Falls back to the latest 3 records if not enough future ones exist.
    """

    def _to_date(self, val):
        """Normalize model `date` field to a date object or None."""
        if val is None:
            return None
        if isinstance(val, datetime):
            try:
                return val.astimezone(dt_timezone.utc).date()
            except Exception:
                return val.date()
        if hasattr(val, "isoformat"):  # already a date
            return val
        try:
            return datetime.fromisoformat(str(val)).date()
        except Exception:
            return None

    def get(self, request):
        today = timezone.now().date()

        # First try: strictly future forecasts
        future_qs = Forecast3Day.objects.filter(date__gt=today).order_by("date")
        if future_qs.count() >= 3:
            forecasts = list(future_qs[:3])

        else:
            # Fallback: just take the latest 3 records overall
            fallback_qs = Forecast3Day.objects.all().order_by("-date")[:3]
            forecasts = list(fallback_qs)[::-1]  # oldest → newest

        if len(forecasts) < 3:
            return Response(
                {"error": "Less than 3 forecast entries available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Format summary text
        formatted_text = generate_forecast_text(forecasts)
        return Response({"summary": formatted_text})
