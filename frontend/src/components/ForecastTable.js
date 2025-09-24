// frontend/src/components/ForecastTable.js
import React, { useEffect, useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from "@mui/material";
import fetch3DayForecast from "../api"; // ✅ default import (not destructured)

// ----------------- helpers -----------------
const safeNumber = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseToDateObj = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return new Date(s + "Z");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toISODateKey = (val) => {
  const d = parseToDateObj(val);
  if (!d) return null;
  return d.toISOString().split("T")[0];
};

const formatDate = (d) => {
  const dt = parseToDateObj(d);
  if (!dt) return String(d || "");
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const parseKPArray = (item) => {
  const candidates = [item?.kp_index, item?.kp, item?.kp_values, item?.kp_series];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      const nums = c.map(Number).filter(Number.isFinite);
      return nums;
    }
  }
  const scalar =
    safeNumber(item?.kp_index) ??
    safeNumber(item?.kp) ??
    safeNumber(item?.kp_value) ??
    safeNumber(item?.kp_val) ??
    null;
  return scalar != null ? [scalar] : [];
};

const parseAp = (item, kpMax) => {
  const explicit = safeNumber(item?.a_index ?? item?.ap ?? item?.ap_index ?? null);
  if (explicit != null) return explicit;
  if (kpMax != null) {
    const table = { 0: 0, 1: 4, 2: 7, 3: 15, 4: 27, 5: 48, 6: 80, 7: 132, 8: 224, 9: 400 };
    const key = Math.round(kpMax);
    return table[key] ?? null;
  }
  return null;
};

const parseSolar = (item) => {
  if (Array.isArray(item?.solar_radiation) && item.solar_radiation.length) {
    return safeNumber(item.solar_radiation[0]) ?? null;
  }
  if (item?.solar_radiation != null) {
    if (typeof item.solar_radiation === "object") {
      const vals = Object.values(item.solar_radiation);
      return vals.length ? safeNumber(vals[0]) : null;
    }
    return safeNumber(item.solar_radiation);
  }
  if (item?.radio_flux != null) return safeNumber(item.radio_flux);
  if (item?.solar != null) return safeNumber(item.solar);
  return null;
};

const parseRadioBlackout = (item) => {
  const rb = item?.radio_blackout ?? item?.radio ?? item?.radio_blackout_obj ?? null;
  if (!rb) return null;
  if (typeof rb === "object") {
    const r1 = rb["R1-R2"] ?? rb["R1_R2"] ?? rb.r1_r2 ?? rb.r1 ?? null;
    const r3 = rb["R3 or greater"] ?? rb["R3_or_greater"] ?? rb.r3 ?? rb["R3+"] ?? null;
    return {
      r1: r1 != null ? String(r1) : "N/A",
      r3: r3 != null ? String(r3) : "N/A",
      text: `R1-R2: ${r1 != null ? r1 : "N/A"}, R3+: ${r3 != null ? r3 : "N/A"}`,
    };
  }
  return { r1: String(rb), r3: "N/A", text: String(rb) };
};

// ----------------- component -----------------
const ForecastTable = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const resp = await fetch3DayForecast();
        const rawArr = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];

        // Build map by ISO date
        const predMap = new Map();
        rawArr.forEach((item) => {
          const key = toISODateKey(item?.date ?? item?.dt ?? item?.issued ?? null);
          if (key) predMap.set(key, item);
        });

        // Find max date in backend
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
        const days = [];
        for (let i = 0; i < 3; i++) {
          days.push(new Date(startDate.getTime() + i * oneDayMs));
        }

        const normalized = days.map((d) => {
          const key = d.toISOString().split("T")[0];
          const item = predMap.get(key) ?? null;
          const kpArr = item ? parseKPArray(item) : [];
          const kpMax = kpArr.length ? Math.max(...kpArr) : null;
          const kpDisplay = kpArr.length > 0 ? kpArr.map((n) => Number(n).toFixed(2)).join(", ") : "N/A";

          const ap = item ? parseAp(item, kpMax) : null;
          const solar = item ? parseSolar(item) : null;
          const rb = item ? parseRadioBlackout(item) : null;

          return {
            date: formatDate(d),
            kp_index: kpDisplay,
            kp_max: kpMax,
            ap_index: ap != null ? Number(ap).toFixed(2) : "N/A",
            solar: solar != null ? Number(solar).toFixed(2) : "N/A",
            radio_blackout: rb ? rb.text : "N/A",
          };
        });

        if (mounted) setRows(normalized);
      } catch (err) {
        console.error("❌ Error in ForecastTable load:", err);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ py: 6, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Typography variant="h6">Loading forecast…</Typography>
      </Box>
    );
  }

  if (!rows.length) {
    return (
      <Box sx={{ py: 6, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Typography variant="h6">No forecast data available.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2, display: "flex", justifyContent: "center" }}>
      <TableContainer
        component={Paper}
        sx={{
          width: "95%",
          maxWidth: 1000,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.98)",
          boxShadow: "0px 6px 20px rgba(0,0,0,0.08)",
        }}
      >
        <Typography
          variant="h5"
          align="center"
          sx={{
            py: 2,
            background: "linear-gradient(90deg, #1976d2, #42a5f5)",
            color: "#fff",
            fontWeight: "bold",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
          }}
        >
          🚀 3-Day Space Weather Forecast
        </Typography>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "rgba(0,0,0,0.03)" }}>
              <TableCell sx={{ fontWeight: "bold" }}>📅 Date</TableCell>
              <TableCell sx={{ fontWeight: "bold", textAlign: "center" }}>🌌 Kp Index</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>📊 Ap Index</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>☀️ Solar Radiation</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>📡 Radio Blackout</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, idx) => {
              const kpMax = row.kp_max;
              const color =
                kpMax === null ? "#000" : kpMax >= 6 ? "#d32f2f" : kpMax >= 4 ? "#f57c00" : "#388e3c";

              return (
                <TableRow
                  key={idx}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent",
                    "&:hover": { backgroundColor: "rgba(25,118,210,0.06)" },
                  }}
                >
                  <TableCell sx={{ fontSize: "0.95rem", fontWeight: 600 }}>{row.date}</TableCell>
                  <TableCell sx={{ textAlign: "center", fontSize: "0.95rem" }}>{row.kp_index}</TableCell>
                  <TableCell sx={{ fontSize: "0.95rem" }}>{row.ap_index}</TableCell>
                  <TableCell sx={{ fontSize: "0.95rem" }}>{row.solar}</TableCell>
                  <TableCell sx={{ fontSize: "0.95rem", color }}>{row.radio_blackout}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ForecastTable;
