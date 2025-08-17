import os
import sys
import django
from datetime import datetime

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from forecast.models import Forecast3Day

# Seed initial NOAA present forecast (example for Jul 2–4)
present_data = [
    {
        "date": "2025-07-02",
        "kp_index": [1.33, 1.67, 2.33, 2.67, 3.0, 3.0, 3.67, 4.67],
        "solar_radiation": [5],
        "radio_blackout": {"R1-R2": 20, "R3 or greater": 5},
        "rationale_geomagnetic": "NOAA G1 storm levels possible",
        "rationale_radiation": "Low chance of solar radiation storms",
        "rationale_blackout": "Slight chance due to M-class flares"
    },
    {
        "date": "2025-07-03",
        "kp_index": [4.67, 4.33, 3.33, 2.67, 2.33, 2.67, 3.0, 3.67],
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 15, "R3 or greater": 1},
        "rationale_geomagnetic": "Lingering CME effects",
        "rationale_radiation": "No major events expected",
        "rationale_blackout": "Minor risk remains"
    },
    {
        "date": "2025-07-04",
        "kp_index": [2.67, 4.0, 3.0, 2.67, 1.67, 1.67, 2.0, 2.67],
        "solar_radiation": [1],
        "radio_blackout": {"R1-R2": 15, "R3 or greater": 1},
        "rationale_geomagnetic": "Conditions returning to normal",
        "rationale_radiation": "Stable activity forecasted",
        "rationale_blackout": "Minor blackouts unlikely"
    },
]

# Save to database
for entry in present_data:
    Forecast3Day.objects.update_or_create(
        date=entry["date"],
        defaults={
            "kp_index": entry["kp_index"],
            "solar_radiation": entry["solar_radiation"],
            "radio_blackout": entry["radio_blackout"],
            "rationale_geomagnetic": entry["rationale_geomagnetic"],
            "rationale_radiation": entry["rationale_radiation"],
            "rationale_blackout": entry["rationale_blackout"],
        }
    )

print("✅ Seeded initial forecast data (Jul 2–4) to database.")
