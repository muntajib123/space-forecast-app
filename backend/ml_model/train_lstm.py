# ml_model/train_lstm.py
import os
import numpy as np
import pandas as pd
from pymongo import MongoClient
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# optional: load .env automatically if present
try:
    from dotenv import load_dotenv
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # ml_model/..
    dotenv_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
except Exception:
    pass

# ---- CONFIG ----
SEQ_LENGTH = 24        # 3 days of 3-hour steps
FORECAST_LENGTH = 24   # next 3 days, 3-hourly
EPOCHS = 100
BATCH_SIZE = 16
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ---- MONGO SETUP ----
MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI") or "mongodb://localhost:27017/forecast3day"
client = MongoClient(MONGO_URI)
dbname = os.environ.get("MONGO_DBNAME", None)
db = client[dbname] if dbname else client.get_default_database()
collection_name = os.environ.get("HIST_COLLECTION", "forecast_forecast3day")
col = db[collection_name]

def load_kp_series():
    docs = list(col.find({}).sort("date", 1))
    records = []
    for d in docs:
        date = d.get("date")
        kp = d.get("kp_index", None)

        if isinstance(kp, (list, tuple)) and len(kp) > 0:
            for i, v in enumerate(kp):
                try:
                    ts = pd.to_datetime(date) + pd.to_timedelta(i * 3, unit="h")
                except Exception:
                    ts = pd.to_datetime(d.get("_id").generation_time)
                try:
                    records.append({"datetime": ts, "kp": float(v)})
                except Exception:
                    continue
        else:
            try:
                ts = pd.to_datetime(date)
            except Exception:
                ts = pd.to_datetime(d.get("_id").generation_time)
            try:
                records.append({"datetime": ts, "kp": float(kp)})
            except Exception:
                continue

    if not records:
        raise RuntimeError("No Kp records found in collection.")
    df = pd.DataFrame(records)
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
    model.add(Dense(out_len, activation="sigmoid"))  # sigmoid ensures [0,1]
    model.compile(optimizer="adam", loss="mse")
    return model

def main():
    print("Loading data from MongoDB...")
    df = load_kp_series()
    print(f"Loaded {len(df)} kp records (3-hourly).")

    values = df["kp"].values.reshape(-1, 1)

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(values)  # scaled between 0 and 1

    X, y = create_sequences(scaled, SEQ_LENGTH, FORECAST_LENGTH)
    if X.size == 0:
        raise RuntimeError("Not enough data for sequence creation. Need more history.")

    X = X.reshape((X.shape[0], SEQ_LENGTH, 1))
    y = y.reshape((y.shape[0], FORECAST_LENGTH))

    split_idx = int(0.8 * len(X))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    model = build_model((SEQ_LENGTH, 1), FORECAST_LENGTH)
    print(model.summary())

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6)
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1
    )

    # --- Evaluate on normalized scale (0–1) ---
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test.flatten(), y_pred.flatten())
    mae = mean_absolute_error(y_test.flatten(), y_pred.flatten())
    print(f"[Normalized] MSE: {mse:.6f}, MAE: {mae:.6f}, RMSE: {mse**0.5:.6f}")

    # --- Predict next sequence in [0,1] ---
    last_input = scaled[-SEQ_LENGTH:]
    next_pred = model.predict(last_input.reshape(1, SEQ_LENGTH, 1))[0]
    next_pred = np.clip(next_pred, 0, 1)  # enforce bounds

    daily_avgs = []
    for d in range(3):
        start, end = d * 8, (d + 1) * 8
        daily_avgs.append(float(np.mean(next_pred[start:end])))

    save_doc = {
        "date": pd.Timestamp.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "predicted_kp_3hr": next_pred.tolist(),      # values in [0,1]
        "daily_avg_kp_next3days": daily_avgs,        # values in [0,1]
        "model_mse": float(mse)
    }
    col.insert_one(save_doc)
    print("Saved normalized prediction to MongoDB:", save_doc)

if __name__ == "__main__":
    main()
