// App.js
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
  Toolbar
} from '@mui/material';

import { createTheme, ThemeProvider } from '@mui/material/styles';

function App() {
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
