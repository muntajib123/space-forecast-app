# ml_model/insert_test_data.py
import os, random
import pandas as pd
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
client = MongoClient(MONGO_URI)
dbname = os.environ.get("MONGO_DBNAME", None)
db = client[dbname] if dbname else client.get_default_database()
col = db[os.environ.get("HIST_COLLECTION", "forecast_forecast3day")]

timestamps = pd.date_range(end=pd.Timestamp.utcnow(), periods=500, freq='3h')
docs = [{"date": ts.to_pydatetime(), "kp_index": round(random.uniform(0, 6), 2)} for ts in timestamps]


res = col.insert_many(docs)
print("Inserted", len(res.inserted_ids), "test docs into", col.name)
