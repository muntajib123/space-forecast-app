// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// Handles backend predictions with daily_avg_kp_next3days,
// uses future-start = today + 3 days (so deployed on 25 -> shows 27,28,29),
// and extracts solar_radiation when present.

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

function formatDateYMD(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function pickFirst(obj = {}, keys = []) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ============================================================================
// Normalizer
// ============================================================================
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

/**
 * Convert backend { predictions: [...] } into N forecast items for UI
 * Start date = today (UTC midnight) + 3 days so day1=+3, day2=+4, day3=+5
 */
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

  // Start at TODAY + 3 (so 25 -> 27). Adjust +N if you want a different offset.
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 3);

  const result = [];

  for (let i = 0; i < days; i++) {
    // collect the i-th daily_avg_kp from each prediction run
    const vals = preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days[i] : null
    );
    const kpVal = avg(vals);

    // attempt to extract solar radiation / flux if backend provides any of these keys
    // common possible keys: solar_radiation, solarRadiation, f107, f10_7, solar_flux
    // we inspect first prediction objects for a potential scalar to show
    let solarVal = null;
    for (const p of preds) {
      const candidate = pickFirst(p, [
        "solar_radiation",
        "solarRadiation",
        "f107",
        "f10_7",
        "solar_flux",
        "solarFlux",
      ]);
      if (candidate != null) {
        // If it's an array, try first element. If object, pick 'value' if present.
        if (Array.isArray(candidate) && candidate.length) {
          solarVal = toNumberOrNull(candidate[0]);
        } else if (typeof candidate === "object") {
          solarVal = toNumberOrNull(pickFirst(candidate, ["value", "v", "flux"]));
        } else {
          solarVal = toNumberOrNull(candidate);
        }
        if (solarVal !== null) break;
      }
    }

    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);

    result.push({
      date: formatDateYMD(d),
      kp_index: kpVal !== null ? Math.round(kpVal * 100) / 100 : null,
      a_index: null, // AP/A index not provided by backend (keep null)
      solar_radiation: solarVal, // may be null if backend doesn't provide
      radio_flux: null,
      radio_blackout: null,
      source: "LSTM",
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
          if (bodyPreview.length > 500) bodyPreview = bodyPreview.slice(0, 500) + "…";
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
        console.warn(`[api] failed to parse JSON from ${url}:`, e.message || e);
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
