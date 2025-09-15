# backend/api/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Health check endpoint
    path("health/", views.health, name="health"),

    # 3-day forecast endpoint
    path("3day/", views.forecast_3day, name="forecast_3day"),
]
