// frontend/src/api.js
// Fetch + normalizer for 3-day forecast
// - Accepts different backend shapes
// - Computes Ap from fractional Kp (thirds-aware) when appropriate
// - Forces Solar Radiation = 1% and Radio Blackout R1-R2 = 35%, R3+ = 1%

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
// Constants (forced values requested)
// ============================================================================
const SOLAR_PCT_FORCED = 1;   // 1%
const BLACKOUT_R12_FORCED = 35; // 35% R1–R2
const BLACKOUT_R3_FORCED = 1;   // 1% R3 or greater

// ============================================================================
// Helpers
// ============================================================================
function avgNums(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
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

// Convert Kp → Ap using a thirds lookup (index = round(kp * 3))
// indices 0..27 for Kp 0.00, 0.33, 0.67, 1.00, ... 9.00
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

// ============================================================================
// Normalizer
// ============================================================================
// This function returns an array of per-day objects:
// { date, kp_index, a_index, ap, solar_radiation_pct, solar_radiation_label, radio_blackout_pct, radio_blackout_label, radio_flux, ... }
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) return [];

  // Determine if docs contain per-day arrays (daily_avg_kp_next3days) or are one-doc-per-day
  const anyDailyArrays = preds.some((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.kp_index));
  const treatsAsPerDay = !anyDailyArrays && preds.length > 0; // one document per day
  const days = treatsAsPerDay ? preds.length : Math.max(...preds.map((p) => (Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0)));
  const maxDays = Math.max(0, days);
  if (!maxDays) return [];

  // pick earliest date available across documents (safe baseline)
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

  for (let i = 0; i < maxDays; i++) {
    // collect candidate Kp values (from daily_avg_kp_next3days OR kp_index arrays/fallback)
    const kpCandidates = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        if (idx !== i) return null;
        if (Array.isArray(p.daily_avg_kp_next3days)) return p.daily_avg_kp_next3days[0] ?? null;
        if (Array.isArray(p.kp_index)) return avgNums(p.kp_index);
        if (p.kp_value != null) return Number(p.kp_value);
        return null;
      } else {
        if (Array.isArray(p.daily_avg_kp_next3days)) return p.daily_avg_kp_next3days[i] ?? null;
        if (Array.isArray(p.kp_index)) return avgNums(p.kp_index);
        if (p.kp_value != null) return Number(p.kp_value);
        return null;
      }
    });

    const kpVal = avgNums(kpCandidates);

    // date for this row (UTC date-only)
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // Prefer computed Ap based on Kp (kpToAp). Use backend-provided ap/a_index only if computed missing.
    const computedAp = kpVal != null ? kpToAp(kpVal) : null;

    // Search for any explicit ap / a_index supplied for this day
    let explicitAp = null;
    let explicitAIndex = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      if (treatsAsPerDay && j !== i) continue;

      // if arrays present, try element [i]
      if (Array.isArray(p.ap) && p.ap[i] != null) explicitAp = Number(p.ap[i]);
      if (Array.isArray(p.a_index) && p.a_index[i] != null) explicitAIndex = Number(p.a_index[i]);

      if (p.ap != null && !Array.isArray(p.ap)) explicitAp = Number(p.ap);
      if (p.a_index != null && !Array.isArray(p.a_index)) explicitAIndex = Number(p.a_index);
    }

    // choose final ap/a_index: prefer computedAp (kp-derived) if available, else use explicit values
    const finalAp = computedAp != null ? computedAp : (explicitAp != null ? explicitAp : null);
    const finalAIndex = explicitAIndex != null ? explicitAIndex : (finalAp != null ? finalAp : null);

    // Determine a "dayDoc" to pull other fields (solar, radio) if present
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.kp_index)) ?? preds[0];
    }

    // Forcing solar & radio per your request (solar=1%, R1-R2=35%, R3+=1)
    const solarPct = SOLAR_PCT_FORCED;
    const blackoutPct = BLACKOUT_R12_FORCED;
    const r3Pct = BLACKOUT_R3_FORCED;

    // radio flux fallback (if you want to display radio_flux numeric, we keep it)
    const radioFluxVal = dayDoc && Array.isArray(dayDoc.radio_flux) ? avgNums(dayDoc.radio_flux) : (dayDoc && (dayDoc.radio_flux ?? null));

    const solar_label = `${solarPct}% (Minor)`;
    const blackout_label = `R1-R2: ${blackoutPct}, R3+: ${r3Pct}`;

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,
      solar_radiation_pct: solarPct,
      solar_radiation_label: solar_label,
      radio_flux: radioFluxVal != null ? radioFluxVal : null,
      radio_blackout_pct: blackoutPct,
      radio_blackout_label: blackout_label,
      r3_or_greater_pct: r3Pct,
      source: dayDoc && dayDoc.source ? dayDoc.source : "LSTM + Ap from Kp + forced extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, original: p })),
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
      console.warn(`[api] fetch error for ${url}:`, err.message || err);
    }
  }

  console.warn("[api] all endpoint variants failed — returning empty array");
  return [];
}
