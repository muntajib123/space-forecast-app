// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Force Solar Radiation = 1%
// - Force Radio Blackout = { R1–R2: 35%, R3+: 1% } per day

// ============================================================================
// Base setup
// ============================================================================
const RAW_API_BASE = process.env.REACT_APP_API_BASE || "";
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, "");

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
function avgNums(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Convert Kp → Ap using a thirds lookup (index = round(kp * 3))
function kpToAp(kp) {
  if (kp === null || kp === undefined) return null;
  const kpf = Number(kp);
  if (Number.isNaN(kpf)) return null;

  const AP_LOOKUP = [
     0,  2,  3,  4,  5,  6,  7,  9, 12, 15, 18, 22, 27, 32,
    39, 48, 56, 67, 80, 94,111,132,154,179,207,236,300,400
  ];

  let index = Math.round(kpf * 3);
  if (index < 0) index = 0;
  if (index > AP_LOOKUP.length - 1) index = AP_LOOKUP.length - 1;
  return AP_LOOKUP[index];
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

  // Fixed dummy values
  const SOLAR_PCT = 1;
  const RADIO_R1R2 = 35;
  const RADIO_R3PLUS = 1;

  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0
    )
  );

  const treatsAsPerDay = days === 0 && preds.length > 0;
  const maxDays = treatsAsPerDay ? preds.length : days || 3; // default to 3 days

  // Base date
  let earliestDate = null;
  for (const p of preds) {
    const cand = p.date || p.forecast_date || p.timestamp || null;
    if (!cand) continue;
    const d = new Date(cand);
    if (!isNaN(d.getTime())) {
      if (!earliestDate || d < earliestDate) earliestDate = d;
    }
  }
  const baseDate = earliestDate ? new Date(earliestDate) : new Date();

  const result = [];

  const avg = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nums = arr
      .map((v) => (v === null || v === undefined ? null : Number(v)))
      .filter((v) => v !== null && !Number.isNaN(v));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  for (let i = 0; i < maxDays; i++) {
    // Kp value
    const kpVals = preds.map((p, idx) => {
      if (treatsAsPerDay && idx === i) {
        if (Array.isArray(p.kp_index)) return avg(p.kp_index);
        if (p.kp_value != null) return Number(p.kp_value);
      }
      if (Array.isArray(p.daily_avg_kp_next3days)) {
        return p.daily_avg_kp_next3days[i] ?? null;
      }
      return null;
    });
    const kpVal = avg(kpVals);

    // Date
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // Ap
    const apComputed = kpVal != null ? kpToAp(kpVal) : null;

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      ap: apComputed,
      a_index: apComputed,
      solar_radiation_pct: SOLAR_PCT,
      solar_radiation_label: `${SOLAR_PCT}% (Minor)`,
      radio_blackout_pct: RADIO_R1R2,
      radio_blackout_label: `${RADIO_R1R2}% R1–R2 | ${RADIO_R3PLUS}% R3+`,
      r3_or_greater: `${RADIO_R3PLUS}%`,
      source: "Fixed NOAA-style dummy values",
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
        continue;
      }

      let json;
      try {
        json = await res.json();
      } catch {
        continue;
      }

      const normalized = normalizePredictions(json);
      console.info("[api] normalized items preview:", normalized);
      return normalized;
    } catch {
      clearTimeout(timer);
    }
  }

  return [];
}
