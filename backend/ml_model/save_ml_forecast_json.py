# backend/ml_model/save_ml_forecast_json.py
"""
Ingest ML / NOAA JSON payloads into Forecast3Day safely.

Usage:
  # from backend/ run:
  python ml_model/save_ml_forecast_json.py path/to/payload.json

Payload format (list of objects) - each object should contain at least:
{
  "date": "2025-09-24",                 # ISO date string or date object
  "kp_index": [...],                    # list or single number
  "a_index": 4,
  "radio_flux": 70.0,
  "solar_radiation": [...],
  "radio_blackout": {...},
  "rationale_geomagnetic": "noaa ...",
  "rationale_radiation": "...",
  "rationale_blackout": "..."
}
"""

import os
import sys
import django
import json
import logging
from datetime import datetime, date

# Setup Django (adjust path relative to this file)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day
from api.db import save_forecast3day_validated  # validated save helper
from django.core.exceptions import ValidationError

log = logging.getLogger("save_ml_forecast_json")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def to_date_obj(d):
    """Normalize date inputs (str or date/datetime) -> datetime.date or None."""
    if d is None:
        return None
    if isinstance(d, date) and not isinstance(d, datetime):
        return d
    if isinstance(d, datetime):
        return d.date()
    try:
        return datetime.fromisoformat(str(d)).date()
    except Exception:
        try:
            from datetime import datetime as _dt
            return _dt.strptime(str(d), "%Y-%m-%d").date()
        except Exception:
            return None


def normalize_record(rec: dict) -> dict:
    """
    Map incoming JSON keys to model-safe dict.
    Keeps only recognized model fields.
    """
    mapped = {}
    mapped["date"] = to_date_obj(rec.get("date") or rec.get("start_date") or rec.get("day"))
    # fields matching Forecast3Day model
    mapped["kp_index"] = rec.get("kp_index") if rec.get("kp_index") is not None else rec.get("kp_list") or []
    mapped["a_index"] = rec.get("a_index", rec.get("ap_index"))
    mapped["radio_flux"] = rec.get("radio_flux", rec.get("f107", None))
    mapped["solar_radiation"] = rec.get("solar_radiation") or rec.get("solar_radiation_percent") or []
    mapped["radio_blackout"] = rec.get("radio_blackout") or {}
    mapped["rationale_geomagnetic"] = rec.get("rationale_geomagnetic") or rec.get("source", "") or ""
    mapped["rationale_radiation"] = rec.get("rationale_radiation") or ""
    mapped["rationale_blackout"] = rec.get("rationale_blackout") or ""
    return mapped


def upsert_record(mapped: dict) -> dict:
    """
    If a record for mapped['date'] exists, validate and update using ORM.
    Otherwise, use save_forecast3day_validated for insert.
    Returns result dict: {"ok": True/False, "action": "created"|"updated"|"skipped", "error": ...}
    """
    if not mapped.get("date"):
        return {"ok": False, "action": "skipped", "error": "missing/invalid date"}

    pdate = mapped["date"]
    defaults = {k: v for k, v in mapped.items() if k != "date"}

    try:
        exists = Forecast3Day.objects.filter(date=pdate).exists()
    except Exception as e:
        log.exception("DB exists() failed for %s: %s", pdate, e)
        return {"ok": False, "action": "skipped", "error": str(e)}

    if exists:
        # validate via tmp instance
        try:
            tmp = Forecast3Day(date=pdate, **{k: v for k, v in defaults.items() if k in {f.name for f in Forecast3Day._meta.get_fields()}})
            tmp.full_clean()
        except ValidationError as e:
            log.error("Validation failed for update %s: %s", pdate, e)
            return {"ok": False, "action": "skipped", "error": f"validation error: {e}"}

        try:
            obj, created_flag = Forecast3Day.objects.update_or_create(date=pdate, defaults=defaults)
            return {"ok": True, "action": "created" if created_flag else "updated", "id": str(obj.id)}
        except Exception as e:
            log.exception("update_or_create failed for %s: %s", pdate, e)
            return {"ok": False, "action": "skipped", "error": str(e)}

    # insert via centralized validated helper
    doc = {"date": pdate, **defaults}
    res = save_forecast3day_validated(doc)
    if not res.get("ok"):
        return {"ok": False, "action": "skipped", "error": res.get("error")}
    return {"ok": True, "action": "created", "method": res.get("method"), "id": res.get("id")}


def ingest_from_list(records: list):
    summary = {"processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}
    for rec in records:
        mapped = normalize_record(rec)
        summary["processed"] += 1
        result = upsert_record(mapped)
        if not result.get("ok"):
            summary["skipped"] += 1
            summary["errors"].append({"record": mapped.get("date"), "error": result.get("error")})
            log.warning("Skipped %s: %s", mapped.get("date"), result.get("error"))
            continue
        action = result.get("action")
        if action == "created":
            summary["created"] += 1
        elif action == "updated":
            summary["updated"] += 1
        log.info("Ingested %s -> %s", mapped.get("date"), action)
    return summary


def ingest_from_file(fp: str):
    with open(fp, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        # single object or wrapper with "predictions" key
        if data.get("predictions") and isinstance(data["predictions"], list):
            records = data["predictions"]
        else:
            records = [data]
    elif isinstance(data, list):
        records = data
    else:
        raise ValueError("Unsupported JSON structure")
    return ingest_from_list(records)


# CLI entry
if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="Ingest ML/NOAA JSON into Forecast3Day (validated).")
    p.add_argument("json_file", nargs="?", help="Path to JSON file (list or single object). If omitted, reads from stdin.")
    args = p.parse_args()

    try:
        if args.json_file:
            summary = ingest_from_file(args.json_file)
        else:
            # read from stdin
            payload = json.load(sys.stdin)
            if isinstance(payload, list):
                summary = ingest_from_list(payload)
            else:
                summary = ingest_from_list([payload])
        log.info("Ingest summary: %s", summary)
        print(json.dumps(summary, default=str, indent=2))
    except Exception as e:
        log.exception("Ingest failed: %s", e)
        print({"ok": False, "error": str(e)})
