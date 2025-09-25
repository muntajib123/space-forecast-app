import logging
from datetime import datetime, date, timezone as dt_timezone, timedelta
from typing import List, Dict, Any, Optional
import os

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

from bson import ObjectId

from forecast.models import Forecast3Day
from forecast.serializers import Forecast3DaySerializer

# new imports: utils to handle NOAA baseline, Ap conversion and dummy fields
from .utils_spaceweather import (
    ensure_space_fields,
    get_noaa_baseline,
    baseline_next_day,
)

logger = logging.getLogger(__name__)

try:
    from .db import collection
except Exception:
    collection = None
    logger.warning(
        "mongo collection import failed in api.views; ensure backend/api/db.py exports `collection`"
    )


# --- helper to add CORS headers ---
def cors_json(data, status=200):
    resp = JsonResponse(data, status=status, safe=False)
    resp["Access-Control-Allow-Origin"] = "*"  # allow all (or restrict to Vercel domain)
    resp["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def _serialize_doc(d: Dict[str, Any]) -> Dict[str, Any]:
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
    Backward-compatible fallback: looks for documents in the main collection
    matching a 'noaa' rationale or otherwise returns the latest date found.
    This is kept for compatibility but the preferred path is get_noaa_baseline().
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

    try:
        doc = collection.find_one({}, sort=[("date", -1)])
        if doc:
            return _to_date(doc.get("date"))
    except Exception:
        logger.exception("Error querying collection for latest date fallback")

    return None


def _collect_next_n_forecasts_from_cursor(cursor, start_date: date, n: int = 3) -> List[Dict[str, Any]]:
    candidates = []
    for d in cursor:
        try:
            doc_date = _to_date(d.get("date"))
            if doc_date and doc_date >= start_date:
                candidates.append((doc_date, d))
        except Exception:
            logger.exception("Error parsing date for doc %s", d.get("_id"))
    candidates.sort(key=lambda tup: tup[0])
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


@csrf_exempt
@require_GET
def forecast_3day(request):
    if collection is None:
        return cors_json({"error": "mongo collection not configured"}, status=500)

    try:
        today_utc = datetime.now(dt_timezone.utc).date()

        # Preferred: use explicit NOAA baseline document (inserted by insert_noaa_baseline)
        baseline_doc = get_noaa_baseline()
        if baseline_doc and baseline_doc.get("baseline_end"):
            # baseline_next_day returns the midnight UTC next-day datetime
            start_dt = baseline_next_day(baseline_doc.get("baseline_end"))
            # convert to date for comparisons
            start_date = start_dt.date() if isinstance(start_dt, datetime) else start_dt
            logger.info("Using start_date from NOAA baseline (baseline_end+1): %s", start_date.isoformat())
        else:
            # Fallback: use legacy lookup to find latest date and then offset
            latest_noaa = _find_latest_noaa_date()
            if latest_noaa:
                # If latest_noaa is date of NOAA first day, NOAA covers latest_noaa..latest_noaa+2
                # We want to start *after* NOAA's block: latest_noaa + 3
                start_date = latest_noaa + timedelta(days=3)
                logger.info("Using start_date = NOAA+3 (fallback): %s", start_date.isoformat())
            else:
                # No NOAA baseline found; default to today+3 (keeps behaviour that forecast starts beyond current NOAA window)
                start_date = today_utc + timedelta(days=3)
                logger.info("No NOAA baseline found; using start_date = today+3: %s", start_date.isoformat())

        # Fetch candidate forecasts from collection
        candidate_limit = 500
        cursor = collection.find({"date": {"$exists": True}}, projection=None).limit(candidate_limit)
        predictions = _collect_next_n_forecasts_from_cursor(cursor, start_date=start_date, n=3)

        if len(predictions) < 3:
            # Try scanning broader if not enough found
            cursor2 = collection.find({"date": {"$exists": True}}, projection=None)
            predictions = _collect_next_n_forecasts_from_cursor(cursor2, start_date=start_date, n=3)

        if not predictions:
            # Last fallback: return the first 3 sorted by date (ensures something is returned)
            fallback_cursor = collection.find({"date": {"$exists": True}}, projection=None).sort("date", 1).limit(3)
            docs = [_serialize_doc(d) for d in fallback_cursor]
            # ensure dummy fields on fallback docs
            for doc in docs:
                ensure_space_fields(doc)
            return cors_json({"predictions": docs}, status=200)

        # Ensure Ap and dummy fields are present for every returned prediction
        for p in predictions:
            ensure_space_fields(p)

        include_noaa = request.GET.get("include_noaa", "").lower() in ("1", "true", "yes")
        resp = {"predictions": predictions}
        if include_noaa and baseline_doc:
            try:
                resp["noaa_baseline"] = _serialize_doc(baseline_doc)
            except Exception:
                logger.exception("Error serializing NOAA baseline for include_noaa")
        elif include_noaa and not baseline_doc:
            # Attempt fallback NOAA doc fetch from collection if baseline collection not present
            try:
                noaa_doc = collection.find_one({"rationale_geomagnetic": {"$regex": "noaa", "$options": "i"}}, sort=[("date", -1)])
                if noaa_doc:
                    resp["noaa_baseline"] = _serialize_doc(noaa_doc)
            except Exception:
                logger.exception("Error fetching NOAA baseline doc for include_noaa fallback")

        return cors_json(resp, status=200)

    except Exception as exc:
        logger.exception("Unhandled error in forecast_3day: %s", exc)
        return cors_json({"error": str(exc)}, status=500)


@csrf_exempt
@require_GET
def predictions_3day(request):
    return forecast_3day(request)


@csrf_exempt
@require_GET
def noaa_baseline(request):
    # Responds with the NOAA baseline (if present) from the dedicated baseline collection
    baseline_doc = get_noaa_baseline()
    if not baseline_doc:
        return cors_json({"baseline": None}, status=404)

    # If you want to serialize via your Django model/serializer, you can adapt this,
    # but the baseline is stored in Mongo; we return the serialized Mongo doc here.
    serialized = _serialize_doc(baseline_doc)
    return cors_json({"baseline": serialized}, status=200)


@csrf_exempt
@require_GET
def health(request):
    if collection is None:
        return cors_json({"status": "error", "mongo": "unavailable"}, status=500)
    try:
        _ = collection.estimated_document_count()
        return cors_json({"status": "ok", "mongo": "reachable"}, status=200)
    except Exception as exc:
        logger.exception("Health check: mongo ping failed")
        return cors_json({"status": "error", "mongo": "unreachable", "error": str(exc)}, status=500)
