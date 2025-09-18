// frontend/src/App.js
import React, { useEffect, useState } from "react";
import ForecastDisplay from "./components/ForecastDisplay";
import ForecastGraphs from "./components/ForecastGraphs";
import ForecastSummary from "./components/ForecastSummary";
import ForecastBreakdown3Hourly from "./components/ForecastBreakdown3Hourly";

import {
  Container,
  Typography,
  CircularProgress,
  Box,
  AppBar,
  Toolbar,
  TextField,
  Button,
} from "@mui/material";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { fetch3DayForecast } from "./api"; // <- uses REACT_APP_API_BASE inside api.js

function App() {
  // ✅ Use REACT_APP_SITE_PASSWORD (only these are exposed in CRA builds)
  const PASSWORD =
    process.env.REACT_APP_SITE_PASSWORD || "coralcomp7081567123";

  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");

  useEffect(() => {
    try {
      const ok = sessionStorage.getItem("site_auth") === PASSWORD;
      if (ok) setUnlocked(true);
    } catch (e) {}
  }, [PASSWORD]);

  const submitPassword = (e) => {
    e.preventDefault();
    if (pwInput === PASSWORD) {
      try {
        sessionStorage.setItem("site_auth", PASSWORD);
      } catch (err) {}
      setUnlocked(true);
    } else {
      alert("Wrong password");
    }
  };

  // --- forecast state ---
  const [forecastData, setForecastData] = useState([]);
  const [kpHourly, setKpHourly] = useState([]);
  const [apHourly, setApHourly] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  const lightTheme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#1976d2" },
      secondary: { main: "#dc004e" },
      background: {
        default: "#f5f5f5",
        paper: "#fff",
      },
      text: {
        primary: "#000",
        secondary: "#333",
      },
    },
    typography: {
      fontSize: 16,
      h1: { fontSize: "2rem" },
      h2: { fontSize: "1.5rem" },
      body1: { fontSize: "1.1rem" },
    },
  });

  // ✅ Fetch live predictions from backend (use only after unlocked)
  useEffect(() => {
    if (!unlocked) {
      console.log("DEBUG: App locked, skipping fetch until unlocked");
      return;
    }

    console.log("DEBUG: App useEffect running (unlocked = true)");
    console.log("DEBUG: REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE);

    const today = new Date();
    const rbSeverityMap = { None: 0, Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };

    setFetchError(null);

    // call helper, which uses the env var or fallback
    fetch3DayForecast()
      .then((resp) => {
        console.log("DEBUG: fetch3DayForecast response:", resp);
        // backend returns { data: [...] } — handle both shapes
        const arr = Array.isArray(resp) ? resp : resp?.data ?? [];
        const formattedData = arr.map((item, index) => {
          const forecastDate = new Date(today);
          forecastDate.setDate(today.getDate() + index + 1);

          return {
            ...item,
            day: `Day ${index + 1}`,
            date: forecastDate.toDateString(),
            iso: forecastDate.toISOString().split("T")[0],
            radio_blackout_display: `${item.radio_blackout?.["R1-R2"] ?? "None"}/${item.radio_blackout?.["R3 or greater"] ?? "None"}`,
            radio_blackout_r1_r2_numeric: rbSeverityMap[item.radio_blackout?.["R1-R2"]] ?? 0,
            radio_blackout_r3_plus_numeric: rbSeverityMap[item.radio_blackout?.["R3 or greater"]] ?? 0,
          };
        });

        setForecastData(formattedData);

        if (arr[0]?.kp_hourly) setKpHourly(arr[0].kp_hourly);
        if (arr[0]?.ap_hourly) setApHourly(arr[0].ap_hourly);
      })
      .catch((err) => {
        console.error("Error fetching forecast:", err);
        setFetchError(String(err));
      });
  }, [unlocked]);

  // 🔒 Password gate
  if (!unlocked) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "#f5f5f5",
          px: 2,
        }}
      >
        <Box
          component="form"
          onSubmit={submitPassword}
          sx={{
            width: "100%",
            maxWidth: 420,
            p: 4,
            borderRadius: 2,
            boxShadow: 3,
            bgcolor: "white",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography variant="h6" align="center">
            Enter password to view app
          </Typography>
          <TextField
            type="password"
            placeholder="Password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            fullWidth
            autoFocus
          />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 1 }}>
            <Button variant="contained" type="submit">
              Enter
            </Button>
            <Button variant="outlined" onClick={() => setPwInput("")}>
              Clear
            </Button>
          </Box>
          <Typography variant="caption" align="center" sx={{ mt: 1 }}>
            Note: this is a quick protection for demos. Do not use for sensitive production data.
          </Typography>
        </Box>
      </Box>
    );
  }

  // --- normal app render once unlocked ---
  return (
    <ThemeProvider theme={lightTheme}>
      <Container maxWidth="lg">
        <AppBar position="static" color="primary">
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box
              component="img"
              src="/coralcomp-logo.png"
              alt="CoralComp Logo"
              sx={{ height: 50 }}
            />
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, textAlign: "center", fontWeight: "bold" }}
            >
              3-Day Space Weather Forecast
            </Typography>
            <Box sx={{ width: 50 }} />
          </Toolbar>
        </AppBar>

        <Box mt={4}>
          {fetchError ? (
            <Box display="flex" justifyContent="center" mt={5} flexDirection="column" alignItems="center">
              <Typography color="error">Error loading forecast</Typography>
              <Typography variant="caption" sx={{ mt: 1 }}>{fetchError}</Typography>
            </Box>
          ) : forecastData.length > 0 ? (
            <>
              <ForecastDisplay forecast={forecastData} />
              <ForecastGraphs data={forecastData} />
              <ForecastSummary data={forecastData} kpBreakdown={kpHourly} />
              <ForecastBreakdown3Hourly kpIndex={kpHourly} apIndex={apHourly} />
            </>
          ) : (
            <Box display="flex" justifyContent="center" mt={5}>
              <CircularProgress />
              <Typography variant="body1" ml={2}>
                Loading forecast...
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
