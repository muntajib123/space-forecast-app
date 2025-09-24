import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
} from "@mui/material";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * ForecastGraphs
 *
 * Expects `data` array of forecast objects. The component normalizes fields
 * into: { date, kp, ap, solar, rb_r1, rb_r3 } and draws four charts.
 */

export default function ForecastGraphs({ data = [] }) {
  const theme = useTheme();

  // normalize an item into the fields our charts expect
  const normalizeItem = (item = {}) => {
    // date label: prefer dateLabel, parsedDate, then fallback to other fields
    let dateLabel = item.dateLabel ?? item.date ?? item.dt ?? item.parsedDate ?? "";
    try {
      if (dateLabel instanceof Date) {
        dateLabel = dateLabel.toDateString().slice(4); // "Sep 21 2025"
      } else {
        const d = new Date(dateLabel);
        if (!Number.isNaN(d.getTime())) dateLabel = d.toDateString().slice(4);
        else dateLabel = String(dateLabel);
      }
    } catch {
      dateLabel = String(dateLabel);
    }

    // Kp: try top-level numeric kp, arrays, or other keys
    let kp = null;
    if (item.kp != null && Number.isFinite(Number(item.kp))) {
      kp = Number(item.kp);
    } else if (Array.isArray(item.kp_index) && item.kp_index.length) {
      const nums = item.kp_index.map((n) => Number(n)).filter(Number.isFinite);
      kp = nums.length ? Math.max(...nums) : null;
    } else if (Array.isArray(item.kp) && item.kp.length) {
      const nums = item.kp.map((n) => Number(n)).filter(Number.isFinite);
      kp = nums.length ? Math.max(...nums) : null;
    } else if (item.kp_max != null && Number.isFinite(Number(item.kp_max))) {
      kp = Number(item.kp_max);
    } else if (item.kp_index != null && !Array.isArray(item.kp_index) && Number.isFinite(Number(item.kp_index))) {
      kp = Number(item.kp_index);
    }

    // Ap: prefer explicit or compute from kp (simple lookup)
    let ap = null;
    if (item.a_index != null && Number.isFinite(Number(item.a_index))) ap = Number(item.a_index);
    else if (item.ap != null && Number.isFinite(Number(item.ap))) ap = Number(item.ap);
    else if (item.ap_index != null && Number.isFinite(Number(item.ap_index))) ap = Number(item.ap_index);
    else if (kp != null) {
      const table = { 0: 0, 1: 4, 2: 7, 3: 15, 4: 27, 5: 48, 6: 80, 7: 132, 8: 224, 9: 400 };
      ap = table[Math.round(kp)] ?? null;
    }

    // Solar radiation: many possible properties
    let solar = null;
    if (Array.isArray(item.solar_radiation) && item.solar_radiation.length) {
      const v = Number(item.solar_radiation[0]);
      solar = Number.isFinite(v) ? v : null;
    } else if (item.solar_radiation != null) {
      if (typeof item.solar_radiation === "object") {
        const vals = Object.values(item.solar_radiation).map(Number).filter(Number.isFinite);
        solar = vals.length ? vals[0] : null;
      } else {
        const v = Number(item.solar_radiation);
        solar = Number.isFinite(v) ? v : null;
      }
    } else if (item.radio_flux != null && Number.isFinite(Number(item.radio_flux))) {
      solar = Number(item.radio_flux);
    } else if (item.solar != null && Number.isFinite(Number(item.solar))) {
      solar = Number(item.solar);
    }

    // Radio blackout numeric values (attempt to extract numeric counts or percentages)
    let rb_r1 = null;
    let rb_r3 = null;
    const rb = item.radio_blackout ?? item.radio ?? item.radio_blackout_obj ?? null;
    if (rb != null) {
      if (typeof rb === "object") {
        let r1 =
          rb["R1-R2"] ??
          rb["R1_R2"] ??
          rb.r1_r2 ??
          rb.r1 ??
          rb["R1 or greater"] ??
          null;
        let r3 =
          rb["R3 or greater"] ?? rb["R3_or_greater"] ?? rb.r3 ?? rb["R3+"] ?? null;

        if (typeof r1 === "string" && r1.includes("%")) {
          r1 = Number(r1.replace("%", "").trim());
        } else {
          r1 = r1 != null ? Number(r1) : null;
        }
        if (!Number.isFinite(r1)) r1 = null;

        if (typeof r3 === "string" && r3.includes("%")) {
          r3 = Number(r3.replace("%", "").trim());
        } else {
          r3 = r3 != null ? Number(r3) : null;
        }
        if (!Number.isFinite(r3)) r3 = null;

        rb_r1 = r1;
        rb_r3 = r3;
      } else {
        const n = Number(rb);
        if (Number.isFinite(n)) {
          rb_r1 = n;
          rb_r3 = null;
        }
      }
    }

    return {
      date: dateLabel,
      kp: Number.isFinite(kp) ? kp : null,
      ap: Number.isFinite(ap) ? ap : null,
      solar: Number.isFinite(solar) ? solar : null,
      rb_r1: Number.isFinite(rb_r1) ? rb_r1 : null,
      rb_r3: Number.isFinite(rb_r3) ? rb_r3 : null,
    };
  };

  // Build chart data (use first 20 items max)
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.slice(0, 20).map(normalizeItem);
  }, [data]);

  const numOrDash = (v) => (v == null ? "—" : typeof v === "number" ? v : String(v));

  // Colors / style
  const blueMain = "#1976d2";
  const purpleMain = "#8e24aa";
  const greenMain = "#388e3c";
  const redMain = "#d32f2f";
  const grayGrid = "#e6e6e6";
  const axisStroke = "#666";

  if (!chartData || chartData.length === 0) {
    return null;
  }

  // Safe itemSorter used in tooltips: converts values to numbers and handles undefined
  const safeItemSorter = (a, b) => {
    const av = Number(a?.value ?? -Infinity);
    const bv = Number(b?.value ?? -Infinity);
    return bv - av; // descending (highest first)
  };

  // shared tick props for better readability
  const axisTick = { fontSize: 13, fill: theme.palette.text.primary };

  return (
    <Box sx={{ mt: 4, px: 2 }}>
      {/* Kp Index */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0px 6px 16px rgba(0,0,0,0.08)" }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              background: "linear-gradient(90deg,#1976d2,#42a5f5)",
              color: "#fff",
              px: 2,
              py: 1,
              borderRadius: 2,
              mb: 2,
              fontWeight: 700,
            }}
          >
            🛰️ Kp Index Forecast
          </Typography>

          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={grayGrid} />
                <XAxis dataKey="date" stroke={axisStroke} tick={axisTick} />
                <YAxis domain={[0, 10]} stroke={axisStroke} tick={axisTick} />
                <Tooltip
                  formatter={(value, name) => [value == null ? "—" : value, name]}
                  itemSorter={safeItemSorter}
                  wrapperStyle={{ borderRadius: 8, fontSize: 13, padding: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="kp"
                  stroke={blueMain}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Kp"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Ap Index */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0px 6px 16px rgba(0,0,0,0.08)" }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              background: "linear-gradient(90deg,#8e24aa,#ba68c8)",
              color: "#fff",
              px: 2,
              py: 1,
              borderRadius: 2,
              mb: 2,
              fontWeight: 700,
            }}
          >
            📊 Ap Index Forecast
          </Typography>

          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={grayGrid} />
                <XAxis dataKey="date" stroke={axisStroke} tick={axisTick} />
                <YAxis stroke={axisStroke} tick={axisTick} />
                <Tooltip
                  formatter={(v, n) => [numOrDash(v), n]}
                  itemSorter={safeItemSorter}
                  wrapperStyle={{ borderRadius: 8, fontSize: 13, padding: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="ap"
                  stroke={purpleMain}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Ap"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Solar Radiation */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0px 6px 16px rgba(0,0,0,0.08)" }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              background: "linear-gradient(90deg,#2e7d32,#66bb6a)",
              color: "#fff",
              px: 2,
              py: 1,
              borderRadius: 2,
              mb: 2,
              fontWeight: 700,
            }}
          >
            ☀️ Solar Radiation Forecast
          </Typography>

          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={grayGrid} />
                <XAxis dataKey="date" stroke={axisStroke} tick={axisTick} />
                <YAxis stroke={axisStroke} tick={axisTick} />
                <Tooltip
                  formatter={(v) => [numOrDash(v), "Solar"]}
                  itemSorter={safeItemSorter}
                  wrapperStyle={{ borderRadius: 8, fontSize: 13, padding: 8 }}
                />
                <Bar dataKey="solar" fill={greenMain} name="Solar Radiation" barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Radio Blackout (R1-R2 and R3+) */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: "0px 6px 16px rgba(0,0,0,0.08)" }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{
              background: "linear-gradient(90deg,#d32f2f,#ef5350)",
              color: "#fff",
              px: 2,
              py: 1,
              borderRadius: 2,
              mb: 2,
              fontWeight: 700,
            }}
          >
            📡 Radio Blackout Forecast
          </Typography>

          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rbGrad1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor={redMain} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={redMain} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rbGrad2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#b71c1c" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#b71c1c" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={grayGrid} />
                <XAxis dataKey="date" stroke={axisStroke} tick={axisTick} />
                <YAxis stroke={axisStroke} tick={axisTick} />
                <Tooltip
                  formatter={(v, name) => [v == null ? "—" : v, name]}
                  itemSorter={safeItemSorter}
                  wrapperStyle={{ borderRadius: 8, fontSize: 13, padding: 8 }}
                />
                <Area
                  dataKey="rb_r1"
                  name="R1-R2"
                  stroke={redMain}
                  fill="url(#rbGrad1)"
                  fillOpacity={0.8}
                />
                <Area
                  dataKey="rb_r3"
                  name="R3+"
                  stroke="#b71c1c"
                  fill="url(#rbGrad2)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
