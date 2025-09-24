// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// Updated to handle backend predictions with daily_avg_kp_next3days
// ✅ Forces forecast dates to start from today + 2 days
// ✅ Inserts dummy Solar Radiation and Radio Blackout values

// ============================================================================
// Base setup
// ============================================================================
const RAW_API_BASE = process.env.REACT_APP_API_BASE || "";
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, ""); // remove trailing slash(s)

console.info("BUILD: REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE || "(empty)");

const makeEndpoints = () => {
  const base = API_BASE || "";
  const candidates = [];
  if (!base) {
    candidates.push("/api/predictions/3day", "/api/predictions/3day/");
  } else {
    const join = (b, p) => {
      if (b.endsWith("/")) b = b.replace(/\/+$/, "");
      if (!p.startsWith("/")) p = `/${p}`;
      return `${b}${p}`;
    };
    candidates.push(join(base, "/api/predictions/3day"));
    candidates.push(join(base, "/api/predictions/3day/"));
  }
  return [...new Set(candidates)];
};

// ============================================================================
// Helpers
// ============================================================================
function avg(nums = []) {
  const filtered = nums.filter(
    (n) => n !== null && n !== undefined && !Number.isNaN(Number(n))
  );
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + Number(b), 0) / filtered.length;
}

function normalizeResponse(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === "object") {
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.predictions)) return json.predictions;
    if (Array.isArray(json.results)) return json.results;
    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k])) return json[k];
    }
  }
  return [];
}

// ============================================================================
// Normalizer
// ============================================================================
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) return [];

  // determine number of days available
  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days.length
        : 0
    )
  );
  if (!days) return [];

  // ✅ Start from today + 2 days
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 2);

  // Dummy pools (based on NOAA sample data you shared)
  const solarPool = ["1%"]; // all days were 1% in NOAA forecast
  const blackoutPool = ["35% R1-R2", "1% R3+", "None"];

  const result = [];

  for (let i = 0; i < days; i++) {
    // collect the ith value from each prediction
    const vals = preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days[i]
        : null
    );
    const kpVal = avg(vals);

    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);

    result.push({
      date: d.toISOString().slice(0, 10), // YYYY-MM-DD
      kp_index: kpVal !== null ? Math.round(kpVal * 100) / 100 : null,
      a_index: null, // left null → shows N/A unless backend provides
      solar_radiation: solarPool[Math.floor(Math.random() * solarPool.length)],
      radio_flux: null,
      radio_blackout: blackoutPool[Math.floor(Math.random() * blackoutPool.length)],
      source: "LSTM + dummy values",
      raw: preds.map((p) => ({ id: p._id, date: p.date })),
    });
  }
  return result;
}

// ============================================================================
// Fetch function
// ============================================================================
export default async function fetch3DayForecast({ timeoutMs = 15000 } = {}) {
  const endpoints = makeEndpoints();

  for (const url of endpoints) {
    console.info("[api] fetching", url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const statusText = `${res.status} ${res.statusText || ""}`.trim();
        let bodyPreview = "";
        try {
          bodyPreview = await res.text();
          if (bodyPreview.length > 500)
            bodyPreview = bodyPreview.slice(0, 500) + "…";
        } catch {}
        console.warn(
          `[api] non-ok response from ${url}: ${statusText}`,
          bodyPreview ? `| preview: ${bodyPreview}` : ""
        );
        continue;
      }

      let json;
      try {
        json = await res.json();
      } catch (e) {
        console.warn(`[api] failed to parse JSON from ${url}:`, e.message);
        continue;
      }

      console.info("[api] raw json:", json);

      const normalized = normalizePredictions(json);
      console.info("[api] normalized items preview:", normalized);

      return normalized;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[api] fetch error for ${url}:`, err.message || err);
    }
  }

  console.warn("[api] all endpoint variants failed — returning empty array");
  return [];
}
