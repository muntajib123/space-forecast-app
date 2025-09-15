# backend/api/views.py
import logging
import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Forecast3Day

logger = logging.getLogger(__name__)


def _make_json_serializable(value):
    """
    Convert common non-JSON types to JSON-safe values.
    Handles ObjectId, datetime/date, and unknown types.
    """
    try:
        from bson import ObjectId  # type: ignore
    except Exception:
        ObjectId = None

    from datetime import date, datetime

    if ObjectId is not None and isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()

    # fallback
    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


@require_GET
def health(request):
    """
    Simple health check endpoint.
    Useful for testing Render deploys.
    """
    logger.info("Health check OK")
    return JsonResponse({"status": "ok"}, status=200)


@require_GET
def forecast_3day(request):
    """
    Return all 3-day forecast records from MongoDB Atlas.
    Ensures JSON-serializable response.
    """
    try:
        qs = Forecast3Day.objects.all().order_by("date")

        try:
            records = list(qs.values())  # simpler
        except Exception as e_values:
            logger.warning("qs.values() failed: %s. Falling back to manual extraction.", e_values)
            records = []
            for obj in qs:
                d = {}
                for field in obj._meta.fields:
                    name = field.name
                    d[name] = getattr(obj, name)
                records.append(d)

        # Convert non-JSON-safe types
        for rec in records:
            for k, v in list(rec.items()):
                rec[k] = _make_json_serializable(v)

        logger.info("Returning %d forecast records", len(records))
        return JsonResponse({"data": records}, status=200)

    except Exception as exc:
        logger.exception("Unhandled error in forecast_3day")
        return JsonResponse({"error": str(exc)}, status=500)
