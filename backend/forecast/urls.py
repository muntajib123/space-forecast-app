from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import Forecast3DayViewSet

router = DefaultRouter()
router.register(r'3day', Forecast3DayViewSet, basename='3day-forecast')

urlpatterns = [
    path('', include(router.urls)),
]
