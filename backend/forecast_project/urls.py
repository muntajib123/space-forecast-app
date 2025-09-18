# backend/forecast_project/urls.py

from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

def home(request):
    return HttpResponse("🚀 Space Forecast API is running!")

urlpatterns = [
    path('', home),  # 👈 root health check route
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),       # routes from your api app
    path('forecast/', include('forecast.urls')),  # keep forecast routes separate
]
