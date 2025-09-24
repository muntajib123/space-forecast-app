# backend/api/seed_mongo_future.py
"""
Seeder: upserts n_days future forecast documents into the Mongo collection.
Now robust: starts after the last date already in Mongo (avoids overlap).
"""

import os
import sys
from datetime import datetime, timedelta, timezone

# ensure local package imports work
BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
sys.path.insert(0, ROOT)

collection = None

# --- Try to get Mongo collection ---
try:
    from api.db import collection as imported_collection
    collection = imported_collection
    print("Using collection from api.db")
except Exception:
    try:
        from backend.api.db import collection as imported_collection2
        collection = imported_collection2
        print("Using collection from backend.api.db")
    except Exception:
        collection = None

if collection is None:
    MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
    if MONGO_URI:
        from pymongo import MongoClient
        mongo_db = os.environ.get("MONGO_DB") or "forecast_db"
        mongo_collection = os.environ.get("MONGO_COLLECTION") or "forecasts"
        client = MongoClient(MONGO_URI)
        collection = client[mongo_db][mongo_collection]
        print(f"Connected to Mongo via MONGO_URI -> DB: {mongo_db}, collection: {mongo_collection}")

if collection is None:
    raise RuntimeError("Mongo collection not available. Set MONGO_URI or fix api/db.py")


# --- Helpers ---
def iso_midnight_utc(dt_date):
    return datetime(dt_date.year, dt_date.month, dt_date.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

def make_doc_for(date_obj):
    return {
        "date": iso_midnight_utc(date_obj),
        "kp_index": [3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7],
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 0, "R3 or greater": 0},
        "rationale_geomagnetic": "Auto-seeded placeholder",
        "rationale_radiation": "Auto-seeded placeholder",
        "rationale_blackout": "Auto-seeded placeholder",
        "created_at": datetime.utcnow().isoformat(),
    }

def get_latest_date_in_mongo():
    """Find the latest forecast date in MongoDB (based on `date` field)."""
    doc = collection.find_one(sort=[("date", -1)])
    if not doc:
        return None
    try:
        return datetime.fromisoformat(str(doc["date"]).replace("Z", "+00:00")).date()
    except Exception:
        return None


# --- Main seeding ---
def seed_future(n_days=3):
    latest = get_latest_date_in_mongo()
    if latest:
        start = latest + timedelta(days=1)
        print(f"[seed] Latest Mongo forecast = {latest}, seeding from {start}")
    else:
        start = datetime.utcnow().date() + timedelta(days=1)
        print(f"[seed] No existing records, starting from {start}")

    created = 0
    updated = 0

    for i in range(n_days):
        target = start + timedelta(days=i)
        iso_date = iso_midnight_utc(target)
        doc = make_doc_for(target)

        res = collection.update_one({"date": iso_date}, {"$set": doc}, upsert=True)
        if getattr(res, "upserted_id", None):
            created += 1
            print(f"Created Mongo forecast for {iso_date}")
        else:
            updated += 1
            print(f"Updated Mongo forecast for {iso_date}")

    print(f"[seed] done — created={created}, updated={updated}")


if __name__ == "__main__":
    seed_future(3)
