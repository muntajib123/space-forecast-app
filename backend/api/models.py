# backend/api/models.py
from djongo import models  # or from django.db import models, depending on setup

class Forecast3Day(models.Model):
    date = models.DateField()
    radio_flux = models.FloatField()
    a_index = models.IntegerField()
    kp_index = models.IntegerField()

    def __str__(self):
        return f"{self.date} | Kp: {self.kp_index}, A: {self.a_index}, Flux: {self.radio_flux}"
