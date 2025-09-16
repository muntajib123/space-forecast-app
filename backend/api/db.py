# backend/api/db.py
import os
from pymongo import MongoClient

# Get Mongo URI from environment variable
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in environment variables")

# Connect to MongoDB Atlas with TLS
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tls=True)

# Use the correct database and collection
db = client["forecast3day"]                  # Atlas database name
collection = db["forecast_forecast3day"]     # Atlas collection name
