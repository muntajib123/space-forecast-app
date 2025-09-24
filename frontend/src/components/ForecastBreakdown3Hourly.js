// frontend/src/components/ForecastBreakdown3Hourly.js
import React from "react";
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Typography,
  Card,
  CardContent,
} from "@mui/material";

/**
 * ForecastBreakdown3Hourly
 *
 * Props:
 *  - rawData: array of backend docs (NOAA-ingested + seeded docs)
 *
 * This component computes the 3 target days as (max backend date) + 1, +2, +3
 * and shows 3-hourly Kp / Ap tables. It tolerates multiple input shapes.
 */

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

const safeNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseToDateObj = (val) => {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;

  // If it's an object like {_id: { $date: "2025-09-23T00:00:00Z" }}
  if (typeof val === "object") {
    // try common mongo-style
    if (val?._id && typeof val._id === "object" && val._id.$date) {
      const d = new Date(val._id.$date);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (val.$date) {
      const d = new Date(val.$date);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // sometimes docs include date fields inside object; skip here
  }

  const s = String(val).trim();

  // YYYY-MM-DDTHH:MM:SS (no timezone) -> treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    const dt = new Date(s + "Z");
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // YYYY-MM-DD -> UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // numeric timestamp (ms)
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const dt = new Date(n);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // fallback to Date parse (handles ISO with Z)
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toISODateKey = (val) => {
  const d = parseToDateObj(val);
  return d ? d.toISOString().split("T")[0] : null;
};

const normalize = (series) => {
  if (series == null) return Array(8).fill(null);

  if (Array.isArray(series)) {
    if (series.length === 1) return Array(8).fill(safeNum(series[0]));
    const arr = series.slice(0, 8).map((v) => safeNum(v));
    while (arr.length < 8) arr.push(null);
    return arr;
  }

  if (typeof series === "number" || typeof series === "string") {
    const v = safeNum(series);
    return Array(8).fill(v);
  }

  if (typeof series === "object") {
    return slotLabels.map((lab, i) => {
      // Accept keyed fields like "00-03UT" or numeric keys 0..7
      const candidate = series[lab] ?? series[i] ?? series[String(i)] ?? series[lab.replace("-", "_")] ?? null;
      return safeNum(candidate);
    });
  }

  return Array(8).fill(null);
};

export default function ForecastBreakdown3Hourly({ rawData = [] }) {
  // Build map by date
  const predMap = new Map();
  (rawData || []).forEach((d) => {
    const key =
      toISODateKey(d?.date ?? d?.dt ?? d?.issued ?? d?.timestamp ?? d?.date_string ?? d?._id?.$date ?? d?._id) ??
      toISODateKey(d);
    if (key) predMap.set(key, d);
  });

  console.debug("[ForecastBreakdown3Hourly] backend items:", Array.from(predMap.keys()));

  // Find max backend date
  let maxTs = null;
  predMap.forEach((_, key) => {
    const d = parseToDateObj(key);
    if (!d) return;
    const t = d.getTime();
    if (maxTs === null || t > maxTs) maxTs = t;
  });

  const oneDayMs = 24 * 60 * 60 * 1000;
  let startDate;
  if (maxTs !== null) {
    startDate = new Date(maxTs + oneDayMs);
  } else {
    const today = new Date();
    const utcMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    startDate = new Date(utcMidnight.getTime() + oneDayMs);
  }

  // Generate 3 consecutive days
  const daysToShow = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(startDate.getTime() + i * oneDayMs);
    const key = d.toISOString().split("T")[0];
    const raw = predMap.get(key) ?? {};
    daysToShow.push({
      title: `Day ${i + 1}`,
      date: d.toDateString().slice(4),
      raw,
    });
  }

  const kpDayArrays = daysToShow.map((d) =>
    normalize(d.raw?.kp_3hourly ?? d.raw?.kp_series ?? d.raw?.kp_index ?? d.raw?.kp ?? [])
  );
  const apDayArrays = daysToShow.map((d) =>
    normalize(d.raw?.ap_3hourly ?? d.raw?.ap_series ?? d.raw?.a_index ?? d.raw?.ap ?? [])
  );

  const buildRows = (dayArrays) =>
    slotLabels.map((slot, i) => ({
      slot,
      values: dayArrays.map((arr) => (arr && arr[i] != null ? arr[i] : null)),
    }));

  const kpRows = buildRows(kpDayArrays);
  const apRows = buildRows(apDayArrays);

  const allNullKP = kpRows.every((r) => r.values.every((v) => v == null));
  const allNullAP = apRows.every((r) => r.values.every((v) => v == null));

  if (allNullKP && allNullAP) return null;

  const cellFont = { xs: "0.95rem", sm: "1rem", md: "1.05rem" };
  const headerFont = { xs: "0.98rem", sm: "1.05rem", md: "1.1rem" };
  const captionFont = { xs: "0.75rem", sm: "0.85rem", md: "0.9rem" };

  const renderTable = (rows, label) => (
    <Card sx={{ mb: 4, borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800, fontSize: headerFont }}>
          {label}
        </Typography>

        <TableContainer component={Paper} sx={{ boxShadow: "none" }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: cellFont,
                    width: 140,
                    bgcolor: "#fafafa",
                  }}
                >
                  UT
                </TableCell>
                {daysToShow.map((d, i) => (
                  <TableCell key={i} align="center" sx={{ fontWeight: 700, fontSize: cellFont, bgcolor: "#fafafa" }}>
                    <Box>
                      <Box sx={{ fontSize: cellFont }}>{d.title}</Box>
                      <Typography component="div" sx={{ fontSize: captionFont, color: "#666", mt: 0.5 }}>
                        {d.date}
                      </Typography>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx} sx={{ "& > *": { py: 1.25 } }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: cellFont }}>{row.slot}</TableCell>
                  {row.values.map((v, j) => (
                    <TableCell key={j} align="center" sx={{ fontSize: cellFont }}>
                      {v == null ? "—" : Number(v).toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {!allNullKP && renderTable(kpRows, "3-Hourly Kp Index Forecast")}
      {!allNullAP && renderTable(apRows, "3-Hourly Ap Index Forecast")}
    </Box>
  );
}
