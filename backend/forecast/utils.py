import json
from .models import Forecast3Day

def load_forecast_json(filepath):
    """
    Load a JSON file and return Python data.
    """
    with open(filepath, 'r') as f:
        return json.load(f)

def save_forecast_data(data):
    """
    Save a list of 3-day forecast entries to the database.
    This expects a list of dicts structured like the LSTM output.
    """
    for entry in data:
        Forecast3Day.objects.update_or_create(
            date=entry['date'],
            defaults={
                'kp_index': entry['kp_index'],
                'solar_radiation': entry['solar_radiation'],
                'radio_blackout': entry['radio_blackout'],
                'rationale_geomagnetic': entry['rationale_geomagnetic'],
                'rationale_radiation': entry['rationale_radiation'],
                'rationale_blackout': entry['rationale_blackout'],
            }
        )
