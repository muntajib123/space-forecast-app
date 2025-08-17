from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Forecast3Day
from .formatter import generate_forecast_text

class Forecast3DaySummaryView(APIView):
    def get(self, request):
        forecasts = Forecast3Day.objects.all().order_by('-date')[:3]
        if forecasts.count() < 3:
            return Response({"error": "Less than 3 forecast entries available."}, status=status.HTTP_400_BAD_REQUEST)
        
        forecasts = list(forecasts)[::-1]  # Oldest to newest
        formatted_text = generate_forecast_text(forecasts)
        return Response({"summary": formatted_text})
