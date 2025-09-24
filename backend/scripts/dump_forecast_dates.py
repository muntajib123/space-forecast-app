# backend/scripts/dump_forecast_dates.py
import os
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27018")
DB_NAME = os.environ.get("MONGO_DB", "noaa_database")
COLLECTION_NAME = os.environ.get("MONGO_COLLECTION", "forecast_forecast3day")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coll = db[COLLECTION_NAME]

dates = coll.distinct("date")
dates = sorted([str(d) for d in dates])
print("Forecast dates in DB:")
for d in dates:
    print(" -", d)
