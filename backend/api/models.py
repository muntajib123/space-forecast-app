# backend/api/models.py
from djongo import models


class Forecast3Day(models.Model):
    """
    Model representing a 3-day space weather forecast record.
    Stored in MongoDB Atlas (collection = forecast_forecast3day).
    """

    date = models.DateField()
    radio_flux = models.FloatField()
    a_index = models.IntegerField()
    kp_index = models.IntegerField()

    class Meta:
        db_table = "forecast_forecast3day"  # explicitly set collection name

    def __str__(self):
        return f"{self.date} | Kp: {self.kp_index}, A: {self.a_index}, Flux: {self.radio_flux}"
