# api/views.py
import logging
import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Forecast3Day

logger = logging.getLogger(__name__)

def _make_json_serializable(value):
    """
    Convert common non-JSON types to JSON-safe values.
    Add more conversions here if Render logs show other types.
    """
    try:
        # Common for bson ObjectId or datetime
        from bson import ObjectId  # type: ignore
    except Exception:
        ObjectId = None

    # datetime/date
    try:
        from datetime import date, datetime  # builtin
    except Exception:
        date = datetime = None

    if ObjectId is not None and isinstance(value, ObjectId):
        return str(value)
    if date is not None and isinstance(value, (date, datetime)):
        return value.isoformat()
    # fallback
    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


@require_GET
def forecast_3day(request):
    try:
        qs = Forecast3Day.objects.all().order_by("date")
        # Preferred: get simple dicts
        try:
            records = list(qs.values())
        except Exception as e_values:
            logger.warning("qs.values() failed: %s. Falling back to manual extraction.", e_values)
            # fall back to iterating objects
            records = []
            for obj in qs:
                # convert model instance to dict of fields
                d = {}
                for field in obj._meta.fields:
                    name = field.name
                    d[name] = getattr(obj, name)
                records.append(d)

        # Convert non-json types
        for rec in records:
            for k, v in list(rec.items()):
                rec[k] = _make_json_serializable(v)

        logger.info("Returning %d forecast records", len(records))
        return JsonResponse({"data": records}, status=200)
    except Exception as exc:
        logger.exception("Unhandled error in forecast_3day")
        return JsonResponse({"error": str(exc)}, status=500)
