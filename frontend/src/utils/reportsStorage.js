const STORAGE_KEY = "deepfake_shield_reports_v1";

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function loadReports() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveReports(list) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addReport(entry) {
  const next = [entry, ...loadReports()].slice(0, 50);
  saveReports(next);
  return entry;
}

export function deleteReport(id) {
  saveReports(loadReports().filter((r) => r.id !== id));
}

export function clearReports() {
  saveReports([]);
}
