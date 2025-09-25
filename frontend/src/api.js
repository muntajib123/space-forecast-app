// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// - Accepts multiple backend shapes (array-of-day-docs OR docs-with-daily-arrays)
// - Ap Index derived from fractional Kp Index (thirds-aware) if backend missing
// - Force Solar Radiation = 1% (if missing)
// - Force Radio Blackout = 35% (if missing)

const RAW_API_BASE = process.env.REACT_APP_API_BASE || "";
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, "");

console.info("BUILD: REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE || "(empty)");

const SOLAR_DEFAULT = 1; // %
const BLACKOUT_DEFAULT = 35; // %

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

// ---------- helpers ----------
function avgNums(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Kp -> Ap thirds-aware lookup
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

// ---------- normalizer ----------
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) return [];

  // number of days: either from daily arrays or treat docs as per-day
  const days = Math.max(...preds.map((p) => (Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0)));
  const treatsAsPerDay = days === 0 && preds.length > 0;
  const maxDays = treatsAsPerDay ? preds.length : days;
  if (!maxDays) return [];

  // choose earliest date found
  let earliestDate = null;
  for (const p of preds) {
    const cand = p.date || p.forecast_date || p.timestamp || p.issued || null;
    if (!cand) continue;
    const d = new Date(cand);
    if (!isNaN(d.getTime())) {
      if (!earliestDate || d < earliestDate) earliestDate = d;
    }
  }
  const baseDate = earliestDate ? new Date(earliestDate) : new Date();

  const result = [];

  const arrAvg = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nums = arr.map((v) => (v === null || v === undefined ? null : Number(v))).filter((v) => v !== null && !Number.isNaN(v));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  for (let i = 0; i < maxDays; i++) {
    // collect candidate KP values
    const kpCandidates = preds.map((p, idx) => {
      if (treatsAsPerDay) {
        if (idx !== i) return null;
        if (Array.isArray(p.daily_avg_kp_next3days)) return p.daily_avg_kp_next3days[0] ?? null;
        if (Array.isArray(p.kp_index)) return arrAvg(p.kp_index);
        if (p.kp_value != null) return p.kp_value;
        if (p.kp != null) return p.kp;
        return null;
      } else {
        if (Array.isArray(p.daily_avg_kp_next3days)) return p.daily_avg_kp_next3days[i] ?? null;
        if (Array.isArray(p.kp_index)) return arrAvg(p.kp_index);
        if (p.kp_value != null) return p.kp_value;
        if (p.kp != null) return p.kp;
        return null;
      }
    });

    const kpVal = avgNums(kpCandidates);

    // build UTC date-only for the row
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // try to find provided a_index/ap
    let providedA = null;
    let providedAp = null;
    for (let j = 0; j < preds.length; j++) {
      const p = preds[j];
      if (treatsAsPerDay && j !== i) continue;

      if (p.a_index != null && providedA == null) providedA = safeNum(p.a_index);
      if (p.ap != null && providedAp == null) providedAp = safeNum(p.ap);

      if (Array.isArray(p.a_index) && p.a_index[i] != null && providedA == null) providedA = safeNum(p.a_index[i]);
      if (Array.isArray(p.ap) && p.ap[i] != null && providedAp == null) providedAp = safeNum(p.ap[i]);
    }

    const apComputed = kpVal != null ? kpToAp(kpVal) : null;
    const finalAp = providedAp != null ? providedAp : apComputed;
    const finalAIndex = providedA != null ? providedA : finalAp;

    // pick a representative doc for solar/radio values
    let dayDoc = null;
    if (treatsAsPerDay) {
      dayDoc = preds[i] ?? preds[0];
    } else {
      dayDoc = preds.find((p) => Array.isArray(p.daily_avg_kp_next3days) || Array.isArray(p.solar_radiation) || Array.isArray(p.kp_index)) ?? preds[0];
    }

    // explicit percent fields if any
    const solarPctFromDoc = dayDoc && (dayDoc.solar_radiation_pct ?? dayDoc.solar_pct ?? null);
    const blackoutPctFromDoc = dayDoc && (dayDoc.radio_blackout_pct ?? dayDoc.blackout_pct ?? null);

    const solarPct = solarPctFromDoc != null ? safeNum(solarPctFromDoc) : null;
    const blackoutPct = blackoutPctFromDoc != null ? safeNum(blackoutPctFromDoc) : null;

    // radio flux or solar_flux fallback
    const radioFluxVal = dayDoc
      ? (Array.isArray(dayDoc.radio_flux) ? arrAvg(dayDoc.radio_flux) : (dayDoc.radio_flux ?? (dayDoc.solar_radiation && !Array.isArray(dayDoc.solar_radiation) ? safeNum(dayDoc.solar_radiation) : null)))
      : null;
    const solarFluxFallback = radioFluxVal != null ? radioFluxVal : null;

    // final percent values (enforce defaults)
    const finalSolarPct = solarPct != null ? solarPct : SOLAR_DEFAULT;
    const finalBlackoutPct = blackoutPct != null ? blackoutPct : BLACKOUT_DEFAULT;

    const solar_label = `${finalSolarPct}% (Minor)`;
    const blackout_label = `${finalBlackoutPct}% R1–R2`;

    // --- ensure presence of fields expected by App.js components ---
    // solar_radiation: either pass through array from doc, or provide [radioFlux] or [finalSolarPct]
    let solar_radiation_field = null;
    if (dayDoc) {
      if (Array.isArray(dayDoc.solar_radiation)) solar_radiation_field = dayDoc.solar_radiation;
      else if (dayDoc.solar_radiation != null && !Array.isArray(dayDoc.solar_radiation)) solar_radiation_field = [safeNum(dayDoc.solar_radiation)];
      else if (solarFluxFallback != null) solar_radiation_field = [solarFluxFallback];
      else solar_radiation_field = [finalSolarPct];
    } else {
      solar_radiation_field = [finalSolarPct];
    }

    // radio_blackout: prefer doc object, else create a default object
    const radio_blackout_field = (dayDoc && (dayDoc.radio_blackout ?? dayDoc.blackout)) ?? { "R1-R2": 0, "R3 or greater": 0 };

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal != null ? Math.round(kpVal * 100) / 100 : null,
      a_index: finalAIndex != null ? finalAIndex : null,
      ap: finalAp != null ? finalAp : null,

      // provide both percent and numeric/array fields so UI is flexible
      solar_radiation: solar_radiation_field,
      solar_radiation_pct: finalSolarPct,
      solar_radiation_label: solar_label,

      radio_flux: solarFluxFallback != null ? Number(solarFluxFallback) : null,
      radio_blackout: radio_blackout_field,
      radio_blackout_pct: finalBlackoutPct,
      radio_blackout_label: blackout_label,

      r3_or_greater: dayDoc && dayDoc.r3_or_greater ? dayDoc.r3_or_greater : "None",
      source: dayDoc && dayDoc.source ? dayDoc.source : "LSTM + Ap from Kp + fixed extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, original: p })),
    });
  }

  return result;
}

// ---------- fetcher ----------
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

// expose for debugging
try {
  if (typeof window !== "undefined") window.__fetch3DayForecast__ = fetch3DayForecast;
} catch (e) {}
