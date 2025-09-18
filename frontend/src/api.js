// frontend/src/api.js

// Pick API base from env var, fallback to your Render backend
const API_BASE = (process.env.REACT_APP_API_BASE || "https://space-forecast-app-1.onrender.com").replace(/\/$/, "");

// Fetch helper for 3-day forecast
export async function fetch3DayForecast() {
  const url = `${API_BASE}/api/predictions/3day`;
  console.log("API helper calling:", url);

  try {
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      // grab text so you see details in console
      const text = await res.text();
      console.error("API error:", res.status, text);
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("API helper got data:", data);
    return data;
  } catch (err) {
    console.error("API fetch failed:", err);
    throw err;
  }
}
