import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "https://api.soniccheck.io").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

let tokenProvider = null;

export function setApiTokenProvider(provider) {
  tokenProvider = typeof provider === "function" ? provider : null;
}

export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  if (!tokenProvider) return config;
  const token = await tokenProvider();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
