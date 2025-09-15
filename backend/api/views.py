# backend/api/views.py
from django.http import JsonResponse
from forecast.models import Forecast3Day  # adjust this if your model has a different name

def health(request):
    return JsonResponse({"status": "ok"})

def forecast_3day(request):
    """
    Return all 3-day forecast records as JSON.
    """
    data = list(Forecast3Day.objects.all().values())
    return JsonResponse(data, safe=False)
