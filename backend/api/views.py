# backend/api/views.py
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .db import collection   # ✅ import Mongo collection

logger = logging.getLogger(__name__)

@require_GET
def health(request):
    """
    Simple health check endpoint.
    """
    logger.info("Health check OK")
    return JsonResponse({"status": "ok"}, status=200)

@require_GET
def forecast_3day(request):
    """
    Return all 3-day forecast records from MongoDB Atlas.
    """
    try:
        # Fetch documents from Atlas, sorted by date
        docs = list(collection.find({}).sort("date", 1).limit(50))

        # Convert ObjectId to string so JSON can serialize it
        for d in docs:
            if "_id" in d:
                d["_id"] = str(d["_id"])

        logger.info("Returning %d forecast records", len(docs))
        return JsonResponse({"data": docs}, safe=False, status=200)

    except Exception as exc:
        logger.exception("Unhandled error in forecast_3day")
        return JsonResponse({"error": str(exc)}, status=500)
