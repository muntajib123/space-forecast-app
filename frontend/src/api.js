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
// Normalizer — force solar=1% and radio_blackout=35% consistently
// ============================================================================
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) {
    console.info("[api] normalizePredictions: no preds array found");
    return [];
  }

  const SOLAR_VAL = 1;     // forced %
  const BLACKOUT_VAL = 35; // forced %

  // Quick detect: docs already per-day (or small list)
  const looksLikeDayDocs = preds.length <= 7 && preds.every((p) => {
    if (!p) return false;
    return Array.isArray(p.kp_index) || Boolean(p.date) || Boolean(p.forecast_date) || p.kp !== undefined;
  });

  if (looksLikeDayDocs) {
    console.info("[api] normalizePredictions: treating preds as one-doc-per-day (supports kp_index arrays)");
    return preds.map((p, idx) => {
      // compute kpVal
      let kpVal = null;
      if (Array.isArray(p.kp_index) && p.kp_index.length) {
        kpVal = avgNums(p.kp_index);
      } else if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length) {
        kpVal = avgNums(p.daily_avg_kp_next3days);
      } else {
        const rawK = p.kp ?? p.kp_index ?? p.Kp ?? p.kp_value ?? null;
        kpVal = rawK === null || rawK === undefined ? null : Number(rawK);
      }

      // prefer backend a_index/ap if present; otherwise derive from kpVal
      const backendA = (p.a_index !== undefined && p.a_index !== null) ? p.a_index : (p.ap !== undefined ? p.ap : null);
      const apVal = (backendA !== null && backendA !== undefined) ? backendA : (kpVal !== null && !Number.isNaN(kpVal) ? kpToAp(kpVal) : null);

      // date
      let dateStr = p.date ?? p.forecast_date ?? null;
      if (!dateStr) {
        const base = preds[0] && (preds[0].date || preds[0].forecast_date);
        if (base) {
          const bd = new Date(base);
          const d = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
          d.setUTCDate(d.getUTCDate() + idx);
          dateStr = d.toISOString().slice(0, 10);
        } else {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + idx);
          dateStr = d.toISOString().slice(0, 10);
        }
      } else {
        try { dateStr = new Date(dateStr).toISOString().slice(0, 10); } catch {}
      }

      // Format outputs
      const kp_display = kpVal !== null && !Number.isNaN(kpVal) ? Math.round(kpVal * 100) / 100 : null;
      const ap_display = apVal !== null && apVal !== undefined && !Number.isNaN(Number(apVal)) ? Math.round(Number(apVal)) : null;

      return {
        date: dateStr,
        kp_index: kp_display,
        a_index: ap_display,
        ap: ap_display,
        solar_radiation_pct: SOLAR_VAL,
        solar_radiation_label: `${SOLAR_VAL}% (Minor)`,
        radio_flux: p.radio_flux ?? null,
        radio_blackout_pct: BLACKOUT_VAL,
        radio_blackout_label: `${BLACKOUT_VAL}% R1–R2`,
        r3_or_greater: p.r3_or_greater ?? "1%",
        source: p.source ?? "LSTM + Ap from Kp + fixed extras",
        raw: { id: p._id ?? p.id ?? null, original: p },
      };
    });
  }

  // Fallback: docs that contain daily_avg_kp_next3days arrays
  const days = Math.max(...preds.map((p) => Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days.length : 0));
  if (!days) {
    console.info("[api] normalizePredictions: no daily arrays found and not day-docs");
    return [];
  }

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
  for (let i = 0; i < days; i++) {
    const vals = preds.map((p) => Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days[i] : null);
    const kpVal = avgNums(vals);
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // prefer backend ap/a_index first (if any doc has it), else derive
    const apFromBackend = findFirst(preds, (p) => {
      if (!p) return null;
      return p.ap ?? p.a_index ?? null;
    });
    const apVal = apFromBackend !== null ? apFromBackend : (kpVal !== null ? kpToAp(kpVal) : null);

    const kp_display = kpVal !== null && !Number.isNaN(kpVal) ? Math.round(kpVal * 100) / 100 : null;
    const ap_display = apVal !== null && apVal !== undefined && !Number.isNaN(Number(apVal)) ? Math.round(Number(apVal)) : null;

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kp_display,
      a_index: ap_display,
      ap: ap_display,
      solar_radiation_pct: SOLAR_VAL,
      solar_radiation_label: `${SOLAR_VAL}% (Minor)`,
      radio_flux: null,
      radio_blackout_pct: BLACKOUT_VAL,
      radio_blackout_label: `${BLACKOUT_VAL}% R1–R2`,
      r3_or_greater: "1%",
      source: "LSTM + Ap from Kp + fixed extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, date: p.date ?? p.forecast_date ?? null })),
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
