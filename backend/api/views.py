# backend/api/views.py
import logging
from django.http import JsonResponse
from forecast.models import Forecast3Day

logger = logging.getLogger(__name__)

def health(request):
    return JsonResponse({"status": "ok"})

def forecast_3day(request):
    """
    Return all 3-day forecast records as JSON.
    If an error occurs, log the traceback and return the exception message.
    """
    try:
        qs = Forecast3Day.objects.all()
        data = list(qs.values())
        return JsonResponse({"count": len(data), "data": data}, safe=False)
    except Exception as e:
        # Log full traceback so Render logs show details
        logger.exception("Error fetching 3-day forecast")
        return JsonResponse({"error": str(e)}, status=500)
