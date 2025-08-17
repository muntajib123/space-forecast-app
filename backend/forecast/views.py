# backend/forecast/views.py

from rest_framework import viewsets
from .models import Forecast3Day
from .serializers import Forecast3DaySerializer

class Forecast3DayViewSet(viewsets.ModelViewSet):
    queryset = Forecast3Day.objects.all().order_by('date')
    serializer_class = Forecast3DaySerializer
