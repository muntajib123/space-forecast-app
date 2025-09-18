from pymongo import MongoClient
import os

MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI)
dbname = os.environ.get("MONGO_DBNAME", "noaa_database")
db = client[dbname]
col = db["forecast_forecast3day"]

col.drop()
print("Dropped collection forecast_forecast3day")
