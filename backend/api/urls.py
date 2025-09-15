# backend/api/urls.py
from django.urls import path
from .views import health, forecast_3day

urlpatterns = [
    path("health/", health, name="health"),
    path("3day/", forecast_3day, name="forecast-3day"),  # new endpoint
]
