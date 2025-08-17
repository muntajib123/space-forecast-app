from djongo import models

class Forecast3Day(models.Model):
    date = models.DateField()

    kp_index = models.JSONField(default=list)
    solar_radiation = models.JSONField(default=list)
    radio_blackout = models.JSONField(default=dict)

    rationale_geomagnetic = models.TextField()
    rationale_radiation = models.TextField()
    rationale_blackout = models.TextField()

    def __str__(self):
        return f"Forecast for {self.date}"
