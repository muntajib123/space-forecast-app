// frontend/src/App.js
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  CircularProgress,
  Box,
  AppBar,
  Toolbar,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

function App() {
  const API_BASE =
    process.env.REACT_APP_API_BASE ||
    "https://space-forecast-app-1.onrender.com";

  const [forecastData, setForecastData] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  const theme = createTheme({
    palette: { mode: "light" },
  });

  // --- Helpers ---
  const getApFromKp = (kp) => {
    if (kp == null) return null;
    const table = {
      0: 0, 1: 4, 2: 7, 3: 15, 4: 27,
      5: 48, 6: 80, 7: 132, 8: 224, 9: 400
    };
    return table[Math.round(kp)] ?? null;
  };

  const getSolar = (val) => {
    if (val == null) return "—";
    if (Array.isArray(val)) return val[0] ?? "—";
    if (typeof val === "object") {
      const k = Object.keys(val)[0];
      return k ? `${k}: ${val[k]}` : "—";
    }
    return val;
  };

  const getRadioBlackout = (val) => {
    if (!val || typeof val !== "object") return "None";
    return `R1-R2: ${val["R1-R2"] ?? 0}, R3+: ${val["R3 or greater"] ?? 0}`;
  };

  // --- Fetch ---
  useEffect(() => {
    const url = `${API_BASE}/api/predictions/3day`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data) => {
        const arr = data?.data ?? [];

        // 🔹 Normalize dates
        const valid = arr
          .map((item) => ({
            ...item,
            parsedDate: new Date(item.date),
          }))
          .filter((item) => !isNaN(item.parsedDate));

        // 🔹 Sort ascending
        valid.sort((a, b) => a.parsedDate - b.parsedDate);

        // 🔹 Keep only dates >= tomorrow
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const futureOnly = valid.filter((item) => item.parsedDate >= tomorrow);

        // 🔹 Take 3 future days only
        const next3 = futureOnly.slice(0, 3);

        // 🔹 Map into clean format
        const mapped = next3.map((item, idx) => {
          const kp = Array.isArray(item.kp_index)
            ? Math.max(...item.kp_index.filter((n) => !isNaN(n)))
            : item.kp_index ?? null;

          const ap = item.a_index ?? getApFromKp(kp);

          return {
            day: `Day ${idx + 1}`,
            date: item.parsedDate.toDateString(),
            kp,
            ap,
            solar: getSolar(item.solar_radiation ?? item.radio_flux),
            radio: getRadioBlackout(item.radio_blackout),
          };
        });

        setForecastData(mapped);
      })
      .catch((err) => setFetchError(err.message));
  }, [API_BASE]);

  // --- UI ---
  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg">
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              3-Day Space Weather Forecast
            </Typography>
          </Toolbar>
        </AppBar>

        <Box mt={4}>
          {fetchError ? (
            <Typography color="error">{fetchError}</Typography>
          ) : forecastData.length > 0 ? (
            <Box display="flex" gap={2} flexWrap="wrap">
              {forecastData.map((f, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    boxShadow: 2,
                    minWidth: 220,
                    bgcolor: "#fff",
                  }}
                >
                  <Typography variant="subtitle2">{f.date}</Typography>
                  <Typography variant="h6">
                    Kp Index: {f.kp ?? "—"}
                  </Typography>
                  <Typography>Ap Index: {f.ap ?? "—"}</Typography>
                  <Typography>Solar: {f.solar}</Typography>
                  <Typography>Radio: {f.radio}</Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box display="flex" justifyContent="center" mt={5}>
              <CircularProgress />
              <Typography ml={2}>Loading forecast...</Typography>
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
