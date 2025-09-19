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
  const [kpHourly, setKpHourly] = useState([]); // hourly Kp for the first chosen day (if available)
  const [apHourly, setApHourly] = useState([]); // hourly Ap for first chosen day (if available)
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

  // Helpers
  const numericArray = (val) => {
    if (val == null) return [];
    // flatten arrays that may be nested
    if (Array.isArray(val)) {
      const flat = val.flat(Infinity);
      return flat
        .map((v) => {
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        })
        .filter((n) => n !== null);
    }
    // If object, try its values (shallow)
    if (typeof val === "object") {
      const values = Object.values(val).flatMap((x) => (Array.isArray(x) ? x : [x]));
      return values
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

  // robust extractor for arbitrary shapes (keeps parity with numericArray)
  const extractNumbers = (v) => numericArray(v);

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
    // handle cases where raw might be a nested object
    if (typeof raw === "object") {
      // try common nested keys
      const possible = firstNonNull(raw.iso, raw.ISO, raw.dateString, raw.toString());
      if (possible) {
        const d2 = new Date(possible);
        if (!isNaN(d2)) return d2;
      }
      return null;
    }
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

        // map & parse dates, keep only items with a parseable date where possible
        const mapped = arr
          .map((it) => ({ it, parsed: parseDate(it) }))
          .sort((a, b) => {
            // sort with parsed dates first; items with no parsed date go to the end preserving order
            if (a.parsed && b.parsed) return a.parsed - b.parsed;
            if (a.parsed) return -1;
            if (b.parsed) return 1;
            return 0;
          });

        console.debug("DEBUG: total items:", arr.length, "parsed:", mapped.filter(m => m.parsed).length);

        // today's start
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // prefer strictly future items (parsed > todayStart)
        const futureCand = mapped.filter(({ parsed }) => parsed && parsed.getTime() > todayStart.getTime());

        // pick up to 3
        const selected = [];
        for (let i = 0; i < futureCand.length && selected.length < 3; i++) selected.push(futureCand[i]);
        if (selected.length < 3) {
          for (let i = 0; i < mapped.length && selected.length < 3; i++) {
            if (selected.includes(mapped[i])) continue;
            selected.push(mapped[i]);
          }
        }

        const chosenItems = selected.map(({ it }) => it);
        const fallbackChosen = chosenItems.length ? chosenItems : arr.slice(0, 3);

        // prepare display dates: if API dates are all in the past, generate next 3 days from tomorrow
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const parsedItems = fallbackChosen.map((item, idx) => ({ item, parsed: parseDate(item), idx }));
        const anyFuture = parsedItems.some((p) => p.parsed && p.parsed.getTime() >= todayStart.getTime());

        let finalChosenWithDates;
        if (!anyFuture) {
          console.warn("DEBUG: API dates appear to be in the past — using generated next 3 calendar days for display");
          finalChosenWithDates = parsedItems.map((p, idx) => ({
            item: p.item,
            displayDate: new Date(tomorrow.getTime() + idx * 86400000),
          }));
        } else {
          finalChosenWithDates = parsedItems.map((p, idx) => ({
            item: p.item,
            displayDate: p.parsed || new Date(tomorrow.getTime() + idx * 86400000),
          }));
        }

        // Format each chosen item: compute daily KP (peak), AP (mean), Solar (mean)
        const formattedData = finalChosenWithDates.map(({ item, displayDate }, idx) => {
          // priority: hourly arrays (kp_hourly / ap_hourly / solar_hourly) -> fallbacks
          const kpHourlyCandidate = firstNonNull(item.kp_hourly, item.kp_hourly_values, item.kp_values);
          const apHourlyCandidate = firstNonNull(item.ap_hourly, item.ap_hourly_values, item.ap_values);
          const solarHourlyCandidate = firstNonNull(item.solar_hourly, item.radio_flux_hourly, item.solar_flux_hourly);

          // compute kp: peak of hourly if present else max of other keys
          let kp = null;
          if (kpHourlyCandidate) {
            const arrK = numericArray(kpHourlyCandidate);
            kp = arrK.length ? Math.max(...arrK) : null;
          }
          if (kp == null) {
            kp = firstNonNull(
              maxOf(item.kp_index ?? null),
              maxOf(item.kp ?? null),
              maxOf(item.kp_value ?? null),
              maxOf(item.kp_max ?? null)
            );
          }

          // compute ap: mean of hourly if present else mean of other keys
          let ap = null;
          if (apHourlyCandidate) {
            const arrA = numericArray(apHourlyCandidate);
            ap = arrA.length ? arrA.reduce((a, b) => a + b, 0) / arrA.length : null;
          }
          if (ap == null) {
            ap = firstNonNull(
              meanOf(item.ap_hourly ?? null),
              meanOf(item.ap_index ?? null),
              meanOf(item.a_index ?? null),
              meanOf(item.ap ?? null)
            );
          }

          // compute solar: mean of hourly if present else mean of other keys
          let solar = null;
          if (solarHourlyCandidate) {
            const arrS = numericArray(solarHourlyCandidate);
            solar = arrS.length ? arrS.reduce((a, b) => a + b, 0) / arrS.length : null;
          }
          if (solar == null) {
            solar = firstNonNull(
              meanOf(item.solar_hourly ?? null),
              meanOf(item.radio_flux ?? null),
              meanOf(item.solar_radiation ?? null),
              meanOf(item.solar ?? null),
              meanOf(item.solar_flux ?? null)
            );
          }

          const radio_blackout_display = `${item.radio_blackout?.["R1-R2"] ?? "None"}/${item.radio_blackout?.["R3 or greater"] ?? "None"}`;

          return {
            ...item,
            day: `Day ${idx + 1}`,
            date: displayDate.toDateString(),
            iso: displayDate.toISOString().split("T")[0],
            kp,
            ap,
            solar,
            radio_blackout_display,
          };
        });

        console.debug("DEBUG: finalChosenWithDates (for inspection):", finalChosenWithDates.map(f => ({ iso: f.displayDate.toISOString().split('T')[0], raw: f.item })));
        console.log("DEBUG: formatted forecastData (future 3):", formattedData);

        setForecastData(formattedData);

        // Set hourly breakdown arrays for charts & breakdown component. Prefer hourly from first chosen item.
        const firstSource = finalChosenWithDates[0]?.item ?? arr[0] ?? null;
        if (firstSource) {
          // try several common hourly keys
          const kpHourlyFromFirst = firstNonNull(firstSource.kp_hourly, firstSource.kp_hourly_values, firstSource.kp_values);
          const apHourlyFromFirst = firstNonNull(firstSource.ap_hourly, firstSource.ap_hourly_values, firstSource.ap_values);
          const solarHourlyFromFirst = firstNonNull(firstSource.solar_hourly, firstSource.radio_flux_hourly, firstSource.solar_flux_hourly);

          setKpHourly(Array.isArray(kpHourlyFromFirst) ? kpHourlyFromFirst : []);
          setApHourly(Array.isArray(apHourlyFromFirst) ? apHourlyFromFirst : []);
          // note: ForecastBreakdown3Hourly may also read kpHourly/apHourly arrays to show the matrix
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
