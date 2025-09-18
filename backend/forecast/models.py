# forecast/models.py
from djongo import models

class Forecast3Day(models.Model):
    """
    Single unified model for 3-day forecasts.
    Stored in MongoDB collection: forecast_forecast3day
    """
    date = models.DateField()

    # numeric/summary fields
    radio_flux = models.FloatField(null=True, blank=True)
    a_index = models.IntegerField(null=True, blank=True)

    # keep Kp as either single int or list depending on your use;
    # using JSONField to allow both (list of 3 values or single int)
    kp_index = models.JSONField(default=list, blank=True)

    # additional arrays / structured fields
    solar_radiation = models.JSONField(default=list, blank=True)
    radio_blackout = models.JSONField(default=dict, blank=True)

    # rationales / explanations
    rationale_geomagnetic = models.TextField(blank=True, default="")
    rationale_radiation = models.TextField(blank=True, default="")
    rationale_blackout = models.TextField(blank=True, default="")

    class Meta:
        db_table = "forecast_forecast3day"  # keep existing collection name

    def __str__(self):
        return f"Forecast for {self.date}"
