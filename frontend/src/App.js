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

/*
  Demo / debug App.js
  - Uses REACT_APP_API_BASE (env) or falls back to the working Render backend.
  - Shows a debug panel with the raw API response for demonstration.
*/
function App() {
  // fallback API base (change if you have a different working origin)
  const API_BASE =
    process.env.REACT_APP_API_BASE || "https://space-forecast-app-1.onrender.com";

  console.debug("DEBUG: using API_BASE =", API_BASE);

  // local fetch helper (bypasses any other api.js)
  const fetch3DayForecast = async () => {
    const url = `${API_BASE}/api/predictions/3day`;
    console.debug("DEBUG: fetch3DayForecast calling:", url);
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`API ${resp.status} ${resp.statusText} ${text}`);
    }
    return resp.json();
  };

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

  // Helpers (robust numeric extraction)
  const numericArray = (val) => {
    if (val == null) return [];
    if (Array.isArray(val)) {
      const flat = val.flat(Infinity);
      return flat
        .map((v) => {
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        })
        .filter((n) => n !== null);
    }
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
  const toHourlyArray = (maybe) => numericArray(maybe);

  const firstNonNull = (...args) => {
    for (const a of args) {
      if (a !== undefined && a !== null) return a;
    }
    return null;
  };

  // parse date (robust)
  const parseDate = (item) => {
    const raw = item?.date ?? item?.iso ?? "";
    if (!raw) return null;
    if (typeof raw === "object") {
      const possible = firstNonNull(raw.iso, raw.ISO, raw.dateString, raw.toString && raw.toString());
      if (possible) {
        const d2 = new Date(possible);
        if (!isNaN(d2)) return d2;
      }
      return null;
    }
    const d = new Date(raw);
    if (!isNaN(d)) return d;
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
    setFetchError(null);

    fetch3DayForecast()
      .then((resp) => {
        console.log("DEBUG: raw API response:", resp);
        // store for debug / demo
        try {
          window.__SPACE_FORECAST_RAW__ = resp;
        } catch (e) {}

        const arr = Array.isArray(resp) ? resp : resp?.data ?? [];

        // map & parse dates
        const mapped = arr.map((it) => ({ it, parsed: parseDate(it) }));

        // If API dates are in the past (older dataset), we will fall back to using the array order
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // prefer future items where possible
        const future = mapped.filter((m) => m.parsed && m.parsed.getTime() > todayStart.getTime());
        let chosen = [];
        if (future.length >= 3) {
          chosen = future.slice(0, 3).map((m) => m.it);
        } else {
          // fallback: take first 3 of mapped (preserves array order from the backend)
          chosen = mapped.map((m) => m.it).slice(0, 3);
        }

        // Prepare display dates: if chosen items have parseable dates use them, else generate next 3 calendar days
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const final = chosen.map((item, idx) => {
          const parsed = parseDate(item);
          const displayDate = parsed || new Date(tomorrow.getTime() + idx * 86400000);

          // compute kp/ap/solar robustly
          const kp = (() => {
            const candidates = [
              item.kp_hourly,
              item.kp_index,
              item.kp,
              item.kp_value,
              item.kp_values,
            ];
            let vals = [];
            candidates.forEach((c) => (vals = vals.concat(toHourlyArray(c))));
            return vals.length ? Math.max(...vals) : firstNonNull(maxOf(item.kp_index), maxOf(item.kp));
          })();

          const ap = (() => {
            const candidates = [
              item.ap_hourly,
              item.ap_index,
              item.a_index,
              item.ap,
            ];
            let vals = [];
            candidates.forEach((c) => (vals = vals.concat(toHourlyArray(c))));
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : firstNonNull(meanOf(item.ap_index), meanOf(item.ap));
          })();

          const solar = (() => {
            const candidates = [
              item.solar_hourly,
              item.radio_flux,
              item.solar_radiation,
              item.solar,
            ];
            let vals = [];
            candidates.forEach((c) => (vals = vals.concat(toHourlyArray(c))));
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : firstNonNull(meanOf(item.radio_flux), meanOf(item.solar_radiation));
          })();

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

        console.log("DEBUG: formatted forecastData (future 3):", final);
        setForecastData(final);

        // hourly breakdown from first chosen item if available
        const first = chosen[0] ?? arr[0] ?? null;
        if (first) {
          setKpHourly(toHourlyArray(first.kp_hourly ?? first.kp_index ?? first.kp_values));
          setApHourly(toHourlyArray(first.ap_hourly ?? first.ap_index ?? first.ap_values));
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
          <Typography variant="caption" align="center" sx={{ mt: 1 }}>Note: this is a quick protection for demos.</Typography>
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
            <Box component="img" src="/coralcomp-logo.png" alt="Logo" sx={{ height: 50 }} />
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

              {/* Debug panel (visible on page for demo) */}
              <Box mt={4} sx={{ background: "#f6f6f6", p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2">DEBUG: raw API payload (window.__SPACE_FORECAST_RAW__)</Typography>
                <pre style={{ maxHeight: 240, overflow: "auto", margin: 0 }}>{JSON.stringify(window.__SPACE_FORECAST_RAW__ || [], null, 2)}</pre>
              </Box>
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
