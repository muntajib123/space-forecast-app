// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Logs build-time env so you can verify Vercel baked the variable.
// - Normalizes multiple response shapes (array or { data/predictions/results: [] }).
// - Normalizes each item into a canonical shape consumed by the UI.
// - Supports optional timeout and tries trailing-slash variant.

const RAW_API_BASE = process.env.REACT_APP_API_BASE || "";
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, ""); // remove trailing slash(s)

// Debug: shows what value was baked into the bundle at build time.
console.info("BUILD: REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE || "(empty)");

// Build canonical endpoints to try (without and with trailing slash)
const makeEndpoints = () => {
  // If API_BASE is empty -> use relative "/api/..." path.
  // If API_BASE is set (absolute or relative), join carefully.
  const base = API_BASE || "";
  const candidates = [];

  if (!base) {
    candidates.push("/api/predictions/3day");
    candidates.push("/api/predictions/3day/");
  } else {
    // base could be e.g. "https://space-forecast-app-1.onrender.com" or "https://example.com/api"
    // ensure we don't produce double slashes when joining
    const join = (b, p) => {
      if (b.endsWith("/")) b = b.replace(/\/+$/, "");
      if (!p.startsWith("/")) p = `/${p}`;
      return `${b}${p}`;
    };
    candidates.push(join(base, "/api/predictions/3day"));
    candidates.push(join(base, "/api/predictions/3day/"));
  }

  // dedupe while preserving order
  return [...new Set(candidates)];
};

// Helper: normalize server JSON into an array the UI expects
function normalizeResponse(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === "object") {
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.predictions)) return json.predictions;
    if (Array.isArray(json.results)) return json.results;
    // If server returns object containing array under any key, pick first array found
    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k])) return json[k];
    }
  }
  return [];
}

/* ---------- Normalizer: convert various server item shapes into canonical shape ---------- */

function _pickFirst(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return undefined;
}

function _toNumberOrNull(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    // Allow comma or space trimmed numbers
    const cleaned = v.replace(/[, ]+/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Normalize a single forecast item into canonical fields the UI expects:
 * {
 *   date: string | null,
 *   kp_index: number | null,
 *   a_index: number | null,
 *   solar_radiation: number | null,
 *   radio_flux: number | null,
 *   radio_blackout: object|string|null,
 *   source: string|null,
 *   raw: originalItem
 * }
 */
export function normalizeForecastItem(raw = {}) {
  const r = raw || {};

  // Date — common keys
  const date =
    _pickFirst(r, "date", "forecast_date", "forecastDate", "date_iso", "created_at", "issued") || null;

  // KP: many variants: kp_index, kp_daily_avg, kpDailyAvg, kp, kpIndex
  const kpCandidate =
    _pickFirst(
      r,
      "kp_index",
      "kp_daily_avg",
      "kpDailyAvg",
      "kp",
      "kpIndex",
      "kp_daily_mean",
      "kp_mean",
      "kp_values",
      "kp_series"
    );

  // If kpCandidate is an array of hourly values, compute mean
  let kp_val = null;
  if (Array.isArray(kpCandidate) && kpCandidate.length) {
    const nums = kpCandidate
      .map((n) => (typeof n === "string" ? parseFloat(n) : n))
      .filter((n) => typeof n === "number" && Number.isFinite(n));
    if (nums.length) kp_val = nums.reduce((a, b) => a + b, 0) / nums.length;
  } else {
    kp_val = _toNumberOrNull(kpCandidate);
  }

  // Ap / A-index
  const aCandidate = _pickFirst(r, "a_index", "ap_index", "ap", "aIndex", "a_index_mean");
  const a_val = _toNumberOrNull(aCandidate);

  // Solar radiation
  let solarCandidate = _pickFirst(
    r,
    "solar_radiation",
    "solarRadiation",
    "solar_radiation_value",
    "solar",
    "f107",
    "f10_7"
  );
  let solar_val = null;
  if (solarCandidate != null) {
    if (Array.isArray(solarCandidate) && solarCandidate.length) {
      solar_val = _toNumberOrNull(solarCandidate[0]);
    } else if (typeof solarCandidate === "object") {
      solar_val = _toNumberOrNull(_pickFirst(solarCandidate, "value", "S1 or greater", "S1"));
    } else {
      solar_val = _toNumberOrNull(solarCandidate);
    }
  }

  // Radio blackout (object or string)
  const radio_blackout =
    _pickFirst(r, "radio_blackout", "radioBlackout", "radio_blackout_summary", "radioBlackoutSummary", "radio") ||
    null;

  // radio_flux
  const radio_flux = _toNumberOrNull(_pickFirst(r, "radio_flux", "radioFlux"));

  const source = _pickFirst(r, "source", "model", "generated_by") || null;

  return {
    date,
    kp_index: kp_val,
    a_index: a_val,
    solar_radiation: solar_val,
    radio_flux,
    radio_blackout,
    source,
    raw: r,
  };
}

/* ---------- Main fetch function ---------- */

/**
 * Fetch 3-day forecast.
 * @param {Object} options
 * @param {number} options.timeoutMs timeout in ms (default 15000)
 * @returns {Promise<Array>} array of normalized forecast items (may be empty)
 */
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
          if (bodyPreview && bodyPreview.length > 500) bodyPreview = bodyPreview.slice(0, 500) + "…";
        } catch (e) {
          bodyPreview = "";
        }
        console.warn(
          `[api] non-ok response from ${url}: ${statusText}`,
          bodyPreview ? `| preview: ${bodyPreview}` : ""
        );
        continue;
      }

      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        console.warn(`[api] failed to parse JSON from ${url}:`, e && e.message ? e.message : e);
        try {
          const txt = await res.text();
          console.info("[api] response text preview:", txt.slice(0, 1000));
        } catch (_) {}
        continue;
      }

      console.info("[api] raw json:", json);

      const items = normalizeResponse(json);
      console.info("[api] raw items count:", items.length);

      // Normalize each item into canonical fields
      const normalized = items.map((it) => normalizeForecastItem(it));
      console.info("[api] normalized items preview:", normalized.slice(0, 5));

      return normalized;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[api] fetch error for ${url}:`, err && err.message ? err.message : err);
      // try next candidate
    }
  }

  console.warn("[api] all endpoint variants failed — returning empty array");
  return [];
}
