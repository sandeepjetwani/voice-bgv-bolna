const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function listCases() {
  const r = await fetch(`${API}/api/cases`);
  return r.json();
}

export async function getCase(id) {
  const r = await fetch(`${API}/api/cases/${id}`);
  return r.json();
}

export async function triggerVerification(payload) {
  const r = await fetch(`${API}/api/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

export async function simulateEvent(caseId, event, data = {}) {
  const r = await fetch(`${API}/api/simulate/${caseId}/${event}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.json();
}

export const STATUS_COLORS = {
  INITIATED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  DISCREPANCY: "bg-amber-100 text-amber-700",
  UNVERIFIABLE: "bg-red-100 text-red-700",
  TRIGGER_FAILED: "bg-red-100 text-red-700",
};
