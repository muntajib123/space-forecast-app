from django.http import JsonResponse
from django.views.decorators.http import require_GET
import logging

from .models import Forecast3Day

logger = logging.getLogger(__name__)

@require_GET
def forecast_3day(request):
    try:
        # Get all records ordered by date
        records = list(Forecast3Day.objects.all().order_by("date").values())

        # Convert date fields to string (so JSON can handle it)
        for rec in records:
            if "date" in rec and rec["date"] is not None:
                rec["date"] = str(rec["date"])

        logger.info(f"Returning {len(records)} forecast records")
        return JsonResponse({"data": records}, safe=False)

    except Exception as e:
        logger.exception("Error fetching forecast_3day data")
        return JsonResponse({"error": str(e)}, status=500)
