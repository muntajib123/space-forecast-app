// src/components/ForecastSummary.js

import React from "react";
import {
  Card,
  CardContent,
  Typography,
} from "@mui/material";

const ForecastSummary = ({ data, kpBreakdown }) => {
  if (!data || data.length < 3 || kpBreakdown.length !== 24) return null;

  const [day1, day2, day3] = data;
  const issuedDate = new Date().toUTCString().slice(0, 16);
  const year = new Date().getFullYear();

  const formatKp = (val) => val.toFixed(2).padStart(6, " ");
  const formatDate = (date) => {
    if (!date || typeof date !== "string") return "Invalid";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
    });
  };

  const utSlots = [
    "00-03UT", "03-06UT", "06-09UT", "09-12UT",
    "12-15UT", "15-18UT", "18-21UT", "21-00UT"
  ];

  const kpMatrix = [
    kpBreakdown.slice(0, 8),
    kpBreakdown.slice(8, 16),
    kpBreakdown.slice(16, 24),
  ];

  const maxKp = Math.max(...kpBreakdown).toFixed(2);

  return (
    <Card
      sx={{
        mt: 4,
        backgroundColor: "#1a1a1a",
        color: "#fff",
        padding: 2,
        whiteSpace: "pre-wrap",
        boxShadow: 3
      }}
    >
      <CardContent>
        <Typography
          variant="body2"
          component="div"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.95rem",
            color: "#d1d5db"
          }}
        >
{`
:Product: 3-Day Space Weather Forecast
:Issued: ${issuedDate} UTC

A. Geomagnetic Activity Observation and Forecast

The greatest expected 3 hr Kp for ${formatDate(day1.date)}–${formatDate(day3.date)} ${year} is ${maxKp}.

Kp Index Breakdown: ${formatDate(day1.date)}–${formatDate(day3.date)} ${year}

                ${day1.date.padEnd(18)}${day2.date.padEnd(18)}${day3.date}
${utSlots.map((slot, i) =>
  `${slot.padEnd(16)}${formatKp(kpMatrix[0][i])}               ${formatKp(kpMatrix[1][i])}               ${formatKp(kpMatrix[2][i])}`
).join("\n")}

Rationale: Based on ML forecast, geomagnetic activity is expected to vary through the period.

B. Solar Radiation Activity Observation and Forecast

Solar Radiation Storm Forecast: ${formatDate(day1.date)}–${formatDate(day3.date)} ${year}

                  ${formatDate(day1.date)}     ${formatDate(day2.date)}     ${formatDate(day3.date)}
S1 or greater     10%            5%            5%

Rationale: Solar activity is predicted to remain below major storm thresholds.

C. Radio Blackout Activity and Forecast

Radio Blackout Forecast: ${formatDate(day1.date)}–${formatDate(day3.date)} ${year}

                  ${formatDate(day1.date)}     ${formatDate(day2.date)}     ${formatDate(day3.date)}
R1-R2             25%            25%           25%
R3 or greater      5%             5%            5%

Rationale: Elevated background X-ray flux levels suggest a chance of R1–R2 events.
`}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ForecastSummary;
