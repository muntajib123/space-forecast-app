// src/components/ForecastDisplay.js
import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
} from "@mui/material";

/* small helpers */
const isNumber = (v) => typeof v === "number" && !Number.isNaN(v);
const roundStr = (v, digits = 2) => (isNumber(v) ? Number(v).toFixed(digits) : "N/A");

const formatRadioBlackout = (rb) => {
  if (rb === null || rb === undefined) return "📡 None";
  if (typeof rb === "object") {
    const r1 = rb["R1-R2"] ?? rb.R1_R2 ?? rb.r1_r2 ?? rb.r1 ?? "N/A";
    const r3 = rb["R3 or greater"] ?? rb.R3 ?? rb.r3 ?? rb["R3+"] ?? "N/A";
    return `📡 R1-R2: ${r1}, R3+: ${r3}`;
  }
  return `📡 ${String(rb)}`;
};

function formatFullDate(d) {
  try {
    if (!d) return "N/A";
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

/**
 * Normalizes a single incoming item (either already-processed or raw normalized backend item)
 * into the canonical item shape used by the UI:
 * { idx, parsedDate: Date|null, dateLabel: string|null, kp, ap, solar, radio, raw }
 */
function normalizeIncomingItem(rawItem, idx) {
  // If the item already follows the processed shape (has kp/ap/solar), prefer those
  const alreadyProcessed = rawItem && (rawItem.kp !== undefined || rawItem.ap !== undefined || rawItem.solar !== undefined);

  if (alreadyProcessed) {
    const parsedDate = rawItem.parsedDate ? (rawItem.parsedDate instanceof Date ? rawItem.parsedDate : new Date(rawItem.parsedDate)) : rawItem.dateLabel ? new Date(rawItem.dateLabel) : null;
    return {
      idx: rawItem.idx ?? idx,
      parsedDate,
      dateLabel: rawItem.dateLabel ?? (parsedDate ? parsedDate.toISOString().slice(0, 10) : rawItem.date ?? null),
      kp: rawItem.kp ?? null,
      ap: rawItem.ap ?? null,
      solar: rawItem.solar ?? null,
      radio: rawItem.radio ?? rawItem.radio_blackout ?? null,
      raw: rawItem.raw ?? rawItem,
    };
  }

  // Otherwise assume it's a normalized backend item (date, kp_index, a_index, solar_radiation, radio_blackout, radio_flux, raw)
  const item = rawItem || {};
  const parsedDate = item.date ? new Date(item.date) : item.created_at ? new Date(item.created_at) : null;
  // KP: if array, compute mean; else try numeric fields
  let kpVal = null;
  const kpCandidate = item.kp_index ?? item.kpDailyAvg ?? item.kp_daily_avg ?? item.kp ?? item.kpIndex ?? null;
  if (Array.isArray(kpCandidate) && kpCandidate.length) {
    const nums = kpCandidate.filter((n) => typeof n === "number");
    if (nums.length) kpVal = nums.reduce((a, b) => a + b, 0) / nums.length;
  } else {
    const n = Number(kpCandidate);
    kpVal = Number.isFinite(n) ? n : null;
  }
  // Ap / a_index
  const apCandidate = item.a_index ?? item.ap_index ?? item.ap ?? item.aIndex ?? null;
  const apVal = (() => {
    const n = Number(apCandidate);
    return Number.isFinite(n) ? n : null;
  })();
  // Solar radiation (try several fields)
  let solarCandidate = item.solar_radiation ?? item.solarRadiation ?? item.solar ?? item.radio_flux ?? item.f107 ?? null;
  let solarVal = null;
  if (Array.isArray(solarCandidate) && solarCandidate.length && typeof solarCandidate[0] === "number") {
    solarVal = Number(solarCandidate[0]);
  } else if (typeof solarCandidate === "object" && solarCandidate !== null) {
    solarVal = Number(solarCandidate.value ?? solarCandidate.S1 ?? solarCandidate["S1 or greater"] ?? null);
    if (!Number.isFinite(solarVal)) solarVal = null;
  } else {
    const n = Number(solarCandidate);
    solarVal = Number.isFinite(n) ? n : null;
  }
  const radioVal = item.radio_blackout ?? item.radioBlackout ?? item.radio ?? null;

  return {
    idx: item.idx ?? idx,
    parsedDate,
    dateLabel: item.date_label ?? item.dateLabel ?? (parsedDate ? parsedDate.toISOString().slice(0, 10) : item.date ?? null),
    kp: kpVal,
    ap: apVal,
    solar: solarVal,
    radio: radioVal,
    raw: item,
  };
}

/**
 * Expects `forecast` to be an array of either:
 * - canonical processed items: { idx, parsedDate, dateLabel, kp, ap, solar, radio, raw }
 * - normalized backend items: { date, kp_index, a_index, solar_radiation, radio_blackout, ... }
 *
 * This component normalizes both shapes then renders cards + table.
 */
const ForecastDisplay = ({ forecast = [], onRefresh = null, backendErrorMessage = null }) => {
  const sourceItems = Array.isArray(forecast) ? forecast : [];
  // Build canonical items
  const items = sourceItems.map((it, i) => normalizeIncomingItem(it, i));

  const headerStart = items[0]?.parsedDate ?? null;
  const headerEnd = items[items.length - 1]?.parsedDate ?? null;

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, backgroundColor: "#f5f5f5", color: "#000" }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <div>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            🌌 Showing Forecast for{" "}
            <span style={{ color: "#1976d2" }}>
              {headerStart ? headerStart.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"}{" "}
              –{" "}
              {headerEnd ? headerEnd.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </span>
          </Typography>
        </div>

        <div>
          {backendErrorMessage && <Alert severity="error" sx={{ mb: 1 }}>{backendErrorMessage}</Alert>}
          {onRefresh && <Button variant="contained" onClick={onRefresh}>Refresh</Button>}
        </div>
      </Box>

      <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
        {items.map((item) => {
          const kp = item.kp ?? null;
          const ap = item.ap ?? null;
          const solar = item.solar ?? null;
          const radio = item.radio ?? null;
          const dateLabel = item.parsedDate ? formatFullDate(item.parsedDate) : item.dateLabel ?? "N/A";

          return (
            <Grid item xs={12} sm={6} md={4} key={item.idx ?? item.dateLabel ?? `${Math.random()}`}>
              <Card sx={{ backgroundColor: "#fff", color: "#000", boxShadow: 3, borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                    {`Day ${Number(item.idx ?? 0) + 1}`} • {dateLabel}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                    {item.dateLabel ?? ""}
                  </Typography>

                  <Typography mt={1} sx={{ fontSize: "1.05rem" }}>
                    🌡 <strong>Kp Index:</strong> {kp != null ? roundStr(kp, 2) : "N/A"}
                  </Typography>

                  <Typography sx={{ fontSize: "1.05rem" }}>
                    📊 <strong>Ap Index:</strong> {ap != null ? roundStr(ap, 0) : "N/A"}
                  </Typography>

                  <Typography sx={{ fontSize: "1.05rem" }}>
                    ☀️ <strong>Solar Radiation:</strong> {solar != null ? roundStr(solar, 2) : "N/A"}
                  </Typography>

                  <Typography sx={{ fontSize: "1.05rem" }}>{formatRadioBlackout(radio)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box mt={6}>
        <TableContainer component={Paper} sx={{ backgroundColor: "#fff", borderRadius: 2, overflow: "hidden" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>📅 Day & Date</TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>🌡 Kp Index</TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>📊 Ap Index</TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>☀️ Solar Radiation</TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>📡 Radio Blackout</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.idx ?? item.dateLabel ?? `${Math.random()}`}>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>
                    <strong>{`Day ${Number(item.idx ?? 0) + 1}`}</strong>
                    <br />
                    <span style={{ color: "#666", fontSize: "0.95rem" }}>{item.dateLabel ?? ""}</span>
                  </TableCell>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>{item.kp != null ? roundStr(item.kp, 2) : "N/A"}</TableCell>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>{item.ap != null ? roundStr(item.ap, 0) : "N/A"}</TableCell>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>{item.solar != null ? roundStr(item.solar, 2) : "N/A"}</TableCell>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>{formatRadioBlackout(item.radio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default ForecastDisplay;
