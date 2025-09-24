// src/api.js
// Robust fetch helper. Supports dev proxy, handles trailing slash, normalizes response.

const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

// Both variants (with and without trailing slash) so we don’t get stuck on 404
const ENDPOINTS = [
  (API_BASE ? `${API_BASE}` : "") + "/api/predictions/3day",
  (API_BASE ? `${API_BASE}` : "") + "/api/predictions/3day/",
];

export default async function fetch3DayForecast({ timeoutMs = 15000 } = {}) {
  for (const url of ENDPOINTS) {
    console.info("[api] fetching", url);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[api] response status for ${url}: ${res.status}`);
        continue; // try next candidate
      }

      const json = await res.json().catch(() => null);
      console.info("[api] raw json:", json);

      const arr =
        Array.isArray(json)
          ? json
          : Array.isArray(json?.predictions)
          ? json.predictions
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.results)
          ? json.results
          : [];

      console.info("[api] returning", arr.length, "items");
      return arr;
    } catch (err) {
      console.warn(`[api] failed for ${url}:`, err.message);
      // try next endpoint
    }
  }
  throw new Error("All endpoint variants failed");
}
