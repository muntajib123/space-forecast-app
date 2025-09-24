import os, json
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27018")
DB_NAME = os.environ.get("MONGO_DB", "noaa_database")
COLLECTION_NAME = os.environ.get("MONGO_COLLECTION", "forecast_forecast3day")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
coll = db[COLLECTION_NAME]

dupes = coll.aggregate([
    {"$group": {"_id": "$date", "count": {"$sum": 1}, "ids": {"$push": "$_id"}}},
    {"$match": {"count": {"$gt": 1}}}
])

all_dupes = []
for d in dupes:
    docs = list(coll.find({"_id": {"$in": d["ids"]}}))
    all_dupes.extend(docs)

with open("duplicate_docs_backup.json", "w") as f:
    json.dump(all_dupes, f, default=str, indent=2)

print(f"Backed up {len(all_dupes)} documents to duplicate_docs_backup.json")
