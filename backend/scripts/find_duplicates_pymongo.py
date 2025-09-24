# scripts/find_duplicates_pymongo.py
import os
import json
from pymongo import MongoClient
from bson import ObjectId

MONGO_URI = os.environ.get("MONGO_URI")
DB_NAME = os.environ.get("MONGO_DB", "noaa_database")
COLLECTION_NAME = os.environ.get("MONGO_COLLECTION", "forecast_forecast3day")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
coll = client[DB_NAME][COLLECTION_NAME]

# Group by date, find duplicates
pipeline = [
    {"$group": {
        "_id": "$date",
        "count": {"$sum": 1},
        "ids": {"$push": "$_id"}
    }},
    {"$match": {"count": {"$gt": 1}}},
]

dupes = list(coll.aggregate(pipeline))

print(json.dumps(dupes, default=str, indent=2))
