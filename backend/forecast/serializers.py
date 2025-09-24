# backend/forecast/serializers.py
from rest_framework import serializers
from .models import Forecast3Day
import json
import ast

class Forecast3DaySerializer(serializers.ModelSerializer):
    kp_index = serializers.SerializerMethodField()
    solar_radiation = serializers.SerializerMethodField()
    radio_blackout = serializers.SerializerMethodField()

    class Meta:
        model = Forecast3Day
        fields = '__all__'

    def _safe_load(self, val, fallback):
        if val is None:
            return fallback
        if isinstance(val, (list, dict)):
            return val
        if isinstance(val, str):
            # try JSON first, then ast literal_eval, else fallback
            try:
                return json.loads(val)
            except Exception:
                try:
                    return ast.literal_eval(val)
                except Exception:
                    return fallback
        return fallback

    def get_kp_index(self, obj):
        return self._safe_load(obj.kp_index, [])

    def get_solar_radiation(self, obj):
        return self._safe_load(obj.solar_radiation, [])

    def get_radio_blackout(self, obj):
        return self._safe_load(obj.radio_blackout, {})
