const API_BASE = (process.env.REACT_APP_API_BASE || "https://space-forecast-app-1.onrender.com").replace(/\/$/,"");

export async function fetch3DayForecast(){
  const res = await fetch(`${API_BASE}/api/predictions/3day`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
