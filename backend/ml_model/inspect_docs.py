# ml_model/inspect_docs.py
import os, json
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
client = MongoClient(MONGO_URI)
dbname = os.environ.get("MONGO_DBNAME", None)
db = client[dbname] if dbname else client.get_default_database()
col = db[os.environ.get("HIST_COLLECTION", "forecast_forecast3day")]

print("Connected to", db.name, "collection:", col.name)
docs = list(col.find().limit(5))
print(f"Found {len(docs)} docs. Showing keys and sample values:")
for i, d in enumerate(docs, 1):
    print(f"\n--- doc #{i} ---")
    for k, v in d.items():
        print(f"{k}: {type(v).__name__} -> {repr(v)[:200]}")
