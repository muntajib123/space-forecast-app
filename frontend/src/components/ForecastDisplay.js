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
  if (!rb && rb !== 0) return "📡 None";
  if (typeof rb === "object") {
    const r1 = rb["R1-R2"] ?? rb.R1_R2 ?? rb.r1_r2 ?? rb.r1 ?? "N/A";
    const r3 = rb["R3 or greater"] ?? rb.R3 ?? rb.r3 ?? rb["R3+"] ?? "N/A";
    return `📡 R1-R2: ${r1}, R3+: ${r3}`;
  }
  return `📡 ${String(rb)}`;
};

function formatFullDate(d) {
  if (!(d instanceof Date)) return "N/A";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Expects `forecast` to be an array of processed items:
 * { idx, parsedDate, dateLabel, kp, ap, solar, radio, raw }
 */
const ForecastDisplay = ({ forecast = [], onRefresh = null, backendErrorMessage = null }) => {
  const items = Array.isArray(forecast) ? forecast : [];

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
          const dateLabel = item.parsedDate ? formatFullDate(item.parsedDate) : "N/A";

          return (
            <Grid item xs={12} sm={6} md={4} key={item.idx ?? item.dateLabel ?? Math.random()}>
              <Card sx={{ backgroundColor: "#fff", color: "#000", boxShadow: 3, borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                    {`Day ${item.idx + 1}`} • {dateLabel}
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
                <TableRow key={item.idx ?? item.dateLabel ?? Math.random()}>
                  <TableCell sx={{ color: "#000", fontSize: "1.05rem" }}>
                    <strong>{`Day ${item.idx + 1}`}</strong>
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
