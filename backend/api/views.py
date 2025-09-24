# backend/api/views.py
import logging
from datetime import datetime, date, timezone as dt_timezone, timedelta
from typing import List, Dict, Any, Optional

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from bson import ObjectId

from forecast.models import Forecast3Day
from forecast.serializers import Forecast3DaySerializer

logger = logging.getLogger(__name__)

# Try to import collection. If it fails we'll handle it in each view.
try:
    from .db import collection
except Exception:
    collection = None
    logger.warning(
        "mongo collection import failed in api.views; ensure backend/api/db.py exports `collection`"
    )


def _serialize_doc(d: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert ObjectId and datetime instances to JSON-friendly types.
    Keep other fields as-is.
    """
    out = {}
    for k, v in d.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat()
            continue
        out[k] = v
    return out


def _to_date(val) -> Optional[date]:
    """
    Normalize value (datetime/date/string) to a date() or return None.
    """
    if val is None:
        return None
    if isinstance(val, datetime):
        try:
            return val.astimezone(dt_timezone.utc).date()
        except Exception:
            return val.date()
    if isinstance(val, date):
        return val
    try:
        s = str(val).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
            return dt.date()
        except Exception:
            try:
                return date.fromisoformat(s.split("T")[0])
            except Exception:
                return None
    except Exception:
        return None


def _find_latest_noaa_date() -> Optional[date]:
    """
    Determine the NOAA baseline START date stored in the collection (if available).
    Preference: rationale_geomagnetic contains 'noaa' (case-insensitive).
    Falls back to latest date in collection.
    """
    if collection is None:
        return None

    try:
        q = {"rationale_geomagnetic": {"$regex": "noaa", "$options": "i"}}
        doc = collection.find_one(q, sort=[("date", -1)])
        if doc:
            d = _to_date(doc.get("date"))
            if d:
                return d
    except Exception:
        logger.exception("Error querying for rationale_geomagnetic contains noaa")

    # fallback: use latest date found in collection
    try:
        doc = collection.find_one({}, sort=[("date", -1)])
        if doc:
            return _to_date(doc.get("date"))
    except Exception:
        logger.exception("Error querying collection for latest date fallback")

    return None


def _collect_next_n_forecasts_from_cursor(cursor, start_date: date, n: int = 3) -> List[Dict[str, Any]]:
    """
    Given a pymongo cursor of candidate docs, parse dates, filter >= start_date,
    sort by parsed date and return up to n serialized docs.
    """
    candidates = []
    for d in cursor:
        try:
            doc_date = _to_date(d.get("date"))
            if doc_date and doc_date >= start_date:
                candidates.append((doc_date, d))
        except Exception:
            logger.exception("Error parsing date for doc %s", d.get("_id"))
    # Sort by parsed date
    candidates.sort(key=lambda tup: tup[0])
    # Deduplicate by date and take first n
    selected = []
    seen_dates = set()
    for doc_date, doc in candidates:
        if doc_date in seen_dates:
            continue
        seen_dates.add(doc_date)
        selected.append(doc)
        if len(selected) >= n:
            break
    return [_serialize_doc(d) for d in selected]


@require_GET
def forecast_3day(request):
    """
    Return next 3 seeded forecast docs (chronological) that start after NOAA's 3-day block.
    Optional query param:
      - include_noaa=true -> includes the NOAA baseline doc under "noaa_baseline"
    """
    if collection is None:
        logger.error("forecast_3day: Mongo collection not available")
        return JsonResponse({"error": "mongo collection not configured"}, status=500)

    try:
        today_utc = datetime.now(dt_timezone.utc).date()

        latest_noaa = _find_latest_noaa_date()
        if latest_noaa:
            # NOAA product covers latest_noaa .. latest_noaa + 2 (3 days).
            # Seed start should be day AFTER that block -> latest_noaa + 3
            start_date = latest_noaa + timedelta(days=3)
            logger.info("Using start_date = day after NOAA 3-day block: %s", start_date.isoformat())
        else:
            # fallback: start from tomorrow
            start_date = today_utc + timedelta(days=1)
            logger.info("No NOAA baseline found; using start_date = tomorrow: %s", start_date.isoformat())

        # initial candidate query (limited)
        candidate_limit = 500
        cursor = collection.find({"date": {"$exists": True}}, projection=None).limit(candidate_limit)
        predictions = _collect_next_n_forecasts_from_cursor(cursor, start_date=start_date, n=3)

        # if not enough found, do a wider scan
        if len(predictions) < 3:
            logger.info("Not enough predictions found in initial candidate set; performing wider scan")
            cursor2 = collection.find({"date": {"$exists": True}}, projection=None)
            predictions = _collect_next_n_forecasts_from_cursor(cursor2, start_date=start_date, n=3)

        # final fallback: return latest 3 docs in chronological order (rare)
        if not predictions:
            fallback_cursor = collection.find({"date": {"$exists": True}}, projection=None).sort("date", 1).limit(3)
            docs = [_serialize_doc(d) for d in fallback_cursor]
            return JsonResponse({"predictions": docs}, status=200)

        # optionally include NOAA baseline doc
        include_noaa = request.GET.get("include_noaa", "").lower() in ("1", "true", "yes")
        resp = {"predictions": predictions}
        if include_noaa and latest_noaa:
            try:
                noaa_doc = collection.find_one({"rationale_geomagnetic": {"$regex": "noaa", "$options": "i"}}, sort=[("date", -1)])
                if noaa_doc:
                    resp["noaa_baseline"] = _serialize_doc(noaa_doc)
            except Exception:
                logger.exception("Error fetching NOAA baseline doc for include_noaa")

        return JsonResponse(resp, status=200)

    except Exception as exc:
        logger.exception("Unhandled error in forecast_3day: %s", exc)
        return JsonResponse({"error": str(exc)}, status=500)


@require_GET
def predictions_3day(request):
    """
    Alias for forecast_3day for backwards compatibility.
    """
    return forecast_3day(request)


@require_GET
def noaa_baseline(request):
    """
    Return the most recent NOAA baseline document (via ORM) as a convenience endpoint.
    """
    latest_noaa = _find_latest_noaa_date()
    if not latest_noaa:
        return JsonResponse({"baseline": None}, status=404)

    doc = Forecast3Day.objects.filter(date=latest_noaa).first()
    if not doc:
        return JsonResponse({"baseline": None}, status=404)

    serialized = Forecast3DaySerializer(doc).data
    return JsonResponse({"baseline": serialized}, status=200)


@require_GET
def health(request):
    """
    Health check for the API & Mongo connectivity.
    """
    if collection is None:
        logger.error("Health check: Mongo collection not available")
        return JsonResponse({"status": "error", "mongo": "unavailable"}, status=500)
    try:
        _ = collection.estimated_document_count()
        return JsonResponse({"status": "ok", "mongo": "reachable"}, status=200)
    except Exception as exc:
        logger.exception("Health check: mongo ping failed")
        return JsonResponse({"status": "error", "mongo": "unreachable", "error": str(exc)}, status=500)
