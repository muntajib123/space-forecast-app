from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("predictions/3day", views.forecast_3day, name="forecast_3day"),  # ✅ fixed
]
