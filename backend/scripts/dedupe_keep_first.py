import os
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

total_deleted = 0
for d in dupes:
    ids = d["ids"]
    # keep first ID, delete the rest
    to_delete = ids[1:]
    if to_delete:
        res = coll.delete_many({"_id": {"$in": to_delete}})
        total_deleted += res.deleted_count
        print(f"Date {d['_id']}: kept {ids[0]}, deleted {res.deleted_count}")

print(f"Done. Total deleted: {total_deleted}")
