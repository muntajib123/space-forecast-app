// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Accepts multiple backend shapes (array-of-day-docs OR docs-with-daily-arrays)
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Force Solar Radiation = 1%
// - Force Radio Blackout = R1-R2: 35%, R3 or greater: 1%

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

// Convert Kp → Ap using a thirds lookup (index = round(kp * 3))
// indices 0..27 correspond to Kp = 0.00, 0.33, 0.67, 1.00, ... up to 9.00
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

// Robust extraction: return array of prediction docs from many possible shapes
function normalizeResponse(json) {
  if (!json) return [];

  if (Array.isArray(json)) return json;

  if (typeof json === "object") {
    // common wrapper names
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
    // first array field we find
    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k])) {
        console.info(`[api] normalizeResponse: using first array found under key='${k}'`);
        return json[k];
      }
    }
    // numeric keys -> object like { "0": {...}, "1": {...} }
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

// ============================================================================
// Full normalizer - returns an array of day objects suitable for the UI
// Each row will include:
//   date, kp_index (number), a_index, ap, solar_radiation_pct, solar_radiation_label,
//   radio_flux, radio_blackout_pct, radio_blackout_label, r3_or_greater, source, raw
// ============================================================================

function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  console.info("[api] normalizePredictions: input preds length =", Array.isArray(preds) ? preds.length : typeof preds);

  if (!Array.isArray(preds) || preds.length === 0) return [];

  // detect whether docs contain per-day arrays (daily_avg_kp_next3days etc.)
  const hasDailyArrays = preds.some((p) => Array.isArray(p.daily_avg_kp_next3days));
  // If no daily arrays, treat each doc as one day
  const treatsAsPerDay = !hasDailyArrays;

  const daysCount = treatsAsPerDay ? preds.length : Math.max(...preds.map((p) => (Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0)));
  if (!daysCount) {
    console.warn("[api] normalizePredictions: computed daysCount === 0");
    return [];
  }

  // pick earliest date present across docs (safe baseline)
  let earliestDate = null;
  for (const p of preds) {
    const cand = p.date || p.forecast_date || p.timestamp || p.inserted_at || null;
    if (!cand) continue;
    const d = new Date(cand);
    if (!isNaN(d.getTime())) {
      if (!earliestDate || d < earliestDate) earliestDate = d;
    }
  }
  const baseDate = earliestDate ? new Date(earliestDate) : new Date();

  // forced static values you asked for
  const SOLAR_PCT = 1;   // 1%
  const BLACKOUT_R1R2_PCT = 35; // 35%
  const BLACKOUT_R3_PCT = 1;    // 1%

  const out = [];

  for (let i = 0; i < daysCount; i++) {
    // Collect Kp candidates
    const kpCandidates = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        // one-doc-per-day mapping: use document at same index if present
        if (idx !== i) return null;
        if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length) {
          return avg([p.daily_avg_kp_next3days[0]]);
        }
        if (Array.isArray(p.kp_index) && p.kp_index.length) {
          return avg(p.kp_index);
        }
        if (p.kp_value != null) return Number(p.kp_value);
        return null;
      } else {
        // doc contains arrays for multiple days; pick element i if present
        if (Array.isArray(p.daily_avg_kp_next3days)) {
          return p.daily_avg_kp_next3days[i] ?? null;
        }
        // fallback: average any kp_index array present
        if (Array.isArray(p.kp_index) && p.kp_index.length) {
          return avg(p.kp_index);
        }
        if (p.kp_value != null) return Number(p.kp_value);
        return null;
      }
    });

    const kpVal = avg(kpCandidates);

    // Determine AP/A_INDEX prefer backend-provided values if present
    let providedA = null;
    let providedAp = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      if (treatsAsPerDay && j !== i) continue;

      if (p.a_index != null && !(Array.isArray(p.a_index))) providedA = Number(p.a_index);
      if (p.ap != null && !(Array.isArray(p.ap))) providedAp = Number(p.ap);

      if (Array.isArray(p.a_index) && p.a_index[i] != null) providedA = Number(p.a_index[i]);
      if (Array.isArray(p.ap) && p.ap[i] != null) providedAp = Number(p.ap[i]);
    }

    const apFromKp = kpVal != null ? kpToAp(kpVal) : null;
    const finalAp = providedAp != null ? providedAp : apFromKp;
    const finalAIndex = providedA != null ? providedA : finalAp;

    // choose a doc that represents the day (for solar/radio fields)
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      // prefer doc that has arrays (likely baseline doc)
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.kp_index)) ?? preds[0];
    }

    // radio/solar override per your request:
    const solar_pct = SOLAR_PCT;
    const blackout_pct = BLACKOUT_R1R2_PCT; // R1-R2
    const r3_pct = BLACKOUT_R3_PCT;

    // radio_flux fallback if backend provides it as number or single-element array
    let radioFluxVal = null;
    if (dayDoc) {
      if (Array.isArray(dayDoc.radio_flux) && dayDoc.radio_flux.length) {
        radioFluxVal = Number(dayDoc.radio_flux[0]);
      } else if (dayDoc.radio_flux != null) {
        radioFluxVal = Number(dayDoc.radio_flux);
      }
    }

    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    out.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,
      solar_radiation_pct: solar_pct,
      solar_radiation_label: `${solar_pct}% (Forced)`,
      radio_flux: radioFluxVal != null ? radioFluxVal : null,
      radio_blackout_pct: blackout_pct,
      radio_blackout_label: `R1-R2: ${blackout_pct}%, R3+: ${r3_pct}%`,
      r3_or_greater: `${r3_pct}%`,
      source: dayDoc && dayDoc.source ? dayDoc.source : "LSTM + Ap from Kp + forced extras",
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

      return normalized;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[api] fetch error for ${url}:`, err && err.message ? err.message : err);
    }
  }

  console.warn("[api] all endpoint variants failed — returning empty array");
  return [];
}
