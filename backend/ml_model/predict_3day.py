# ml_model/predict_3day.py
import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pymongo import MongoClient
from tensorflow.keras.models import load_model
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("predict_3day")

MODEL_OUT = os.environ.get("MODEL_OUT", "ml_model/models/lstm_kp_model.h5")
SCALER_OUT = os.environ.get("SCALER_OUT", "ml_model/models/kp_scaler.save")
SEQ_LENGTH = int(os.environ.get("SEQ_LENGTH", 24))
FORECAST_LENGTH = int(os.environ.get("FORECAST_LENGTH", 24))
TRAIN_COLLECTION = os.environ.get("HIST_COLLECTION", "forecast_forecast3day")
FORECAST_COLLECTION = os.environ.get("FORECAST_COLLECTION", "forecast_forecast3day")
MONGO_URI = os.environ.get("MONGO_URI")
MONGO_DB = os.environ.get("MONGO_DB", "forecast3day")
PUBLISH_IF_QUALITY_GE = float(os.environ.get("PUBLISH_IF_QUALITY_GE", 0.0))

def get_latest_quality(db):
    doc = db.get_collection("model_runs").find_one(sort=[("trained_at", -1)])
    if not doc:
        return None
    if "quality_0_1" in doc:
        return float(doc["quality_0_1"])
    return float(doc.get("quality", 0.0))

def _safe_to_datetime(val):
    """
    Convert val to a timezone-aware (UTC) pandas Timestamp.
    Handles strings, naive datetimes, and pandas Timestamps.
    """
    try:
        # let pandas handle many formats; force utc
        ts = pd.to_datetime(val, utc=True)
        return ts
    except Exception:
        try:
            # last-resort: if val is a datetime without tz, attach UTC
            if isinstance(val, datetime):
                return pd.to_datetime(val).tz_localize("UTC")
        except Exception:
            pass
    return None

def load_recent_sequence_from_collection(db, lookback):
    col = db.get_collection(TRAIN_COLLECTION)
    docs = list(col.find({}).sort("date", 1))
    records = []
    for d in docs:
        date = d.get("date")
        kp = d.get("kp_index") or d.get("predicted_kp_3hr") or d.get("kp")
        if isinstance(kp, (list, tuple)) and len(kp) > 0:
            for i, v in enumerate(kp):
                try:
                    base_ts = _safe_to_datetime(date)
                    if base_ts is None:
                        base_ts = pd.to_datetime(d.get("_id").generation_time, utc=True)
                    ts = base_ts + pd.to_timedelta(i * 3, unit="h")
                except Exception:
                    ts = pd.to_datetime(d.get("_id").generation_time, utc=True) + pd.to_timedelta(i * 3, unit="h")
                try:
                    records.append({"datetime": ts, "kp": float(v)})
                except Exception:
                    continue
        else:
            try:
                ts = _safe_to_datetime(date)
                if ts is None:
                    ts = pd.to_datetime(d.get("_id").generation_time, utc=True)
            except Exception:
                ts = pd.to_datetime(d.get("_id").generation_time, utc=True)
            try:
                records.append({"datetime": ts, "kp": float(kp)})
            except Exception:
                continue

    df = pd.DataFrame(records)
    if df.empty:
        raise RuntimeError("Not enough history to build recent sequence")
    # ensure timezone-aware and sorted
    df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
    df = df.sort_values("datetime").reset_index(drop=True)

    if len(df) < lookback:
        raise RuntimeError("Not enough history to build recent sequence")
    seq = df["kp"].values.astype(float)[-lookback:].reshape(-1,1)
    return seq, df

def main():
    if not MONGO_URI:
        raise RuntimeError("Set MONGO_URI environment variable")

    logger.info("Loading model and scaler")
    model = load_model(MODEL_OUT, compile=False)
    scaler = joblib.load(SCALER_OUT)

    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]

    quality = get_latest_quality(db)
    logger.info("Latest model quality (0..1): %s", quality)

    if quality is None:
        logger.warning("No model_runs quality found - proceeding based on PUBLISH_IF_QUALITY_GE")

    recent_seq, df_hist = load_recent_sequence_from_collection(db, SEQ_LENGTH)
    scaled_recent = scaler.transform(recent_seq)

    # Predict: model was trained to output whole horizon at once; produce preds accordingly
    inp = scaled_recent.reshape(1, SEQ_LENGTH, 1)
    preds = model.predict(inp).reshape(-1)  # length = FORECAST_LENGTH
    # keep predictions in reasonable range (model trained on MinMaxScaler => outputs approx in [0,1])
    preds = np.clip(preds, -1.0, 1.0)
    preds = preds.reshape(-1,1)
    preds_inv = scaler.inverse_transform(preds)  # (FORECAST_LENGTH,1)

    now = datetime.utcnow()
    docs = []
    for day in range(3):
        start = day * 8
        end = start + 8
        slice_vals = preds_inv[start:end].flatten() if end <= len(preds_inv) else preds_inv[start:].flatten()
        daily_avg = float(np.mean(slice_vals)) if len(slice_vals) else None
        # use ISO UTC date string for the day (midnight UTC)
        day_date = (now + timedelta(days=day+1)).replace(hour=0, minute=0, second=0, microsecond=0)
        iso_date = day_date.strftime("%Y-%m-%dT%H:%M:%SZ")
        docs.append({
            "date": iso_date,
            "kp_index": slice_vals.tolist(),
            "kp_daily_avg": daily_avg,
            "created_at": datetime.utcnow(),
            "source": "lstm_kp_model"
        })

    publish = True
    if quality is not None:
        publish = (quality >= PUBLISH_IF_QUALITY_GE)

    if publish:
        res = db.get_collection(FORECAST_COLLECTION).insert_many(docs)
        logger.info("Inserted %d forecast docs", len(res.inserted_ids))
        db.get_collection("prediction_publishes").insert_one({
            "published_at": now,
            "inserted_ids": [str(x) for x in res.inserted_ids],
            "model_quality_0_1": float(quality) if quality is not None else None
        })
        print("Published:", res.inserted_ids)
    else:
        logger.warning("Not publishing: quality=%s threshold=%s", quality, PUBLISH_IF_QUALITY_GE)
        db.get_collection("prediction_publishes").insert_one({
            "published_at": now,
            "published": False,
            "model_quality_0_1": float(quality) if quality is not None else None,
            "docs_preview": docs
        })
        print("Not published; quality too low:", quality)

if __name__ == "__main__":
    main()
