# ml_model/run_all_forecasts.py
import os
import subprocess
import sys
from datetime import datetime
from pymongo import MongoClient

BASE = os.path.dirname(os.path.abspath(__file__))

def now():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

def log(msg):
    print(f"[{now()}] {msg}", flush=True)

def run_cmd(cmd):
    log("RUN: " + " ".join(cmd))
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)} (rc={res.returncode})")

def get_latest_quality(mongo_uri, mongo_db):
    if not mongo_uri:
        log("MONGO_URI not set; cannot read quality.")
        return None
    client = MongoClient(mongo_uri)
    db = client[mongo_db]
    doc = db.model_runs.find_one(sort=[("trained_at", -1)])
    if not doc:
        return None
    # prefer bounded metric
    if "quality_0_1" in doc:
        return float(doc["quality_0_1"])
    if "quality" in doc:
        return float(doc["quality"])
    return None

def main():
    try:
        log("Starting pipeline")

        # env-driven config
        python_exe = os.getenv("PYTHON_BIN", "python")
        publish_thresh = float(os.environ.get("PUBLISH_IF_QUALITY_GE", "0.5"))
        mongo_uri = os.environ.get("MONGO_URI")
        mongo_db = os.environ.get("MONGO_DB", "forecast3day")

        # 1) Train
        train_py = os.path.join(BASE, "train_lstm.py")
        run_cmd([python_exe, train_py])

        # 2) Check quality
        quality = get_latest_quality(mongo_uri, mongo_db)
        log(f"Latest model quality (0..1): {quality}")

        if quality is None:
            log("No quality info found; skipping prediction (safe default).")
            return 0

        if quality < publish_thresh:
            log(f"Quality {quality:.3f} < threshold {publish_thresh:.3f}; skipping publish.")
            # still record that pipeline ran but didn't publish
            return 0

        # 3) Predict & publish
        predict_py = os.path.join(BASE, "predict_3day.py")
        run_cmd([python_exe, predict_py])

        log("Pipeline finished successfully.")
        return 0

    except Exception as e:
        log("ERROR: " + str(e))
        return 2

if __name__ == "__main__":
    rc = main()
    sys.exit(rc)
