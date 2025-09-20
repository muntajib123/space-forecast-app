// frontend/src/api.js
// Robust fetch helper for the 3-day forecast.
// - Uses REACT_APP_API_BASE (or local default)
// - Uses REACT_APP_USE_MOCK to supply mock data for UI testing
// - Tries primary endpoint (/api/predictions/3day) then fallback (/api/forecast_3day/)
// - Handles multiple JSON shapes: { predictions: [...] }, { data: [...] }, or raw array
// - Adds a small timeout to avoid hanging forever

const API_BASE = (process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
const PRIMARY_ENDPOINT = process.env.REACT_APP_API_PATH_PRIMARY || "/api/predictions/3day";
const FALLBACK_ENDPOINT = process.env.REACT_APP_API_PATH_FALLBACK || "/api/forecast_3day/";
const DEFAULT_TIMEOUT_MS = 10_000;

function timeoutFetch(resource, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    fetch(resource, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeout)
    ),
  ]);
}

const MOCK_PAYLOAD = [
  {
    date: "2025-09-23",
    kp_index: [3.1, 2.7, 2.8, 4.2, 4.3, 2.9, 2.5, 5.0],
    kp: 4.46,
    a_index: 15,
    solar_radiation: 5.97,
    radio_blackout: { "R1-R2": 25, "R3 or greater": 5 },
  },
  {
    date: "2025-09-24",
    kp_index: [5.0, 3.1, 2.7, 6.0, 6.3, 3.2, 2.5, 8.1],
    kp: 3.47,
    a_index: 12,
    solar_radiation: 3.94,
    radio_blackout: { "R1-R2": 25, "R3 or greater": 5 },
  },
  {
    date: "2025-09-25",
    kp_index: [7.8, 3.3, 2.7, 8.4, 8.5, 4.5, 3.6, 6.4],
    kp: 3.09,
    a_index: 10,
    solar_radiation: 3.02,
    radio_blackout: { "R1-R2": 25, "R3 or greater": 5 },
  },
];

async function fetchJson(url, timeoutMs) {
  console.log(`[api] fetchJson -> ${url} (timeout ${timeoutMs}ms)`);
  const res = await timeoutFetch(
    url,
    { method: "GET", headers: { Accept: "application/json" } },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable body>");
    throw new Error(`HTTP ${res.status} for ${url} (body: ${text.slice(0, 300)})`);
  }

  // If response is empty JSON / text, trying to parse might fail — guard it
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${err.message}`);
  }
}

function normalizeResponse(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.predictions)) return json.predictions;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.results)) return json.results;

  // fallback: first array field
  for (const k of Object.keys(json || {})) {
    if (Array.isArray(json[k])) return json[k];
  }

  // If the object looks like a single forecast object, return it as single-item array
  if (typeof json === "object") return [json];

  return [];
}

export async function fetch3DayForecast({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  console.log("[api] fetch3DayForecast starting. API_BASE =", API_BASE);

  // Mock mode for UI development
  if (process.env.REACT_APP_USE_MOCK === "true") {
    console.log("[api] REACT_APP_USE_MOCK=true — returning MOCK_PAYLOAD");
    return { data: MOCK_PAYLOAD };
  }

  const primaryUrl = `${API_BASE}${PRIMARY_ENDPOINT}`;
  const fallbackUrl = `${API_BASE}${FALLBACK_ENDPOINT}`;

  // Try primary
  try {
    console.log("[api] trying primary endpoint:", primaryUrl);
    const json = await fetchJson(primaryUrl, timeoutMs);
    const preds = normalizeResponse(json);
    console.log(`[api] primary succeeded — returned ${preds.length} items`);
    return { data: preds };
  } catch (err) {
    console.warn(`[api] primary failed: ${err.message}`);
  }

  // Try fallback
  try {
    console.log("[api] trying fallback endpoint:", fallbackUrl);
    const json = await fetchJson(fallbackUrl, timeoutMs);
    const preds = normalizeResponse(json);
    console.log(`[api] fallback succeeded — returned ${preds.length} items`);
    return { data: preds };
  } catch (err) {
    console.error(`[api] fallback failed: ${err.message}`);
    // Final helpful error
    throw new Error(
      `Failed to fetch 3-day forecast from primary or fallback endpoints. Last error: ${err.message}`
    );
  }
}

export default fetch3DayForecast;
