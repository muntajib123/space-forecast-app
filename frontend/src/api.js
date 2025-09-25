// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// ✅ Accepts multiple backend shapes (array-of-day-docs OR docs-with-daily-arrays)
// ✅ Ap Index derived from fractional Kp Index (thirds-aware)
// ✅ Fixed Solar Radiation = 1%
// ✅ Fixed Radio Blackout = 35% (with labels for graphs + summary)

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
function avg(nums = []) {
  const filtered = nums.filter(
    (n) => n !== null && n !== undefined && !Number.isNaN(Number(n))
  );
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + Number(b), 0) / filtered.length;
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
// Robust Normalizer (updated to accept kp_index arrays and prefer backend a_index)
// ============================================================================
function normalizePredictions(raw = {}) {
  const preds = Array.isArray(raw) ? raw : normalizeResponse(raw);
  if (!Array.isArray(preds) || !preds.length) {
    console.info("[api] normalizePredictions: no preds array found");
    return [];
  }

  // --- Constants ---
  const SOLAR_VAL = 1;
  const BLACKOUT_VAL = 35;

  const avgNums = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return null;
    const nums = arr.map((n) => (n === null || n === undefined ? NaN : Number(n))).filter((x) => !Number.isNaN(x));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  // --- Branch A: one-doc-per-day shape (or small array) ---
  const looksLikeDayDocs = preds.length <= 7 && preds.every((p) => {
    if (!p) return false;
    return (
      Array.isArray(p.kp_index) ||
      typeof p.kp === "number" ||
      typeof p.kp_index === "number" ||
      typeof p.Kp === "number" ||
      typeof p.kp_value === "number" ||
      Boolean(p.date) ||
      Boolean(p.forecast_date)
    );
  });

  if (looksLikeDayDocs) {
    console.info("[api] normalizePredictions: treating preds as one-doc-per-day (supports kp_index arrays)");
    return preds.map((p, idx) => {
      // If kp_index is an array, average it. Otherwise try other kp fields.
      let kpVal = null;
      if (Array.isArray(p.kp_index) && p.kp_index.length) {
        kpVal = avgNums(p.kp_index);
      } else if (Array.isArray(p.daily_avg_kp_next3days) && p.daily_avg_kp_next3days.length) {
        kpVal = avgNums(p.daily_avg_kp_next3days);
      } else {
        const raw = p.kp ?? p.kp_index ?? p.Kp ?? p.kp_value ?? p.daily_kp ?? null;
        kpVal = raw === null || raw === undefined ? null : Number(raw);
      }

      // Prefer backend Ap/a_index if present; otherwise derive from kpVal
      const apValBackend = p.ap ?? p.a_index ?? null;
      const apVal = (apValBackend !== null && apValBackend !== undefined) ? apValBackend : (kpVal != null && !Number.isNaN(kpVal) ? kpToAp(kpVal) : null);

      // date resolution
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
        try { dateStr = new Date(dateStr).toISOString().slice(0, 10); } catch (e) {}
      }

      return {
        date: dateStr,
        // round KP to 2 decimals for display
        kp_index: kpVal !== null && !Number.isNaN(kpVal) ? Math.round(kpVal * 100) / 100 : null,
        a_index: apVal,
        ap: apVal,
        // force the fixed dummy values (do not pass backend variants through)
        solar_radiation_pct: SOLAR_VAL,
        solar_radiation_label: "1% (Minor)",
        radio_flux: p.radio_flux ?? null,
        radio_blackout_pct: BLACKOUT_VAL,
        radio_blackout_label: "35% R1–R2",
        r3_or_greater: p.r3_or_greater ?? "1%",
        source: p.source ?? "LSTM + Ap from Kp + fixed extras",
        raw: { id: p._id ?? p.id ?? null, original: p },
      };
    });
  }

  // --- Branch B: docs with daily_avg_kp_next3days arrays (fallback) ---
  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days.length
        : 0
    )
  );
  if (!days) {
    console.info("[api] normalizePredictions: no daily arrays found and not day-docs");
    return [];
  }

  // prefer earliest date
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
    const vals = preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days) ? p.daily_avg_kp_next3days[i] : null
    );
    const kpVal = avgNums(vals);

    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // prefer backend ap/a_index first (if any doc has it), else derive
    const apFromBackend = findFirst(preds, (p) => p.ap ?? p.a_index ?? null);
    const apVal = apFromBackend !== null ? apFromBackend : (kpVal !== null ? kpToAp(kpVal) : null);

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal !== null ? Math.round(kpVal * 100) / 100 : null,
      a_index: apVal,
      ap: apVal,
      solar_radiation_pct: SOLAR_VAL,
      solar_radiation_label: "1% (Minor)",
      radio_flux: null,
      radio_blackout_pct: BLACKOUT_VAL,
      radio_blackout_label: "35% R1–R2",
      r3_or_greater: "1%",
      source: "LSTM + Ap from Kp + fixed extras",
      raw: preds.map((p) => ({ id: p._id ?? p.id ?? null, date: p.date ?? p.forecast_date ?? null })),
    });
  }
  return result;
}

// small helper used above: find first non-null ap/a_index in preds
function findFirst(arr, fn) {
  for (const x of arr) {
    try {
      const v = fn(x);
      if (v !== null && v !== undefined) return v;
    } catch {}
  }
  return null;
}
