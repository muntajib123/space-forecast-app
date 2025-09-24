// src/components/ForecastSummary.js
// NOAA-style textual report for the 3-day forecast.
// Uses exact dates returned by backend (prefers rawData; falls back to forecast prop).

import React from "react";
import { Card, CardContent, Typography, Box, Button } from "@mui/material";

const slotLabels = [
  "00-03UT",
  "03-06UT",
  "06-09UT",
  "09-12UT",
  "12-15UT",
  "15-18UT",
  "18-21UT",
  "21-00UT",
];

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

const safeNumber = (v) => {
  if (v === null || v === undefined) return null;
  if (isFiniteNumber(v)) return v;
  if (Array.isArray(v) && v.length === 1) return safeNumber(v[0]);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* robust date parsing */
const parseToDateObj = (val) => {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  const s = String(val).trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    const dt = new Date(s + "Z");
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const dt = new Date(n);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toISODateKey = (val) => {
  const d = parseToDateObj(val);
  return d ? d.toISOString().split("T")[0] : null;
};

const toArray8 = (val) => {
  if (Array.isArray(val)) {
    if (val.length === 1) return Array(8).fill(safeNumber(val[0]));
    const arr = val.slice(0, 8).map(safeNumber);
    while (arr.length < 8) arr.push(null);
    return arr;
  }
  if (val != null && typeof val === "object") {
    return slotLabels.map((lab, i) => safeNumber(val[lab] ?? val[i] ?? val[String(i)] ?? null));
  }
  if (val != null) {
    return Array(8).fill(safeNumber(val));
  }
  return Array(8).fill(null);
};

export default function ForecastSummary({ rawData = [], forecast = [] }) {
  // Prefer rawData from backend; fallback to forecast prop
  const source = Array.isArray(rawData) && rawData.length ? rawData : Array.isArray(forecast) ? forecast : [];

  // Normalize and sort by date (ascending)
  const normalized = (source || [])
    .map((it) => {
      const iso = toISODateKey(it?.date ?? it?.dt ?? it?.issued ?? it?.date_string ?? it?.timestamp ?? it?._id?.$date ?? it?._id);
      const parsed = parseToDateObj(iso);
      return { raw: it, iso, parsed };
    })
    .filter((x) => x.iso && x.parsed instanceof Date)
    .sort((a, b) => a.parsed - b.parsed);

  // Use first 3 items from backend (if less than 3, pad with null entries)
  const selected = [];
  for (let i = 0; i < 3; i++) {
    if (i < normalized.length) {
      const item = normalized[i];
      selected.push(item.raw);
    } else {
      selected.push(null);
    }
  }

  // Build days array using exact backend items
  const days = selected.map((item) => {
    if (!item) {
      return {
        isoDate: null,
        prettyDate: null,
        kpArray: Array(8).fill(null),
        solar: null,
        radio: null,
      };
    }

    const isoDate = toISODateKey(item?.date ?? item?.dt ?? item?.issued ?? item?.date_string ?? item?.timestamp ?? item?._id?.$date ?? item?._id);
    let prettyDate = isoDate;
    try {
      const d = parseToDateObj(isoDate);
      if (d) prettyDate = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      /* ignore */
    }

    const kpArray = toArray8(item?.kp_index ?? item?.kp ?? null);

    let solarVal = null;
    if (Array.isArray(item?.solar_radiation) && item.solar_radiation.length) {
      solarVal = safeNumber(item.solar_radiation[0]);
    } else if (item?.solar_radiation != null) {
      solarVal = safeNumber(item.solar_radiation);
    } else if (item?.radio_flux != null) {
      // fallback: some backends use radio_flux which is a numeric proxy
      solarVal = safeNumber(item.radio_flux);
    }

    const radio = item?.radio_blackout ?? item?.radio ?? null;

    return {
      isoDate,
      prettyDate,
      kpArray,
      solar: solarVal,
      radio,
    };
  });

  // Build NOAA-like plaintext report
  const buildReportText = () => {
    const lines = [];
    const labelWidth = 18;
    const colWidth = 12;

    lines.push(":Product: 3-Day Forecast");
    lines.push(`:Issued: ${new Date().toUTCString()}`);
    lines.push("# Prepared by the U.S. Dept. of Commerce, NOAA, Space Weather Prediction Center");
    lines.push("");
    lines.push("A. NOAA Geomagnetic Activity Observation and Forecast");
    lines.push("");
    lines.push("NOAA Kp index breakdown (next 3 days)");

    // header uses ISO dates (YYYY-MM-DD) so column alignment is stable
    let header = "".padEnd(labelWidth);
    days.forEach((d) => (header += (d.isoDate || "").padStart(colWidth)));
    lines.push(header);

    for (let s = 0; s < slotLabels.length; s++) {
      let row = slotLabels[s].padEnd(labelWidth);
      days.forEach((d) => {
        const v = d.kpArray[s];
        row += (v == null ? "—" : Number(v).toFixed(2)).padStart(colWidth);
      });
      lines.push(row);
    }

    lines.push("");
    lines.push("B. NOAA Solar Radiation Activity Observation and Forecast");
    let solarHeader = "".padEnd(labelWidth);
    days.forEach((d) => (solarHeader += (d.isoDate || "").padStart(colWidth)));
    lines.push(solarHeader);

    let sRow = "S1 or greater".padEnd(labelWidth);
    days.forEach((d) => {
      const s = d.solar;
      sRow += (s == null ? "N/A" : Number(s).toFixed(2)).padStart(colWidth);
    });
    lines.push(sRow);

    lines.push("");
    lines.push("C. NOAA Radio Blackout Activity and Forecast");
    let rbHeader = "".padEnd(labelWidth);
    days.forEach((d) => (rbHeader += (d.isoDate || "").padStart(colWidth)));
    lines.push(rbHeader);

    let r1 = "R1-R2".padEnd(labelWidth);
    let r3 = "R3 or greater".padEnd(labelWidth);
    days.forEach((d) => {
      const rb = d.radio ?? {};
      r1 += String(rb["R1-R2"] ?? rb.R1_R2 ?? rb.r1 ?? "N/A").padStart(colWidth);
      r3 += String(rb["R3 or greater"] ?? rb.R3 ?? rb.r3 ?? rb["R3+"] ?? "N/A").padStart(colWidth);
    });
    lines.push(r1);
    lines.push(r3);

    lines.push("");
    lines.push("Rationale: This report is auto-generated. See component details for source fields.");
    return lines.join("\n");
  };

  const reportText = buildReportText();

  const downloadTxt = () => {
    const startIso = days[0]?.isoDate ?? new Date().toISOString().slice(0, 10);
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `space-forecast-${startIso}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box mt={2}>
      <Card sx={{ borderRadius: 3, boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              mb: 1,
              fontSize: { xs: "1rem", sm: "1.1rem", md: "1.15rem" },
            }}
          >
            Forecast Report (NOAA Style)
          </Typography>

          <Box sx={{ background: "#fafafa", borderRadius: 1, p: 2 }}>
            <pre
              style={{
                fontFamily: "Courier New, monospace",
                fontSize: "1.05rem",
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#222",
              }}
            >
              {reportText}
            </pre>
          </Box>

          <Box mt={2} display="flex" justifyContent="flex-end">
            <Button variant="contained" onClick={downloadTxt}>
              Download TXT
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
