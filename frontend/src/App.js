// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import ForecastDisplay from './components/ForecastDisplay';
import ForecastGraphs from './components/ForecastGraphs';
import ForecastSummary from './components/ForecastSummary';
import ForecastBreakdown3Hourly from './components/ForecastBreakdown3Hourly';

import {
  Container,
  Typography,
  CircularProgress,
  Box,
  AppBar,
  Toolbar,
  TextField,
  Button
} from '@mui/material';

import { createTheme, ThemeProvider } from '@mui/material/styles';

function App() {
  // Password: try to read from build-time env var (set REACT_APP_SITE_PASSWORD in Vercel)
  // If not set, change the default string below (but do not commit secrets to git).
  const PASSWORD = process.env.REACT_APP_SITE_PASSWORD || 'coral-secret-2025';

  // --- auth state for the simple client-side gate ---
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");

  // check sessionStorage on load
  useEffect(() => {
    try {
      const ok = sessionStorage.getItem("site_auth") === PASSWORD;
      if (ok) setUnlocked(true);
    } catch (e) {
      // sessionStorage might not be available in some contexts
    }
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

  // --- your existing forecast state & logic (unchanged) ---
  const [forecastData, setForecastData] = useState([]);
  const [kpHourly, setKpHourly] = useState([]);
  const [apHourly, setApHourly] = useState([]);

  const lightTheme = createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: {
        default: '#f5f5f5',
        paper: '#fff',
      },
      text: {
        primary: '#000',
        secondary: '#333',
      },
    },
    typography: {
      fontSize: 16,
      h1: { fontSize: '2rem' },
      h2: { fontSize: '1.5rem' },
      body1: { fontSize: '1.1rem' },
    },
  });

  useEffect(() => {
    const today = new Date();
    const rbSeverityMap = { None: 0, Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };

    const predictedData = [
      { kp_index: 3.454, solar_radiation: 1.771, radio_blackout: { "R1-R2": "Minor", "R3 or greater": "None" } },
      { kp_index: 4.655, solar_radiation: 1.72, radio_blackout: { "R1-R2": "Minor", "R3 or greater": "None" } },
      { kp_index: 5.677, solar_radiation: 1.72, radio_blackout: { "R1-R2": "Minor", "R3 or greater": "None" } },
    ];

    const kpHourlyPredicted = [
      3.0979261, 2.7071314, 2.784403, 4.2402425, 4.2729597, 2.9541614, 2.5605693,
      5.0134096, 5.042291, 3.1660726, 2.7179985, 5.970781, 6.3877845, 3.268815,
      2.5783856, 8.103942, 7.8522205, 3.327173, 2.7034302, 8.435013, 8.491909,
      4.5404224, 3.62365, 6.4392977
    ];

    setKpHourly(kpHourlyPredicted);

    const apHourlyPredicted = kpHourlyPredicted.map(kp => Math.round((kp * 10) / 3));
    setApHourly(apHourlyPredicted);

    const apDaily = [
      apHourlyPredicted.slice(0, 8).reduce((a, b) => a + b, 0) / 8,
      apHourlyPredicted.slice(8, 16).reduce((a, b) => a + b, 0) / 8,
      apHourlyPredicted.slice(16, 24).reduce((a, b) => a + b, 0) / 8
    ];

    const formattedData = predictedData.map((item, index) => {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + index + 1);

      return {
        ...item,
        ap_index: apDaily[index],
        day: `Day ${index + 1}`,
        date: forecastDate.toDateString(),
        iso: forecastDate.toISOString().split("T")[0],
        radio_blackout_display: `${item.radio_blackout["R1-R2"]}/${item.radio_blackout["R3 or greater"]}`,
        radio_blackout_r1_r2_numeric: rbSeverityMap[item.radio_blackout["R1-R2"]] ?? 0,
        radio_blackout_r3_plus_numeric: rbSeverityMap[item.radio_blackout["R3 or greater"]] ?? 0,
      };
    });

    setForecastData(formattedData);
  }, []);

  // If not unlocked show the password form
  if (!unlocked) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "#f5f5f5",
          px: 2
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
            gap: 2
          }}
        >
          <Typography variant="h6" align="center">Enter password to view app</Typography>
          <TextField
            type="password"
            placeholder="Password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            fullWidth
            autoFocus
          />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 1 }}>
            <Button variant="contained" type="submit">Enter</Button>
            <Button variant="outlined" onClick={() => { setPwInput(""); }}>Clear</Button>
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

        {/* ✅ Navbar with CoralComp logo + centered title */}
        <AppBar position="static" color="primary">
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            {/* Logo on left */}
            <Box
              component="img"
              src="/coralcomp-logo.png"
              alt="CoralComp Logo"
              sx={{ height: 50 }}
            />

            {/* Title centered */}
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, textAlign: "center", fontWeight: "bold" }}
            >
              3-Day Space Weather Forecast
            </Typography>

            {/* Spacer to balance layout */}
            <Box sx={{ width: 50 }} />
          </Toolbar>
        </AppBar>

        <Box mt={4}>
          {forecastData.length > 0 ? (
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
