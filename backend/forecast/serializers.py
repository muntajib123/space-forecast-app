# backend/forecast/serializers.py

from rest_framework import serializers
from .models import Forecast3Day
import json
from collections import OrderedDict

class Forecast3DaySerializer(serializers.ModelSerializer):
    # Override the fields that are sometimes stored as strings
    kp_index = serializers.SerializerMethodField()
    solar_radiation = serializers.SerializerMethodField()
    radio_blackout = serializers.SerializerMethodField()

    class Meta:
        model = Forecast3Day
        fields = '__all__'

    def get_kp_index(self, obj):
        try:
            return json.loads(obj.kp_index) if isinstance(obj.kp_index, str) else obj.kp_index
        except Exception:
            return []

    def get_solar_radiation(self, obj):
        try:
            return json.loads(obj.solar_radiation) if isinstance(obj.solar_radiation, str) else obj.solar_radiation
        except Exception:
            return []

    def get_radio_blackout(self, obj):
        try:
            if isinstance(obj.radio_blackout, str):
                cleaned = obj.radio_blackout.replace("OrderedDict", "").replace("(", "").replace(")", "")
                return dict(eval(cleaned))  # ✅ safe because we control the format
            return obj.radio_blackout
        except Exception:
            return {}
