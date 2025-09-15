from django.http import JsonResponse
from forecast.models import Forecast3Day
import traceback

def forecast_3day(request):
    try:
        data = list(Forecast3Day.objects.all().values())
        return JsonResponse({"count": len(data), "data": data}, safe=False)
    except Exception as e:
        # Log the full error
        error_message = f"{str(e)}\n{traceback.format_exc()}"
        print("❌ Error in forecast_3day:", error_message)
        return JsonResponse({"error": error_message})
