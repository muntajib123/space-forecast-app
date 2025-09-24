// src/App.js
import React, { useEffect, useState, useCallback } from "react";
import { Container, Typography, CircularProgress, Box, Paper, Button } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import fetch3DayForecast from "./api";

import NavBar from "./components/NavBar";
import ForecastDisplay from "./components/ForecastDisplay";
import ForecastGraphs from "./components/ForecastGraphs";
import ForecastSummary from "./components/ForecastSummary";
import ForecastBreakdown3Hourly from "./components/ForecastBreakdown3Hourly";

const theme = createTheme({
  palette: { mode: "light" },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", "Helvetica", "Arial", sans-serif',
  },
});

const safeNumber = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

const normalizeArray = (val) => {
  if (Array.isArray(val)) {
    if (val.length === 1) return safeNumber(val[0]);
    return val.map((x) => safeNumber(x)).filter((n) => n != null);
  }
  return safeNumber(val);
};

const kpFromItem = (it) => {
  const arr = normalizeArray(it?.kp_index ?? it?.kp);
  if (Array.isArray(arr)) return arr.length ? Math.max(...arr) : null;
  return arr;
};

const apFromItem = (it, kp) => {
  const explicit = normalizeArray(it?.a_index ?? it?.ap ?? it?.ap_index);
  if (explicit != null && !Array.isArray(explicit)) return explicit;
  if (kp == null) return null;
  const table = { 0: 0, 1: 4, 2: 7, 3: 15, 4: 27, 5: 48, 6: 80, 7: 132, 8: 224, 9: 400 };
  return table[Math.round(kp)] ?? null;
};

const solarFromItem = (it) => {
  const arr = normalizeArray(it?.solar_radiation ?? it?.solar ?? it?.radio_flux);
  if (Array.isArray(arr)) return arr.length ? arr[0] : null;
  return arr;
};

const radioFromItem = (it) => it?.radio_blackout ?? it?.radio ?? it?.radio_blackout_obj ?? null;

const parseToDateObj = (dateVal) => {
  if (!dateVal && dateVal !== 0) return null;
  if (dateVal instanceof Date) return Number.isNaN(dateVal.getTime()) ? null : dateVal;
  const s = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    const dt = new Date(s + "Z");
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const dt = new Date(n);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toISOKey = (d) => (d instanceof Date ? d.toISOString().split("T")[0] : null);

function App() {
  const [rawItems, setRawItems] = useState([]);
  const [displayItems, setDisplayItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [fetchErrorObj, setFetchErrorObj] = useState(null);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setFetchErrorObj(null);

    try {
      const arr = await fetch3DayForecast();
      console.info("[App] raw fetch3DayForecast response:", arr);

      // Map to parsed dates when possible
      const mapped = arr
        .map((it) => {
          const candidates = [it?.date, it?.dt, it?.issued, it?.timestamp, it?.date_string, it?._id?.$date, it?._id];
          let parsed = null;
          for (const c of candidates) {
            parsed = parseToDateObj(c);
            if (parsed) break;
          }
          if (!parsed && it && typeof it === "object") {
            for (const v of Object.values(it)) {
              parsed = parseToDateObj(v);
              if (parsed) break;
            }
          }
          return { raw: it, parsedDate: parsed };
        })
        .filter((x) => x.parsedDate instanceof Date);

      let chosen = [];
      if (mapped.length > 0) {
        mapped.sort((a, b) => a.parsedDate - b.parsedDate);
        const last3 = mapped.slice(-3);
        chosen = last3.map((m) => ({ targetDate: m.parsedDate, raw: m.raw }));
      } else {
        const lastRaw = arr.slice(-3);
        chosen = lastRaw.map((r) => ({ targetDate: parseToDateObj(r?.date ?? r?.dt ?? null), raw: r }));
      }

      const final = chosen.map((s, idx) => {
        const raw = s.raw ?? null;
        const parsedDate = s.targetDate ?? parseToDateObj(raw?.date ?? raw?.dt ?? raw?.issued ?? null);
        const kp = raw ? kpFromItem(raw) : null;
        const ap = raw ? apFromItem(raw, kp) : null;
        const solar = raw ? solarFromItem(raw) : null;
        const radio = raw ? radioFromItem(raw) : null;
        return {
          idx,
          raw,
          parsedDate,
          dateLabel: parsedDate ? toISOKey(parsedDate) : null,
          kp,
          ap,
          solar,
          radio,
        };
      });

      console.info("[App] selected display dates:", final.map((f) => f.dateLabel));

      setRawItems(arr);
      setDisplayItems(final);
    } catch (err) {
      console.error("[App] loadForecast error:", err);
      setFetchError(err.message || "Failed to fetch 3-day forecast");
      setFetchErrorObj(err);
      setRawItems([]);
      setDisplayItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const handleRefresh = async () => {
    await loadForecast();
  };

  return (
    <ThemeProvider theme={theme}>
      <NavBar />

      <Container maxWidth="lg" sx={{ pb: 6 }}>
        <Box mb={4} mt={4}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" my={6} gap={2}>
              <CircularProgress />
              <Typography>Loading forecast…</Typography>
            </Box>
          ) : fetchError ? (
            <Paper sx={{ p: 2, bgcolor: "#fff3f3", border: "1px solid #ffdede" }}>
              <Box display="flex" gap={2} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="error" sx={{ fontWeight: 700 }}>
                    Error loading forecast
                  </Typography>
                  <Typography color="error" sx={{ mt: 1 }}>
                    {fetchError}
                  </Typography>
                  {fetchErrorObj?.serverBody && (
                    <Box mt={1}>
                      <Typography variant="caption" sx={{ color: "#333" }}>
                        Server response:
                      </Typography>
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{String(fetchErrorObj.serverBody)}</pre>
                    </Box>
                  )}
                </Box>

                <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                  <Button variant="contained" onClick={handleRefresh}>
                    Retry
                  </Button>
                </Box>
              </Box>
            </Paper>
          ) : (
            <Box>
              <ForecastDisplay forecast={displayItems} onRefresh={handleRefresh} backendErrorMessage={null} />
            </Box>
          )}
        </Box>

        <Box mt={6}>
          <ForecastGraphs data={displayItems} />
        </Box>

        <Box mt={4}>
          <ForecastSummary rawData={rawItems} forecast={displayItems} />
        </Box>

        <Box mt={4} mb={8}>
          <ForecastBreakdown3Hourly rawData={rawItems} />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
