// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Accepts multiple backend shapes (array-of-day-docs OR docs-with-daily-arrays)
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Force Solar Radiation = 1%
// - Force Radio Blackout = 35% (R1–R2)

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
// Small helpers (define before use)
// ============================================================================
function avgNums(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function findFirst(arr, fn) {
  for (const x of arr) {
    try {
      const v = fn(x);
      if (v !== null && v !== undefined) return v;
    } catch {}
  }
  return null;
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
// Normalizer (REPLACE existing normalizePredictions with this)
// ============================================================================
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) return [];

  // how many days (use maximum length found among documents)
  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days.length
        : 0
    )
  );
  // if no daily_avg arrays, fall back to treating docs as 1-per-day
  const treatsAsPerDay = days === 0 && preds.length > 0;
  const maxDays = treatsAsPerDay ? preds.length : days;
  if (!maxDays) return [];

  // Prefer earliest date available across preds (safer than using preds[0])
  let earliestDate = null;
  for (const p of preds) {
    const cand = p.date || p.forecast_date || p.timestamp || null;
    if (!cand) continue;
    const d = new Date(cand);
    if (!isNaN(d.getTime())) {
      if (!earliestDate || d < earliestDate) earliestDate = d;
    }
  }
  // fallback to today if somehow no date present
  const baseDate = earliestDate ? new Date(earliestDate) : new Date();

  const result = [];

  // helper: compute average of array-like values (safe)
  const avg = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nums = arr
      .map((v) => (v === null || v === undefined ? null : Number(v)))
      .filter((v) => v !== null && !Number.isNaN(v));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  for (let i = 0; i < maxDays; i++) {
    // collect candidate Kp values (from daily_avg_kp_next3days OR kp_index arrays as fallback)
    const kpVals = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        // one-doc-per-day: pick the doc for this day index if present
        if (idx === i) {
          // try daily_avg_kp_next3days first, then kp_index, then kp_value
          if (Array.isArray(p.daily_avg_kp_next3days)) return avg([p.daily_avg_kp_next3days[0]]);
          if (Array.isArray(p.kp_index)) return avg(p.kp_index);
          if (p.kp_value != null) return Number(p.kp_value);
        }
        return null;
      } else {
        // multi-day arrays inside each doc: try daily_avg_kp_next3days[i]
        if (Array.isArray(p.daily_avg_kp_next3days)) {
          return p.daily_avg_kp_next3days[i] ?? null;
        }
        // fallback: some docs include kp_index arrays (8 values per day-slice); average them
        if (Array.isArray(p.kp_index)) {
          return avg(p.kp_index);
        }
        return null;
      }
    });

    const kpVal = avg(kpVals);

    // date for this row - preserve UTC date-only semantics
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // Prefer backend-provided a_index/ap if any doc has it for this day:
    // check each doc for a_index/ap matching this day (handles both per-day docs and array-of-days)
    let providedA = null;
    let providedAp = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      // if per-day docs (treatsAsPerDay), match index j === i
      if (treatsAsPerDay && j !== i) continue;

      // direct fields
      if (p.a_index != null) providedA = Number(p.a_index);
      if (p.ap != null) providedAp = Number(p.ap);

      // if doc has arrays, try to pick element [i]
      if (Array.isArray(p.a_index) && p.a_index[i] != null) providedA = Number(p.a_index[i]);
      if (Array.isArray(p.ap) && p.ap[i] != null) providedAp = Number(p.ap[i]);
    }

    // compute ap from kp if not provided
    const apComputed = kpVal != null ? kpToAp(kpVal) : null;
    // choose the best ap/a_index: prefer provided, else computed
    const finalAp = providedAp != null ? providedAp : apComputed;
    const finalAIndex = providedA != null ? providedA : finalAp;

    // Solar & blackout: prefer *_pct fields, then radio_flux/solar_radiation as fallback
    // Find a document that represents this day (prefer per-day doc or first doc)
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      // if preds hold arrays, pick the doc that has radio_flux or solar_radiation arrays
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.solar_radiation) || Array.isArray(p.kp_index)) ?? preds[0];
    }

    const solarPct = (dayDoc && (dayDoc.solar_radiation_pct ?? dayDoc.solar_radiation_pct === 0)) ? dayDoc.solar_radiation_pct : null;
    const blackoutPct = (dayDoc && (dayDoc.radio_blackout_pct ?? dayDoc.radio_blackout_pct === 0)) ? dayDoc.radio_blackout_pct : null;

    // fallback: if solar_pct missing but radio_flux exists, we can format radio_flux for display as "solar_radiation"
    const radioFluxVal = dayDoc && Array.isArray(dayDoc.radio_flux) ? avg(dayDoc.radio_flux) : (dayDoc && (dayDoc.radio_flux ?? null));
    const solarFluxFallback = radioFluxVal != null ? radioFluxVal : null;

    const solar_label = solarPct != null ? `${solarPct}% (Minor)` : (solarFluxFallback != null ? `${Number(solarFluxFallback).toFixed(2)}` : "N/A");
    const blackout_label = blackoutPct != null ? `${blackoutPct}% R1–R2` : "None";

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      // both names present (some code expects a_index, some expects ap)
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,
      // solar/radio values: prefer percent fields then flux fallback
      solar_radiation_pct: solarPct != null ? solarPct : null,
      solar_radiation_label: solar_label,
      radio_flux: radioFluxVal != null ? radioFluxVal : null,
      radio_blackout_pct: blackoutPct != null ? blackoutPct : null,
      radio_blackout_label: blackout_label,
      r3_or_greater: dayDoc && dayDoc.r3_or_greater ? dayDoc.r3_or_greater : "None",
      source: dayDoc && dayDoc.source ? dayDoc.source : "LSTM + Ap from Kp + fixed extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, original: p })),
    });
  }

  return result;
}
