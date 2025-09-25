// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
//
// - Accepts multiple backend shapes (array-of-day-docs OR docs-with-daily-arrays)
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Prefer backend solar_radiation_pct and radio_blackout_pct when present
// - Fall back to forced defaults (Solar=1%, Radio Blackout R1–R2=35%, R3>= = 1%) only if backend missing

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
// Small helpers
// ============================================================================
function avgNums(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Convert Kp → Ap using a thirds lookup (index = round(kp * 3))
// preserves fractional Kp mapping
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

  // how many days (use maximum length found among documents)
  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days.length
        : 0
    )
  );
  // treat as one-doc-per-day when there are no daily arrays
  const treatsAsPerDay = days === 0 && preds.length > 0;
  const maxDays = treatsAsPerDay ? preds.length : days;
  if (!maxDays) return [];

  // find earliest date across docs
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
    // collect candidate Kp values
    const kpVals = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        if (idx === i) {
          if (Array.isArray(p.daily_avg_kp_next3days)) return avg([p.daily_avg_kp_next3days[0]]);
          if (Array.isArray(p.kp_index)) return avg(p.kp_index);
          if (p.kp_value != null) return Number(p.kp_value);
        }
        return null;
      } else {
        if (Array.isArray(p.daily_avg_kp_next3days)) {
          return p.daily_avg_kp_next3days[i] ?? null;
        }
        if (Array.isArray(p.kp_index)) {
          return avg(p.kp_index);
        }
        return null;
      }
    });

    const kpVal = avg(kpVals);

    // compute date (UTC date-only)
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // Prefer backend-provided a_index/ap if present for this day
    let providedA = null;
    let providedAp = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      if (treatsAsPerDay && j !== i) continue;

      if (p.a_index != null && !Array.isArray(p.a_index)) providedA = Number(p.a_index);
      if (p.ap != null && !Array.isArray(p.ap)) providedAp = Number(p.ap);

      if (Array.isArray(p.a_index) && p.a_index[i] != null) providedA = Number(p.a_index[i]);
      if (Array.isArray(p.ap) && p.ap[i] != null) providedAp = Number(p.ap[i]);
    }

    const apComputed = kpVal != null ? kpToAp(kpVal) : null;
    const finalAp = providedAp != null ? providedAp : apComputed;
    const finalAIndex = providedA != null ? providedA : finalAp;

    // Choose a representative doc for this day for solar / radio fields
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.kp_index) || Array.isArray(p.solar_radiation)) ?? preds[0];
    }

    // Try to extract per-day solar_radiation_pct and radio_blackout_pct
    // Accept scalar or array-like values
    let solarPct = null;
    let blackoutPct = null;
    let r3_or_greater = null;

    if (dayDoc) {
      // If dayDoc has arrays, attempt to read index i
      if (Array.isArray(dayDoc.solar_radiation_pct)) {
        solarPct = dayDoc.solar_radiation_pct[i] ?? null;
      } else if (dayDoc.solar_radiation_pct != null) {
        solarPct = dayDoc.solar_radiation_pct;
      } else if (Array.isArray(dayDoc.solar_radiation)) {
        // sometimes backend uses raw flux arrays
        const sf = avg(dayDoc.solar_radiation);
        if (sf != null) solarPct = null; // keep null — we'll show flux in label instead
      }

      if (Array.isArray(dayDoc.radio_blackout_pct)) {
        blackoutPct = dayDoc.radio_blackout_pct[i] ?? null;
      } else if (dayDoc.radio_blackout_pct != null) {
        blackoutPct = dayDoc.radio_blackout_pct;
      } else if (Array.isArray(dayDoc.radio_blackout) || typeof dayDoc.radio_blackout === "object") {
        // backend may provide breakdown object; if it contains a percent field try to interpret
        // but prefer explicit radio_blackout_pct
      }

      if (Array.isArray(dayDoc.r3_or_greater)) {
        r3_or_greater = dayDoc.r3_or_greater[i] ?? null;
      } else if (dayDoc.r3_or_greater != null) {
        r3_or_greater = dayDoc.r3_or_greater;
      }
    }

    // Fallbacks & defaults
    // If backend didn't supply solar_pct but provided radio_flux we will display flux in label.
    const radioFluxVal = dayDoc && Array.isArray(dayDoc.radio_flux) ? avg(dayDoc.radio_flux) : (dayDoc && (dayDoc.radio_flux ?? null));
    const solarFluxFallback = radioFluxVal != null ? radioFluxVal : null;

    // Default dummy values only when backend didn't provide values
    // Defaults from your NOAA sample: R1-R2 = 35%, R3>= = 1%, solar radiation default 1% (but we prefer showing radio_flux if available)
    const DEFAULT_SOLAR_PCT = 1;
    const DEFAULT_BLACKOUT_PCT = 35;
    const DEFAULT_R3 = "1%";

    const finalSolarPct = solarPct != null ? solarPct : null; // keep null if missing to prefer showing actual flux if present
    const finalBlackoutPct = blackoutPct != null ? blackoutPct : null;

    const solar_label = finalSolarPct != null
      ? `${finalSolarPct}% (Minor)`
      : (solarFluxFallback != null ? `${Number(solarFluxFallback).toFixed(2)}` : "N/A");

    const blackout_label = finalBlackoutPct != null
      ? `${finalBlackoutPct}% R1–R2`
      : `${DEFAULT_BLACKOUT_PCT}% R1–R2`;

    const r3_label = r3_or_greater != null ? r3_or_greater : DEFAULT_R3;

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,
      // percentages: prefer backend when present, otherwise null so UI can show reasonable fallback (or show flux)
      solar_radiation_pct: finalSolarPct != null ? finalSolarPct : null,
      solar_radiation_label: solar_label,
      radio_flux: radioFluxVal != null ? radioFluxVal : null,
      radio_blackout_pct: finalBlackoutPct != null ? finalBlackoutPct : DEFAULT_BLACKOUT_PCT,
      radio_blackout_label: blackout_label,
      r3_or_greater: r3_label,
      source: dayDoc && dayDoc.source ? dayDoc.source : "LSTM + Ap from Kp + fixed extras",
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
