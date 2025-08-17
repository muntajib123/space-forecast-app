def generate_forecast_text(forecasts):
    """
    Generate a NOAA-style 3-day forecast string from DB objects.
    """

    if len(forecasts) != 3:
        return "Insufficient forecast data (need exactly 3 days)."

    # Format Dates
    date_strs = [forecast.date.strftime("%b %d") for forecast in forecasts]
    date_range = f"{date_strs[0]}-{date_strs[2]} 2025"

    header = (
        f":Product: 3-Day Forecast\n"
        f":Issued: {forecasts[0].date.strftime('%Y %b %d')} 1230 UTC\n"
        f"# Prepared by your Space Weather Forecast System\n"
        f"#\n"
    )

    # Section A: Geomagnetic Activity
    kp_table = "             " + "       ".join(date_strs) + "\n"
    hours = ["00-03UT", "03-06UT", "06-09UT", "09-12UT", "12-15UT", "15-18UT", "18-21UT", "21-00UT"]

    for i in range(8):
        row = f"{hours[i]:<12}"
        for forecast in forecasts:
            try:
                val = forecast.kp_index[i]
            except (IndexError, TypeError):
                val = 0.0
            suffix = " (G1)" if val >= 4.67 else ""
            row += f"{val:<6.2f}{suffix:<6}   "
        kp_table += row.rstrip() + "\n"

    section_a = (
        f"A. Geomagnetic Activity Forecast\n\n"
        f"The greatest expected 3 hr Kp for {date_range} is "
        f"{max(max(f.kp_index) for f in forecasts):.2f}.\n\n"
        f"Kp index breakdown {date_range}\n\n"
        f"{kp_table.strip()}\n"
        f"Rationale: {forecasts[0].rationale_geomagnetic}\n"
    )

    # Section B: Solar Radiation
    sr_table = "              " + "  ".join(date_strs) + "\n"
    sr_table += "S1 or greater "
    for forecast in forecasts:
        try:
            sr_table += f"{forecast.solar_radiation:.0f}%     "
        except (TypeError, ValueError):
            sr_table += "0%     "
    section_b = (
        f"\nB. Solar Radiation Activity Forecast\n\n"
        f"{sr_table.strip()}\n"
        f"Rationale: {forecasts[0].rationale_radiation}\n"
    )

    # Section C: Radio Blackout
    rb_table = "              " + "  ".join(date_strs) + "\n"
    rb_table += "R1-R2         "
    rb_table += "  ".join(f"{forecast.radio_blackout.get('R1-R2', 0)}%" for forecast in forecasts) + "\n"
    rb_table += "R3 or greater "
    rb_table += "  ".join(f"{forecast.radio_blackout.get('R3 or greater', 0)}%" for forecast in forecasts)

    section_c = (
        f"\nC. Radio Blackout Forecast\n\n"
        f"{rb_table.strip()}\n"
        f"Rationale: {forecasts[0].rationale_blackout}\n"
    )

    return header + section_a + section_b + section_c
