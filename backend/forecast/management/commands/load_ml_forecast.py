# backend/forecast/management/commands/load_ml_forecast.py

import json
import os
from django.core.management.base import BaseCommand
from forecast.models import Forecast3Day
from django.conf import settings
from datetime import datetime

class Command(BaseCommand):
    help = 'Load ML-predicted 3-day forecast from JSON and save to database'

    def handle(self, *args, **kwargs):
        file_path = os.path.join(settings.BASE_DIR, 'ml_model', 'forecast_3day.json')

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f"❌ File not found: {file_path}"))
            return

        with open(file_path, 'r') as f:
            data = json.load(f)

        for entry in data:
            date = datetime.strptime(entry['date'], "%Y-%m-%d").date()

            # Avoid duplicates
            if Forecast3Day.objects.filter(date=date).exists():
                self.stdout.write(self.style.WARNING(f"⚠️ Forecast for {date} already exists. Skipping."))
                continue

            Forecast3Day.objects.create(
                date=date,
                kp_index=entry['kp_index'],
                solar_radiation=entry['solar_radiation'],
                radio_blackout=entry['radio_blackout'],
                rationale_geomagnetic=entry['rationale_geomagnetic'],
                rationale_radiation=entry['rationale_radiation'],
                rationale_blackout=entry['rationale_blackout']
            )

            self.stdout.write(self.style.SUCCESS(f"✅ Saved forecast for {date}"))

        self.stdout.write(self.style.SUCCESS("✅ All forecasts saved successfully."))
