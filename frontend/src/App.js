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
  Toolbar,
} from '@mui/material';

function App() {
  const [forecastData, setForecastData] = useState([]);
  const [kpHourly, setKpHourly] = useState([]);

  useEffect(() => {
    const today = new Date();

    // Map radio blackout levels to numeric severity for plotting
    const rbSeverityMap = {
      None: 0,
      Minor: 1,
      Moderate: 2,
      Severe: 3,
      Extreme: 4
    };

    const predictedData = [
      {
        kp_index: 3.454,
        solar_radiation: 1.771,
        radio_blackout: {
          "R1-R2": "Minor",
          "R3 or greater": "None"
        }
      },
      {
        kp_index: 4.655,
        solar_radiation: 1.72,
        radio_blackout: {
          "R1-R2": "Minor",
          "R3 or greater": "None"
        }
      },
      {
        kp_index: 5.677,
        solar_radiation: 1.72,
        radio_blackout: {
          "R1-R2": "Minor",
          "R3 or greater": "None"
        }
      },
    ];

    const kpHourlyPredicted = [
      3.0979261, 2.7071314, 2.784403, 4.2402425, 4.2729597, 2.9541614, 2.5605693,
      5.0134096, 5.042291, 3.1660726, 2.7179985, 5.970781, 6.3877845, 3.268815,
      2.5783856, 8.103942, 7.8522205, 3.327173, 2.7034302, 8.435013, 8.491909,
      4.5404224, 3.62365, 6.4392977
    ];

    setKpHourly(kpHourlyPredicted);

    const formattedData = predictedData.map((item, index) => {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + index + 1);

      return {
        ...item,
        day: `Day ${index + 1}`,
        date: forecastDate.toDateString(),
        iso: forecastDate.toISOString().split("T")[0],
        radio_blackout_display: `${item.radio_blackout["R1-R2"]}/${item.radio_blackout["R3 or greater"]}`,
        radio_blackout_r1_r2_numeric: rbSeverityMap[item.radio_blackout["R1-R2"]] ?? 0,
        radio_blackout_r3_plus_numeric: rbSeverityMap[item.radio_blackout["R3 or greater"]] ?? 0,
      };
    });

    console.log("🚀 Setting forecast data:", formattedData);
    setForecastData(formattedData);
  }, []);

  return (
    <Container maxWidth="lg">
      <AppBar position="static" color="primary">
        <Toolbar>
          <img
            src="/coralcomp-logo.png"
            alt="CoralComp Logo"
            style={{ height: 50, marginRight: 16 }}
          />
          <Typography variant="h6" component="div">
            3-Day Space Weather Forecast
          </Typography>
        </Toolbar>
      </AppBar>

      <Box mt={4}>
        {forecastData.length > 0 ? (
          <>
            <ForecastDisplay forecast={forecastData} />
            <ForecastGraphs data={forecastData} />
            <ForecastSummary data={forecastData} kpBreakdown={kpHourly} />
            <ForecastBreakdown3Hourly kpIndex={kpHourly} />
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
  );
}

export default App;
