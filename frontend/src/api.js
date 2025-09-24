// frontend/src/api.js
// Robust fetch helper for 3-day forecast.
// ✅ Dates start from backend’s first returned date
// ✅ Ap Index derived from Kp Index
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

// Convert Kp → Ap using NOAA lookup table
function kpToAp(kp) {
  if (kp === null || kp === undefined) return null;
  const table = {
    0: 0, 1: 4, 2: 7, 3: 15, 4: 27,
    5: 48, 6: 80, 7: 140, 8: 240, 9: 400
  };
  const rounded = Math.round(kp);
  return table[rounded] ?? null;
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

  const days = Math.max(
    ...preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days.length
        : 0
    )
  );
  if (!days) return [];

  // ✅ Start from first backend forecast date
  const firstBackendDate = preds
    .map((p) => new Date(p.date))
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b)[0] || new Date();

  const start = new Date(firstBackendDate);

  const result = [];

  for (let i = 0; i < days; i++) {
    const vals = preds.map((p) =>
      Array.isArray(p.daily_avg_kp_next3days)
        ? p.daily_avg_kp_next3days[i]
        : null
    );
    const kpVal = avg(vals);

    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);

    // Fixed dummy values
    const solarVal = 1; // always 1%
    const blackoutVal = 35; // always 35%

    result.push({
      date: d.toISOString().slice(0, 10),
      kp_index: kpVal !== null ? Math.round(kpVal * 100) / 100 : null,
      a_index: kpVal !== null ? kpToAp(kpVal) : null,
      solar_radiation: solarVal,
      solar_radiation_label: "1% (Minor)", // for summary
      radio_flux: null,
      radio_blackout: blackoutVal,
      radio_blackout_label: "35% R1–R2", // for summary
      r3_or_greater: "1%", // for summary table
      source: "LSTM + Ap from Kp + fixed extras",
      raw: preds.map((p) => ({ id: p._id, date: p.date })),
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
          if (bodyPreview.length > 500)
            bodyPreview = bodyPreview.slice(0, 500) + "…";
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
