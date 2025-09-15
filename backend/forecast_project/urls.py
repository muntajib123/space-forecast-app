# backend/forecast_project/urls.py

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),       # routes from your api app
    path('forecast/', include('forecast.urls')),  # keep forecast routes separate
]
