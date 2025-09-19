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

import { fetch3DayForecast } from "./api"; // uses REACT_APP_API_BASE inside api.js

function App() {
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

  // state
  const [forecastData, setForecastData] = useState([]);
  const [kpHourly, setKpHourly] = useState([]);
  const [apHourly, setApHourly] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  const lightTheme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#1976d2" },
      secondary: { main: "#dc004e" },
      background: { default: "#f5f5f5", paper: "#fff" },
      text: { primary: "#000", secondary: "#333" },
    },
    typography: {
      fontSize: 16,
      h1: { fontSize: "2rem" },
      h2: { fontSize: "1.5rem" },
      body1: { fontSize: "1.1rem" },
    },
  });

  // Helpers: numeric array + mean / max (kept for backward compatibility)
  const numericArray = (val) => {
    if (val == null) return [];
    if (Array.isArray(val)) {
      return val
        .map((v) => {
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        })
        .filter((n) => n !== null);
    }
    const n = Number(val);
    return Number.isNaN(n) ? [] : [n];
  };

  const meanOf = (val) => {
    const arr = numericArray(val);
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const maxOf = (val) => {
    const arr = numericArray(val);
    if (!arr.length) return null;
    return Math.max(...arr);
  };

  // robust extractor used below
  const extractNumbers = (v) => {
    if (v == null) return [];
    // if it's array-like (of numbers or number-strings)
    if (Array.isArray(v)) {
      return v
        .map((x) => {
          const n = Number(x);
          return Number.isNaN(n) ? null : n;
        })
        .filter((n) => n !== null);
    }
    // if it's an object with numeric fields, try to extract numeric values
    if (typeof v === "object") {
      // flatten object values (depth 1)
      const values = Object.values(v).flatMap((x) => (Array.isArray(x) ? x : [x]));
      return values
        .map((x) => {
          const n = Number(x);
          return Number.isNaN(n) ? null : n;
        })
        .filter((n) => n !== null);
    }
    // otherwise try parse as number/string
    const n = Number(v);
    return Number.isNaN(n) ? [] : [n];
  };

  const firstNonNull = (...args) => {
    for (const a of args) {
      if (a !== undefined && a !== null) return a;
    }
    return null;
  };

  // parse date helper (robust)
  const parseDate = (item) => {
    const raw = item?.date ?? item?.iso ?? "";
    if (!raw) return null;
    const d = new Date(raw);
    if (!isNaN(d)) return d;
    // try first 10 chars (YYYY-MM-DD)
    if (typeof raw === "string" && raw.length >= 10) {
      const try10 = new Date(raw.slice(0, 10));
      if (!isNaN(try10)) return try10;
    }
    return null;
  };

  // Fetch only after unlocked
  useEffect(() => {
    if (!unlocked) {
      console.log("DEBUG: App locked — waiting for password");
      return;
    }

    console.log("DEBUG: App unlocked, starting fetch");
    console.log("DEBUG: REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE);

    setFetchError(null);

    fetch3DayForecast()
      .then((resp) => {
        console.log("DEBUG: raw API response:", resp);
        const arr = Array.isArray(resp) ? resp : resp?.data ?? [];

        // helper: map and parse
        const mapped = arr
          .map((it) => ({ it, parsed: parseDate(it) }))
          .filter(({ parsed }) => parsed !== null)
          .sort((a, b) => a.parsed - b.parsed);

        console.debug("DEBUG: total parsed items:", mapped.length);

        // start-of-today (00:00 local) and "nowStart" for future filtering
        const nowStart = new Date();
        nowStart.setHours(0, 0, 0, 0);

        // Preferred candidates: strictly future (parsed > nowStart)
        const futureCand = mapped.filter(({ parsed }) => parsed.getTime() > nowStart.getTime());

        // Select up to 3 from futureCand; if not enough, fill from mapped (but do not duplicate).
        const selected = [];

        for (let i = 0; i < futureCand.length && selected.length < 3; i++) {
          selected.push(futureCand[i]);
        }

        if (selected.length < 3) {
          for (let i = 0; i < mapped.length && selected.length < 3; i++) {
            // if this mapped item is already in selected, skip
            if (selected.includes(mapped[i])) continue;
            selected.push(mapped[i]);
          }
        }

        // Finally, map to raw items (or empty array)
        const chosenItems = selected.map(({ it }) => it);

        // If chosenItems is still empty (no parsed dates), fallback to raw arr slice
        const fallbackChosen = chosenItems.length ? chosenItems : arr.slice(0, 3);

        // Determine a base "tomorrow" for labeling if needed
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // --- robust numeric extraction and formatting ---
        const formattedData = fallbackChosen.map((item, idx) => {
          const parsed = parseDate(item) || new Date(tomorrow.getTime() + idx * 86400000);
          const forecastDate = parsed;

          // Try many common key names & shapes for Kp/Ap/Solar
          const kpCandidates = [
            item.kp_hourly,
            item.kp_index,
            item.kp,
            item.kp_value,
            item.kp_max,
            item.Kp,
          ];
          const apCandidates = [
            item.ap_hourly,
            item.ap_index,
            item.a_index,
            item.ap,
            item.ap_mean,
            item.ap_daily,
            item.Ap,
          ];
          const solarCandidates = [
            item.radio_flux,
            item.solar_radiation,
            item.solar,
            item.solar_flux,
            item.solar_mean,
          ];

          // compute kp = max of any numeric candidate arrays/values
          let kpVals = [];
          for (const c of kpCandidates) kpVals = kpVals.concat(extractNumbers(c));
          const kp = kpVals.length ? Math.max(...kpVals) : null;

          // compute ap = mean of any numeric candidate arrays/values
          let apVals = [];
          for (const c of apCandidates) apVals = apVals.concat(extractNumbers(c));
          const ap = apVals.length ? apVals.reduce((a, b) => a + b, 0) / apVals.length : null;

          // solar mean
          let solarVals = [];
          for (const c of solarCandidates) solarVals = solarVals.concat(extractNumbers(c));
          const solar = solarVals.length ? solarVals.reduce((a, b) => a + b, 0) / solarVals.length : null;

          // radio_blackout formatting (keep same fallback)
          const radio_blackout_display = `${item.radio_blackout?.["R1-R2"] ?? "None"}/${item.radio_blackout?.["R3 or greater"] ?? "None"}`;

          return {
            ...item,
            day: `Day ${idx + 1}`,
            date: forecastDate.toDateString(),
            iso: forecastDate.toISOString().split("T")[0],
            kp,
            ap,
            solar,
            radio_blackout_display,
          };
        });

        // Debug: show raw chosen items + formatted output
        console.debug("DEBUG: chosen raw items (for inspection):", fallbackChosen);
        console.log("DEBUG: formatted forecastData (future 3):", formattedData);

        setForecastData(formattedData);

        // Use hourly breakdown from the first chosen item if available; fallback to first arr item
        const firstSource = selected[0]?.it ?? arr[0] ?? null;
        if (firstSource) {
          if (firstSource.kp_hourly) setKpHourly(firstSource.kp_hourly);
          if (firstSource.ap_hourly) setApHourly(firstSource.ap_hourly);
        }
      })
      .catch((err) => {
        console.error("Error fetching forecast:", err);
        setFetchError(String(err));
      });
  }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Password gate UI
  if (!unlocked) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#f5f5f5", px: 2 }}>
        <Box component="form" onSubmit={submitPassword} sx={{ width: "100%", maxWidth: 420, p: 4, borderRadius: 2, boxShadow: 3, bgcolor: "white", display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h6" align="center">Enter password to view app</Typography>
          <TextField type="password" placeholder="Password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} fullWidth autoFocus />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 1 }}>
            <Button variant="contained" type="submit">Enter</Button>
            <Button variant="outlined" onClick={() => setPwInput("")}>Clear</Button>
          </Box>
          <Typography variant="caption" align="center" sx={{ mt: 1 }}>Note: this is a quick protection for demos. Do not use for sensitive production data.</Typography>
        </Box>
      </Box>
    );
  }

  // Main UI
  return (
    <ThemeProvider theme={lightTheme}>
      <Container maxWidth="lg">
        <AppBar position="static" color="primary">
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box component="img" src="/coralcomp-logo.png" alt="CoralComp Logo" sx={{ height: 50 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, textAlign: "center", fontWeight: "bold" }}>
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
              <Typography variant="body1" ml={2}>Loading forecast...</Typography>
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
