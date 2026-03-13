const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  getRiceDashboard: ({ fromDate, toDate } = {}) => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    const query = params.toString();
    return requestJson(`/api/dashboard/rice${query ? `?${query}` : ""}`);
  },
};
