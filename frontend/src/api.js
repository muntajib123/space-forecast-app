// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Accepts multiple backend shapes
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Force Solar Radiation = [1], solar_radiation_pct = 1
// - Force Radio Blackout = { "R1-R2": 35, "R3 or greater": 1 }

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

// ----------------- small helpers -----------------
function avg(nums = []) {
  const list = Array.isArray(nums) ? nums : [];
  const filtered = list
    .map((n) => (n === null || n === undefined ? NaN : Number(n)))
    .filter((n) => !Number.isNaN(n));
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

// --- Kp -> ap thirds-aware lookup (index = Math.round(kp * 3), range 0..27)
const AP_LOOKUP = [
   0,  2,  3,  4,  5,  6,  7,  9, 12, 15, 18, 22, 27, 32,
  39, 48, 56, 67, 80, 94,111,132,154,179,207,236,300,400
];

function kpToApSingle(kp) {
  if (kp === null || kp === undefined) return null;
  const asNum = Number(kp);
  if (Number.isNaN(asNum)) return null;
  let idx = Math.round(asNum * 3);
  if (idx < 0) idx = 0;
  if (idx > AP_LOOKUP.length - 1) idx = AP_LOOKUP.length - 1;
  return AP_LOOKUP[idx];
}

function padOrTruncateKpArray(arr) {
  // Ensure array of 8 numeric values. If arr is single number: replicate 8 times.
  let out = [];
  if (Array.isArray(arr)) {
    out = arr.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 3.0;
    });
  } else if (arr === null || arr === undefined) {
    out = [];
  } else {
    const n = Number(arr);
    out = [Number.isFinite(n) ? n : 3.0];
  }
  // If empty, default to eight 3.0 values (quiet)
  if (!out.length) out = Array(8).fill(3.0);
  // If single value, replicate
  if (out.length === 1) out = Array(8).fill(out[0]);
  // Truncate or pad using last value
  if (out.length > 8) out = out.slice(0, 8);
  while (out.length < 8) {
    out.push(out[out.length - 1]);
  }
  return out;
}

// CORRECT Ap computation: convert EACH of the 8 Kp values to ap via AP lookup then average those 8 ap values.
function computeApFromKpArray(kpArray) {
  const kp8 = padOrTruncateKpArray(kpArray);
  const apVals = kp8.map((k) => {
    const a = kpToApSingle(k);
    return a === null ? 0 : a;
  });
  const sum = apVals.reduce((s, v) => s + v, 0);
  const avgAp = sum / apVals.length;
  return Math.round(avgAp);
}

// Robust extraction: return array of prediction docs from many possible shapes
function normalizeResponse(json) {
  if (!json) return [];

  if (Array.isArray(json)) return json;

  if (typeof json === "object") {
    if (Array.isArray(json.data)) {
      console.info("[api] normalizeResponse: using json.data array");
      return json.data;
    }
    if (Array.isArray(json.predictions)) {
      console.info("[api] normalizeResponse: using json.predictions array");
      return json.predictions;
    }
    if (Array.isArray(json.results)) {
      console.info("[api] normalizeResponse: using json.results array");
      return json.results;
    }
    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k])) {
        console.info(`[api] normalizeResponse: using first array found under key='${k}'`);
        return json[k];
      }
    }
    const numKeys = Object.keys(json).filter((k) => /^[0-9]+$/.test(k)).sort((a,b) => Number(a)-Number(b));
    if (numKeys.length) {
      const arr = numKeys.map((k) => json[k]);
      console.info(`[api] normalizeResponse: converted numeric-key object -> array (len=${arr.length})`);
      return arr;
    }
  }

  console.warn("[api] normalizeResponse: could not find predictions array in JSON");
  return [];
}

// Build 3 placeholder quiet days (used when backend fails / returns nothing)
function buildPlaceholderThreeDays() {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const SOLAR_PCT = 1;
  const BLACKOUT_R1R2_PCT = 35;
  const BLACKOUT_R3_PCT = 1;
  const placeholderKp = Array(8).fill(3.0);
  const ap = computeApFromKpArray(placeholderKp);

  const res = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    res.push({
      date: d.toISOString().slice(0, 10),
      kp_index: placeholderKp.slice(),
      kp_avg: 3.0,
      a_index: ap,
      ap: ap,
      solar_radiation: [1],
      solar_radiation_pct: SOLAR_PCT,
      solar_radiation_label: `${SOLAR_PCT}% (Forced)`,
      radio_flux: null,
      radio_blackout: { "R1-R2": BLACKOUT_R1R2_PCT, "R3 or greater": BLACKOUT_R3_PCT },
      radio_blackout_pct: BLACKOUT_R1R2_PCT,
      radio_blackout_r3_pct: BLACKOUT_R3_PCT,
      radio_blackout_label: `R1-R2: ${BLACKOUT_R1R2_PCT}%, R3+: ${BLACKOUT_R3_PCT}%`,
      r3_or_greater: `${BLACKOUT_R3_PCT}%`,
      source: "placeholder",
      raw: [],
    });
  }
  return res;
}

// ============================================================================
// Full normalizer - returns an array of EXACTLY 3 day objects suitable for the UI
// ============================================================================

function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  console.info("[api] normalizePredictions: input preds length =", Array.isArray(preds) ? preds.length : typeof preds);

  if (!Array.isArray(preds) || preds.length === 0) {
    console.warn("[api] normalizePredictions: no predictions found — returning 3 quiet placeholders");
    return buildPlaceholderThreeDays();
  }

  // detect whether docs contain per-day arrays (daily_avg_kp_next3days etc.)
  const hasDailyArrays = preds.some((p) => Array.isArray(p.daily_avg_kp_next3days) || (Array.isArray(p.kp_index) && p.kp_index.length > 1));
  const treatsAsPerDay = !hasDailyArrays;

  // pick earliest date present across docs (safe baseline), keep as UTC-midnight
  let earliestDate = null;
  for (const p of preds) {
    const cand = p.date || p.forecast_date || p.timestamp || p.inserted_at || null;
    if (!cand) continue;
    const d = new Date(cand);
    if (!isNaN(d.getTime())) {
      if (!earliestDate || d < earliestDate) earliestDate = d;
    }
  }
  const baseDate = earliestDate ? new Date(Date.UTC(earliestDate.getUTCFullYear(), earliestDate.getUTCMonth(), earliestDate.getUTCDate())) : new Date(Date.UTC((new Date()).getUTCFullYear(), (new Date()).getUTCMonth(), (new Date()).getUTCDate()));

  // forced static values you asked for
  const SOLAR_PCT = 1;   // 1%
  const BLACKOUT_R1R2_PCT = 35; // 35%
  const BLACKOUT_R3_PCT = 1;    // 1%

  const out = [];

  for (let i = 0; i < 3; i++) {
    // Determine kp array for day i
    let kpArrayForDay = null;

    if (treatsAsPerDay) {
      const doc = preds[i] ?? preds[0];
      if (doc) {
        if (Array.isArray(doc.kp_index) && doc.kp_index.length >= 1) kpArrayForDay = doc.kp_index;
        else if (Array.isArray(doc.daily_avg_kp_next3days) && doc.daily_avg_kp_next3days.length) kpArrayForDay = [doc.daily_avg_kp_next3days[0]];
        else if (doc.kp_value != null) kpArrayForDay = [doc.kp_value];
      }
    } else {
      let found = false;
      for (const p of preds) {
        if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length > i && p.daily_avg_kp_next3days[i] != null) {
          kpArrayForDay = [p.daily_avg_kp_next3days[i]];
          found = true;
          break;
        }
      }
      if (!found) {
        for (const p of preds) {
          if (Array.isArray(p.kp_index) && p.kp_index.length > i && p.kp_index[i] != null) {
            kpArrayForDay = [p.kp_index[i]];
            found = true;
            break;
          }
        }
      }
      if (!found) {
        const cand = preds.map((p) => {
          if (Array.isArray(p.kp_index) && p.kp_index.length) return avg(p.kp_index);
          if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length > i) return p.daily_avg_kp_next3days[i];
          if (p.kp_value != null) return Number(p.kp_value);
          return null;
        }).filter((v) => v != null);
        if (cand.length) kpArrayForDay = [avg(cand)];
      }
    }

    // Ensure we have an array of 8 numbers
    const kp8 = padOrTruncateKpArray(kpArrayForDay);

    // compute kp average for convenience
    const kpAvg = Math.round((kp8.reduce((s, v) => s + v, 0) / kp8.length) * 100) / 100;

    // Find provided a_index/ap if backend supplies them (per-day or arrays)
    let providedA = null;
    let providedAp = null;
    if (treatsAsPerDay) {
      const p = preds[i] ?? preds[0];
      if (p) {
        if (p.a_index != null && !Array.isArray(p.a_index)) providedA = Number(p.a_index);
        if (p.ap != null && !Array.isArray(p.ap)) providedAp = Number(p.ap);
        if (Array.isArray(p.a_index) && p.a_index[i] != null) providedA = Number(p.a_index[i]);
        if (Array.isArray(p.ap) && p.ap[i] != null) providedAp = Number(p.ap[i]);
      }
    } else {
      for (const p of preds) {
        if (p == null) continue;
        if (p.ap != null && !Array.isArray(p.ap)) providedAp = Number(p.ap);
        if (p.a_index != null && !Array.isArray(p.a_index)) providedA = Number(p.a_index);
        if (Array.isArray(p.ap) && p.ap[i] != null) providedAp = Number(p.ap[i]);
        if (Array.isArray(p.a_index) && p.a_index[i] != null) providedA = Number(p.a_index[i]);
      }
    }

    // compute ap correctly from the full kp8 array (not from avg)
    const apFromKp = computeApFromKpArray(kp8);

    const finalAp = providedAp != null ? providedAp : apFromKp;
    const finalA = providedA != null ? providedA : finalAp;

    // choose a doc that represents the day (for radio_flux / source)
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.kp_index)) ?? preds[0];
    }

    // radio_flux fallback if backend provides it as number or single-element array
    let radioFluxVal = null;
    if (dayDoc) {
      if (Array.isArray(dayDoc.radio_flux) && dayDoc.radio_flux.length) {
        radioFluxVal = Number(dayDoc.radio_flux[0]);
      } else if (dayDoc.radio_flux != null) {
        const n = Number(dayDoc.radio_flux);
        radioFluxVal = Number.isFinite(n) ? n : null;
      }
    }

    const d = new Date(baseDate.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const isoYMD = d.toISOString().slice(0, 10);

    out.push({
      date: isoYMD,
      kp_index: kp8,
      kp_avg: kpAvg,
      a_index: finalA,
      ap: finalAp,
      // forced solar & radio blackout fields
      solar_radiation: [1],
      solar_radiation_pct: SOLAR_PCT,
      solar_radiation_label: `${SOLAR_PCT}% (Forced)`,
      radio_flux: radioFluxVal,
      radio_blackout: { "R1-R2": BLACKOUT_R1R2_PCT, "R3 or greater": BLACKOUT_R3_PCT },
      radio_blackout_pct: BLACKOUT_R1R2_PCT,
      radio_blackout_r3_pct: BLACKOUT_R3_PCT,
      radio_blackout_label: `R1-R2: ${BLACKOUT_R1R2_PCT}%, R3+: ${BLACKOUT_R3_PCT}%`,
      r3_or_greater: `${BLACKOUT_R3_PCT}%`,
      source: (dayDoc && (dayDoc.source || dayDoc._source || dayDoc.source_name)) ? (dayDoc.source || dayDoc._source || dayDoc.source_name) : "LSTM + Ap from Kp + forced extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, original: p })),
    });
  }

  console.info("[api] normalizePredictions: produced", out.length, "rows");
  return out;
}

// ============================================================================
// Fetch function (tries a couple of endpoint variants then returns normalized items)
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
        console.warn(`[api] non-ok response from ${url}: ${statusText}`, bodyPreview ? `| preview: ${bodyPreview}` : "");
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

      // ensure we always return an array of length 3
      if (!Array.isArray(normalized) || normalized.length !== 3) {
        console.warn("[api] normalized result not length 3 — returning placeholders");
        return buildPlaceholderThreeDays();
      }

      return normalized;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[api] fetch error for ${url}:`, err && err.message ? err.message : err);
    }
  }

  console.warn("[api] all endpoint variants failed — returning placeholders");
  return buildPlaceholderThreeDays();
}
