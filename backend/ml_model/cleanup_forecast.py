# backend/ml_model/cleanup_forecast.py
from pymongo import MongoClient
from datetime import datetime

# Connect to MongoDB
client = MongoClient("mongodb://localhost:27018")
db = client["noaa_database"]
coll = db["forecast_forecast3day"]

# Define cutoff: remove everything on/after 2025-09-27
cutoff = datetime(2025, 9, 27)

result = coll.delete_many({"date": {"$gte": cutoff}})
print(f"Deleted {result.deleted_count} documents with date >= {cutoff.date()}")
