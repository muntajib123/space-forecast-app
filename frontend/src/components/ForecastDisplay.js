// frontend/src/components/ForecastDisplay.js
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
} from "@mui/material";

const ForecastDisplay = ({ forecast = [] }) => {
  if (!forecast?.length) {
    return (
      <Typography
        variant="body1"
        align="center"
        sx={{ color: "#555", mt: 2, fontSize: "1.2rem" }}
      >
        No forecast data available.
      </Typography>
    );
  }

  const formatRadioBlackout = (rb) => {
    if (rb && typeof rb === "object") {
      const r1 = rb["R1-R2"] ?? "N/A";
      const r3 = rb["R3 or greater"] ?? "N/A";
      return `📡 R1-R2: ${r1}, R3+: ${r3}`;
    }
    return `📡 ${String(rb ?? "N/A")}`;
  };

  const formatNumber = (val) =>
    val === null || val === undefined || Number.isNaN(Number(val))
      ? "N/A"
      : Number(val).toFixed(2);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        p: { xs: 2, sm: 4 },
        backgroundColor: "#f5f5f5",
        color: "#000",
      }}
    >
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{ fontWeight: "bold", fontSize: "2rem" }}
      >
        🌌 3-Day Space Weather Forecast
      </Typography>

      {/* Cards */}
      <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
        {forecast.map((item, index) => {
          // prefer normalized keys, fallback to older names if present
          const kp = item.kp ?? item.kp_index ?? item.kp_value ?? null;
          const ap = item.ap ?? item.ap_index ?? item.a_index ?? null;
          const solar =
            item.solar ?? item.solar_radiation ?? item.radio_flux ?? null;

          return (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  backgroundColor: "#fff",
                  color: "#000",
                  boxShadow: 3,
                  borderRadius: 3,
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontSize: "1.3rem" }}>
                    {item.day}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#666" }}>
                    {item.date}
                  </Typography>

                  <Typography mt={1} sx={{ fontSize: "1.1rem" }}>
                    🌡 <strong>Kp Index:</strong> {formatNumber(kp)}
                  </Typography>
                  <Typography sx={{ fontSize: "1.1rem" }}>
                    📊 <strong>Ap Index:</strong> {formatNumber(ap)}
                  </Typography>
                  <Typography sx={{ fontSize: "1.1rem" }}>
                    ☀️ <strong>Solar Radiation:</strong> {formatNumber(solar)}
                  </Typography>
                  <Typography sx={{ fontSize: "1.1rem" }}>
                    {formatRadioBlackout(item.radio_blackout)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Table */}
      <Box mt={6}>
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: "#fff",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>
                  📅 Day & Date
                </TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>
                  🌡 Kp Index
                </TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>
                  📊 Ap Index
                </TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>
                  ☀️ Solar Radiation
                </TableCell>
                <TableCell sx={{ color: "#1976d2", fontSize: "1rem" }}>
                  📡 Radio Blackout
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecast.map((item, index) => {
                const kp = item.kp ?? item.kp_index ?? item.kp_value ?? null;
                const ap = item.ap ?? item.ap_index ?? item.a_index ?? null;
                const solar =
                  item.solar ?? item.solar_radiation ?? item.radio_flux ?? null;
                return (
                  <TableRow key={index}>
                    <TableCell sx={{ color: "#000", fontSize: "1.1rem" }}>
                      <strong>{item.day}</strong>
                      <br />
                      <span style={{ color: "#666", fontSize: "0.95rem" }}>
                        {item.date}
                      </span>
                    </TableCell>
                    <TableCell sx={{ color: "#000", fontSize: "1.1rem" }}>
                      {formatNumber(kp)}
                    </TableCell>
                    <TableCell sx={{ color: "#000", fontSize: "1.1rem" }}>
                      {formatNumber(ap)}
                    </TableCell>
                    <TableCell sx={{ color: "#000", fontSize: "1.1rem" }}>
                      {formatNumber(solar)}
                    </TableCell>
                    <TableCell sx={{ color: "#000", fontSize: "1.1rem" }}>
                      {formatRadioBlackout(item.radio_blackout)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default ForecastDisplay;
