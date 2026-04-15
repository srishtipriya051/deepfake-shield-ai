export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function decodeJwtEmail(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.sub || null;
  } catch {
    return null;
  }
}

export function getInitials(value) {
  const safeValue = value || "User";
  const parts = safeValue.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

export function logoutUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

const PROFILE_STORAGE_KEY = "deepfake_shield_profile_v1";

function profileDefaults(email) {
  const fallbackEmail = email || "analyst@deepfakeshield.ai";
  const baseName = fallbackEmail.split("@")[0].replace(/[._-]/g, " ");
  const fullName = baseName.replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    fullName,
    email: fallbackEmail,
    role: "Security Analyst",
    workspace: "Deepfake Shield AI Lab",
    bio: "Monitor your analysis workspace, tune notification settings, and keep your account ready for fast incident review.",
    joinedOn: "14 Apr 2026",
  };
}

export function loadProfile(email) {
  if (typeof window === "undefined") return profileDefaults(email);
  const defaults = profileDefaults(email);

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaults, ...(parsed || {}) };
  } catch {
    return defaults;
  }
}

export function saveProfile(profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
