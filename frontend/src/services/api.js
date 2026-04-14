import axios from "axios";

function apiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "/api";
  }
  return "http://127.0.0.1:8000";
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

const API = axios.create({
  baseURL: apiBaseUrl(),
});

export function formatApiDetail(error, fallback = "Something went wrong.") {
  if (error?.request && !error?.response) {
    return "Backend server is not running. Start the API on port 8000, then try again.";
  }

  const d = error?.response?.data?.detail;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e) => (typeof e === "string" ? e : e.msg || JSON.stringify(e))).join(" ");
  }
  return fallback;
}

export const loginUser = (data) =>
  API.post("/login", {
    email: typeof data.email === "string" ? data.email.trim() : data.email,
    password: data.password,
  });

export const signupUser = (data) =>
  API.post("/signup", {
    email: typeof data.email === "string" ? data.email.trim() : data.email,
    password: data.password,
  });
export const registerUser = signupUser;
export const forgotPasswordUser = (data) =>
  API.post("/forgot-password", {
    email: typeof data.email === "string" ? data.email.trim() : data.email,
    new_password: data.new_password,
  });

export const analyzeMedia = (file) => {
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return API.post("/upload", form, {
    headers,
    timeout: 120000,
  });
};
