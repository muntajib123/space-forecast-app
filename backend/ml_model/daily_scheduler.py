import os
import sys
import django
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import time

# Django setup
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "forecast_project.settings")
django.setup()

from ml_model import run_all_forecasts  # This runs the seed + ML forecast logic

def job():
    print(f"🕒 Running scheduled job at {datetime.now()}")
    run_all_forecasts.run_daily_forecast()

if __name__ == "__main__":
    scheduler = BackgroundScheduler()
    scheduler.add_job(job, 'cron', hour=0, minute=0)  # Runs daily at midnight
    scheduler.start()

    print("✅ APScheduler started. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(3600)  # Keep the script alive
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("🛑 Scheduler stopped.")
