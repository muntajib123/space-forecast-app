// frontend/src/components/ForecastSummary.js
import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";

const ForecastSummary = ({ data = [], kpBreakdown = [] }) => {
  // if no data or kpBreakdown insufficient, still render a simple summary card
  if (!data || data.length < 1) return null;

  // ensure kpBreakdown is 24-length array; if shorter, pad with zeros
  const kpArr = Array.isArray(kpBreakdown) ? kpBreakdown.slice(0, 24) : [];
  while (kpArr.length < 24) kpArr.push(0);

  const [day1, day2 = {}, day3 = {}] = data;
  const issuedDate = new Date().toUTCString().slice(0, 16);
  const year = new Date().getFullYear();

  const formatKpCell = (val) =>
    val === null || val === undefined || Number.isNaN(Number(val))
      ? " N/A"
      : Number(val).toFixed(2).padStart(6, " ");

  const formatDate = (date) => {
    if (!date) return "Invalid";
    const d = new Date(date);
    return isNaN(d) ? String(date) : d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  };

  const utSlots = [
    "00-03UT", "03-06UT", "06-09UT", "09-12UT",
    "12-15UT", "15-18UT", "18-21UT", "21-00UT"
  ];

  const kpMatrix = [
    kpArr.slice(0, 8),
    kpArr.slice(8, 16),
    kpArr.slice(16, 24),
  ];

  const maxKp =
    kpArr.length > 0 ? Math.max(...kpArr.filter((v) => typeof v === "number" && !isNaN(v))) : 0;

  return (
    <Card sx={{ mt: 4, backgroundColor: "#fafafa", color: "#000", p: 3, boxShadow: 4, borderRadius: 3 }}>
      <CardContent>
        <Typography variant="body2" component="div" sx={{ fontFamily: "monospace", fontSize: "1rem", whiteSpace: "pre-wrap", color: "#222", lineHeight: 1.6 }}>
{`
:Product: 3-Day Space Weather Forecast
:Issued: ${issuedDate} UTC

A. Geomagnetic Activity Observation and Forecast

The greatest expected 3 hr Kp for ${formatDate(day1?.date)}–${formatDate(day3?.date)} ${year} is **${(maxKp || 0).toFixed(2)}**.

Kp Index Breakdown: ${formatDate(day1?.date)}–${formatDate(day3?.date)} ${year}
`}
        </Typography>

        <Box component="table" sx={{ width: "100%", mt: 2, mb: 3, borderCollapse: "collapse", fontFamily: "monospace", fontSize: "0.95rem" }}>
          <thead>
            <tr>
              <th></th>
              <th>{formatDate(day1?.date)}</th>
              <th>{formatDate(day2?.date)}</th>
              <th>{formatDate(day3?.date)}</th>
            </tr>
          </thead>
          <tbody>
            {utSlots.map((slot, i) => (
              <tr key={i}>
                <td style={{ padding: "4px 8px", fontWeight: 600 }}>{slot}</td>
                <td style={{ padding: "4px 8px" }}>{formatKpCell(kpMatrix[0][i])}</td>
                <td style={{ padding: "4px 8px" }}>{formatKpCell(kpMatrix[1][i])}</td>
                <td style={{ padding: "4px 8px" }}>{formatKpCell(kpMatrix[2][i])}</td>
              </tr>
            ))}
          </tbody>
        </Box>

        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "1rem", whiteSpace: "pre-wrap" }}>
{`
Rationale: Based on model forecast.

B. Solar Radiation Activity Observation and Forecast

Solar Radiation Storm Forecast: ${formatDate(day1?.date)}–${formatDate(day3?.date)} ${year}
`}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ForecastSummary;
