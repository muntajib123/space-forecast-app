# backend/api/views.py
from django.http import JsonResponse
from forecast.models import Forecast3Day  # adjust if your model name differs

def health(request):
    """
    Health check endpoint
    """
    return JsonResponse({"status": "ok"})

def forecast_3day(request):
    """
    Return all 3-day forecast records as JSON.
    """
    try:
        data = list(Forecast3Day.objects.all().values())
        return JsonResponse({"forecast": data}, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
