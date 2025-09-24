# backend/api/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("predictions/3day", views.predictions_3day, name="predictions_3day"),   # ✅ alias
    path("forecast/3day", views.forecast_3day, name="forecast_3day"),           # ✅ main endpoint
    path("predictions/noaa-baseline", views.noaa_baseline, name="noaa_baseline"),
]
