export const API_URL =
  window.BW_API_URL ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:8787"
    : "https://birthdaywisher-api.onrender.com");

export const BASE = location.pathname
  .replace(/\/[^/]*$/, "")
  .replace(/\/birthday$/, "");
