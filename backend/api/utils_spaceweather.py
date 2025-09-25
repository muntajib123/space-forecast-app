# backend/api/utils_spaceweather.py
from datetime import datetime, timedelta
import os
from pymongo import MongoClient

# NOAA-style Kp → Ap map
Kp_to_Ap_map = {0:0, 1:2, 2:3, 3:4, 4:6, 5:9, 6:15, 7:27, 8:48, 9:80}

def kp_to_ap(kp):
    try:
        k = float(kp)
        return Kp_to_Ap_map.get(int(round(k)), 0)
    except Exception:
        return 0

def ensure_space_fields(day):
    if "Ap" not in day and "Kp" in day:
        day["Ap"] = kp_to_ap(day.get("Kp"))
    day.setdefault("solar_radiation_pct", 1)
    day.setdefault("radio_blackout_pct", 35)
    return day

def get_noaa_baseline():
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    dbname = os.environ.get("MONGO_DBNAME", "space_forecast_db")
    coll_name = os.environ.get("NOAA_COLLECTION", "noaa_baseline")
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        db = client[dbname]
        doc = db[coll_name].find_one({"source": "NOAA_3day"})
        return doc
    except Exception:
        return None

def baseline_next_day(baseline_end):
    if not baseline_end:
        return None
    if isinstance(baseline_end, str):
        try:
            baseline_end = datetime.fromisoformat(baseline_end)
        except Exception:
            baseline_end = datetime.strptime(baseline_end.split("T")[0], "%Y-%m-%d")
    be = baseline_end.replace(hour=0, minute=0, second=0, microsecond=0)
    return be + timedelta(days=1)
