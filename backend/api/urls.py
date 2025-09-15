# backend/api/urls.py
from django.urls import path
from .views import health, forecast_3day

urlpatterns = [
    # Health check endpoint
    path("health/", health, name="health"),

    # 3-day forecast endpoint
    path("3day/", forecast_3day, name="forecast-3day"),
]
