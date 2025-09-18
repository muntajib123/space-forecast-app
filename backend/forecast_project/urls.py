# backend/forecast_project/urls.py
from django.contrib import admin
from django.urls import path, include, get_resolver
from django.http import HttpResponse, JsonResponse

def home(request):
    return HttpResponse("🚀 Space Forecast API is running!")

def routes(request):
    resolver = get_resolver()
    patterns = []
    def walk(pattern_list, prefix=''):
        for p in pattern_list:
            try:
                route = str(p.pattern)
            except Exception:
                continue
            if hasattr(p, 'url_patterns'):
                walk(p.url_patterns, prefix + route)
            else:
                cb = getattr(p, 'callback', None)
                patterns.append({
                    'pattern': prefix + route,
                    'name': getattr(p, 'name', None),
                    'callback': f"{cb.__module__}.{cb.__name__}" if cb else None
                })
    walk(resolver.url_patterns)
    return JsonResponse({'routes': patterns}, json_dumps_params={'indent': 2})

urlpatterns = [
    path('', home),
    path('routes/', routes),        # <-- temporary debug route
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('forecast/', include('forecast.urls')),
]
