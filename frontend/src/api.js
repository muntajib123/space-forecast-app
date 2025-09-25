// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// ✅ Dates come directly from backend docs (no guessing)
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
// Keeps fractional Kp (like 3.33 / 3.67) accurate
function kpToAp(kp) {
  if (kp === null || kp === undefined) return null;
  const kpf = Number(kp);
  if (Number.isNaN(kpf)) return null;

  // AP lookup for Kp in thirds: index = round(kp * 3)
  // indices 0..27 correspond to Kp = 0.00, 0.33, 0.67, 1.00, ... up to 9.00
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
  if (!days) return [];

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
  for (let i = 0; i < days; i++) {
    const vals = preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days[i]
        : null
    );
    const kpVal = avg(vals);

    // Make a UTC date for the ith day (preserve date-of-day only)
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + i);

    // Fixed dummy values
    const solarVal = 1; // always 1%
    const blackoutVal = 35; // always 35%

    const apVal = kpVal !== null ? kpToAp(kpVal) : null;
    if (kpVal !== null && apVal === null) {
      console.warn("[api] kpToAp gave null for kpVal:", kpVal);
    }

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal !== null ? Math.round(kpVal * 100) / 100 : null,
      // Provide both common names for Ap
      a_index: apVal,
      ap: apVal,
      // keep consistent naming with backend if you rely on *_pct
      solar_radiation_pct: solarVal,
      solar_radiation_label: "1% (Minor)",
      radio_flux: null,
      radio_blackout_pct: blackoutVal,
      radio_blackout_label: "35% R1–R2",
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
