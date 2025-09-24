# ml_model/train_lstm.py
import os
import numpy as np
import pandas as pd
from datetime import datetime
from pymongo import MongoClient
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error
import joblib
import logging

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("train_lstm")

SEQ_LENGTH = int(os.environ.get("SEQ_LENGTH", 24))
FORECAST_LENGTH = int(os.environ.get("FORECAST_LENGTH", 24))
EPOCHS = int(os.environ.get("EPOCHS", 100))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 16))

MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "models"))
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_OUT = os.path.join(MODEL_DIR, "lstm_kp_model.h5")
SCALER_OUT = os.path.join(MODEL_DIR, "kp_scaler.save")

MONGO_URI = os.environ.get("MONGO_URI")
MONGO_DB = os.environ.get("MONGO_DB", "forecast3day")
HIST_COLLECTION = os.environ.get("HIST_COLLECTION", "forecast_forecast3day")
MODEL_RUNS_COLLECTION = os.environ.get("MODEL_RUNS_COLLECTION", "model_runs")


def load_kp_series(mongo_client, collection_name):
    """
    Load Kp time series from the Mongo collection and return a DataFrame
    with timezone-aware datetimes (UTC). Handles lists of 3-hour kp values
    or single values per document.
    """
    db = mongo_client[MONGO_DB]
    col = db[collection_name]

    # fetch docs sorted by stored date if possible
    docs = list(col.find({}).sort("date", 1))
    records = []

    for d in docs:
        date = d.get("date")
        # prefer existing predicted_kp_3hr / kp_index fields, fall back to kp
        kp = d.get("kp_index") or d.get("predicted_kp_3hr") or d.get("kp")

        if isinstance(kp, (list, tuple)) and len(kp) > 0:
            # expand each element into its own datetime (3-hour steps)
            for i, v in enumerate(kp):
                try:
                    ts = pd.to_datetime(date, utc=True) + pd.to_timedelta(i * 3, unit="h")
                except Exception:
                    # fallback: use ObjectId generation time (tz-aware)
                    ts = pd.to_datetime(d.get("_id").generation_time, utc=True) + pd.to_timedelta(i * 3, unit="h")
                try:
                    records.append({"datetime": ts, "kp": float(v)})
                except Exception:
                    continue
        else:
            # single value document
            try:
                ts = pd.to_datetime(date, utc=True)
            except Exception:
                ts = pd.to_datetime(d.get("_id").generation_time, utc=True)
            try:
                records.append({"datetime": ts, "kp": float(kp)})
            except Exception:
                continue

    if not records:
        raise RuntimeError("No Kp records found in collection.")

    df = pd.DataFrame(records)
    # ensure datetime col is timezone-aware (UTC) and sorted
    df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
    df = df.sort_values("datetime").reset_index(drop=True)
    return df


def create_sequences(values, input_len, output_len):
    X, y = [], []
    for i in range(len(values) - input_len - output_len + 1):
        X.append(values[i:i + input_len])
        y.append(values[i + input_len: i + input_len + output_len])
    return np.array(X), np.array(y)


def build_model(input_shape, out_len):
    model = Sequential()
    model.add(LSTM(64, return_sequences=True, input_shape=input_shape))
    model.add(Dropout(0.2))
    model.add(LSTM(32))
    model.add(Dropout(0.2))
    model.add(Dense(out_len, activation="linear"))
    model.compile(optimizer="adam", loss="mse")
    return model


def main():
    if not MONGO_URI:
        raise RuntimeError("Set MONGO_URI environment variable before running training.")
    client = MongoClient(MONGO_URI)

    logger.info("Loading historical KP series from Mongo collection '%s'...", HIST_COLLECTION)
    df = load_kp_series(client, HIST_COLLECTION)
    logger.info("Loaded %d kp rows", len(df))

    values = df["kp"].values.reshape(-1, 1).astype(float)

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(values)
    joblib.dump(scaler, SCALER_OUT)
    logger.info("Saved scaler -> %s", SCALER_OUT)

    X, y = create_sequences(scaled, SEQ_LENGTH, FORECAST_LENGTH)
    if X.size == 0:
        raise RuntimeError("Not enough data for sequence creation.")

    X = X.reshape((X.shape[0], SEQ_LENGTH, 1))
    y = y.reshape((y.shape[0], FORECAST_LENGTH))

    split_idx = int(0.8 * len(X))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    model = build_model((SEQ_LENGTH, 1), FORECAST_LENGTH)
    model.summary(print_fn=lambda s: logger.info(s))

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6)
    ]

    model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=2
    )

    model.save(MODEL_OUT)
    logger.info("Saved model -> %s", MODEL_OUT)

    # --- Evaluation ---
    y_pred_scaled = model.predict(X_test)
    y_test_flat = y_test.reshape(-1, 1)
    y_pred_flat = y_pred_scaled.reshape(-1, 1)
    y_test_inv = scaler.inverse_transform(y_test_flat)
    y_pred_inv = scaler.inverse_transform(y_pred_flat)

    mse = float(mean_squared_error(y_test_inv, y_pred_inv))
    rmse = float(np.sqrt(mse))

    # Normalized MSE guaranteed 0..1
    y_min, y_max = float(np.min(y_test_inv)), float(np.max(y_test_inv))
    rng = (y_max - y_min) ** 2
    if rng <= 0:
        norm_mse = 0.0 if mse == 0 else 1.0
    else:
        norm_mse = min(1.0, max(0.0, mse / rng))
    quality = 1.0 - norm_mse

    logger.info("EVAL -> raw MSE: %.6f, RMSE: %.6f", mse, rmse)
    logger.info("       norm_MSE_0_1: %.6f, QUALITY_0_1: %.6f", norm_mse, quality)

    # Save run
    db = client[MONGO_DB]
    runs = db[MODEL_RUNS_COLLECTION]
    run_doc = {
        "model_path": MODEL_OUT,
        "scaler_path": SCALER_OUT,
        "mse": mse,
        "rmse": rmse,
        "norm_mse_0_1": norm_mse,
        "quality_0_1": quality,
        "trained_at": datetime.utcnow(),
        "rows": int(len(df))
    }
    runs.insert_one(run_doc)
    logger.info("Inserted model run metadata into '%s'", MODEL_RUNS_COLLECTION)

    print(f"MSE_test: {mse:.6f}")
    print(f"RMSE: {rmse:.6f}")
    print(f"NORM_MSE_0_1: {norm_mse:.6f}")
    print(f"QUALITY_0_1: {quality:.6f}")


if __name__ == "__main__":
    main()
