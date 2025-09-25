// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Ap Index derived from fractional Kp Index (thirds-aware)
// - Force Solar Radiation = 1%
// - Force Radio Blackout = R1-R2: 35%, R3 or greater: 1%

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
function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function avg(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const nums = arr.map((x) => safeNum(x)).filter((n) => n !== null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Convert Kp → Ap using thirds lookup (index = round(kp * 3))
// returns null if kp invalid
function kpToAp(kp) {
  if (kp === null || kp === undefined) return null;
  const kpf = Number(kp);
  if (Number.isNaN(kpf)) return null;

  // NOAA-like AP lookup for Kp in thirds:
  // indices 0..27 correspond to Kp = 0.00, 0.33, 0.67, 1.00, ..., 9.00
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
// Takes backend response (various shapes) and returns an array of per-day
// normalized objects with fields the frontend expects.
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) return [];

  // Force values requested
  const SOLAR_PCT = 1;           // 1%
  const RADIO_R1R2 = 35;        // 35%
  const RADIO_R3PLUS = 1;       // 1%

  // determine if docs contain daily arrays
  const daysFromArrays = Math.max(
    0,
    ...preds.map((p) => (Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0))
  );

  const treatsAsPerDay = daysFromArrays === 0 && preds.length > 0;
  const maxDays = treatsAsPerDay ? preds.length : (daysFromArrays || 3);

  // choose earliest date across docs to anchor date-only rows
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

  const out = [];

  for (let i = 0; i < maxDays; i++) {
    // compute kp candidate values for this day
    const kpCandidates = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        if (idx !== i) return null;
        // per-day doc: prefer daily_avg_kp_next3days[0] if present, else avg(kp_index) if present
        if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length) return safeNum(p.daily_avg_kp_next3days[0]);
        if (Array.isArray(p.kp_index) && p.kp_index.length) return avg(p.kp_index);
        if (p.kp_value != null) return safeNum(p.kp_value);
        return null;
      } else {
        // docs with arrays: take p.daily_avg_kp_next3days[i] if present
        if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length > i) {
          return safeNum(p.daily_avg_kp_next3days[i]);
        }
        // fallback: if p.kp_index is array, average it (approx per-doc)
        if (Array.isArray(p.kp_index) && p.kp_index.length) return avg(p.kp_index);
        return null;
      }
    });

    const kpVal = avg(kpCandidates);

    // compute date for this row (UTC date-only)
    const rowDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    rowDate.setUTCDate(rowDate.getUTCDate() + i);

    // Ap: prefer backend-provided a_index/ap if exists for this day, else compute
    let providedA = null;
    let providedAp = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      if (treatsAsPerDay && j !== i) continue;

      // direct scalar
      if (p.a_index != null && providedA == null) providedA = safeNum(p.a_index);
      if (p.ap != null && providedAp == null) providedAp = safeNum(p.ap);

      // array entries
      if (Array.isArray(p.a_index) && p.a_index.length > i && providedA == null) providedA = safeNum(p.a_index[i]);
      if (Array.isArray(p.ap) && p.ap.length > i && providedAp == null) providedAp = safeNum(p.ap[i]);
    }

    const apComputed = kpVal != null ? kpToAp(kpVal) : null;
    const finalAp = providedAp != null ? providedAp : apComputed;
    const finalAIndex = providedA != null ? providedA : finalAp;

    // Build radio/solar forced values (user requested these hard-coded)
    const radioObj = {
      "R1-R2": RADIO_R1R2,
      "R3 or greater": RADIO_R3PLUS,
    };

    out.push({
      date: rowDate.toISOString().slice(0, 10),
      // keep kp_index as numeric (rounded)
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      // both names available so frontend code can find whichever it expects
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,
      // Solar: forced to 1%
      solar_radiation: SOLAR_PCT,
      solar_radiation_pct: SOLAR_PCT,
      solar_radiation_label: `${SOLAR_PCT}% (Minor)`,
      // Radio blackout forced as requested
      radio_blackout: radioObj,
      radio_blackout_pct: RADIO_R1R2, // main value for display column
      radio_blackout_label: `R1-R2: ${RADIO_R1R2}%  |  R3+: ${RADIO_R3PLUS}%`,
      r3_or_greater: `${RADIO_R3PLUS}%`,
      source: "Fixed NOAA-style dummy values (solar=1%, radio=R1-R2:35%, R3+:1%)",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, original: p })),
    });
  }

  return out;
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
        console.warn(`[api] non-ok response from ${url}: ${res.status}`);
        continue;
      }

      let json;
      try {
        json = await res.json();
      } catch (e) {
        console.warn(`[api] failed to parse JSON from ${url}:`, e && e.message ? e.message : e);
        continue;
      }

      console.info("[api] raw json:", json);
      const normalized = normalizePredictions(json);
      console.info("[api] normalized items preview:", normalized);
      return normalized;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[api] fetch error for ${url}:`, err && err.message ? err.message : err);
    }
  }

  console.warn("[api] all endpoint variants failed — returning empty array");
  return [];
}
