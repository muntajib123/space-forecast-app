import os
import logging
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

logger = logging.getLogger(__name__)

# --- Env vars ---
MONGO_URI = os.environ.get("MONGO_URI")
# ✅ default changed to noaa_database so both ORM + pymongo agree
DB_NAME = os.environ.get("MONGO_DB", "noaa_database")
COLLECTION_NAME = os.environ.get("MONGO_COLLECTION", "forecast_forecast3day")

_client = None
_db = None
collection = None


def init_mongo():
    """Initialize Mongo connection once and set global collection."""
    global _client, _db, collection
    if not MONGO_URI:
        logger.error("MONGO_URI not set in environment variables")
        return None

    try:
        # ✅ Decide TLS automatically:
        # - Atlas SRV URI → needs TLS
        # - Localhost → no TLS
        if "mongodb+srv" in MONGO_URI:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tls=True)
        else:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

        _db = _client[DB_NAME]
        collection = _db[COLLECTION_NAME]

        # quick ping
        _client.admin.command("ping")
        logger.info(
            "Connected to MongoDB at %s [db=%s collection=%s]",
            MONGO_URI,
            DB_NAME,
            COLLECTION_NAME,
        )
        return collection
    except ServerSelectionTimeoutError as e:
        logger.exception("Could not connect to MongoDB: %s", e)
        collection = None
        return None


# Initialize on import
init_mongo()

# ---------------------------------------------------------------------
# Validated save helper for Forecast3Day
# ---------------------------------------------------------------------

from django.core.exceptions import ValidationError
from forecast.models import Forecast3Day
from datetime import datetime


def save_forecast3day_validated(doc: dict) -> dict:
    """
    Validate & save a Forecast3Day document.

    doc: dict with keys matching model fields (e.g. date as 'YYYY-MM-DD' or date object,
         kp_index, a_index, radio_flux, solar_radiation, radio_blackout,
         rationale_geomagnetic, rationale_radiation, rationale_blackout)

    Returns a dict: {"ok": True, "method": "orm"|"pymongo", "id": <id/string>}
    On validation failure returns {"ok": False, "error": str(...)}
    """
    # normalize date
    try:
        d = doc.get("date")
        if isinstance(d, str):
            d = datetime.fromisoformat(d).date()

        inst = Forecast3Day(
            date=d,
            kp_index=doc.get("kp_index", []),
            a_index=doc.get("a_index"),
            radio_flux=doc.get("radio_flux"),
            solar_radiation=doc.get("solar_radiation", []),
            radio_blackout=doc.get("radio_blackout", {}),
            rationale_geomagnetic=doc.get("rationale_geomagnetic", "") or "",
            rationale_radiation=doc.get("rationale_radiation", "") or "",
            rationale_blackout=doc.get("rationale_blackout", "") or "",
        )
    except Exception as e:
        return {"ok": False, "error": f"payload parse error: {e}"}

    # run model validation
    try:
        inst.full_clean()
    except ValidationError as e:
        return {"ok": False, "error": f"validation failed: {e}"}

    # save via ORM
    try:
        inst.save()
        return {"ok": True, "method": "orm", "id": str(inst.id)}
    except Exception as orm_exc:
        logger.exception("ORM save failed, falling back to pymongo: %s", orm_exc)
        # fallback to pymongo
        try:
            if collection is None:
                init_mongo()
            res = collection.insert_one(doc)
            return {"ok": True, "method": "pymongo", "id": str(res.inserted_id)}
        except Exception as mongo_exc:
            logger.exception("Pymongo fallback failed: %s", mongo_exc)
            return {"ok": False, "error": f"both ORM and pymongo failed: {mongo_exc}"}
