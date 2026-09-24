const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const fallbackApiBaseUrl = import.meta.env.DEV
  ? "/api/v1"
  : "https://api.kineticsports.io.vn/api/v1";

// A missing hosting environment variable must not prevent React from mounting.
// Local Vite uses its API proxy; production keeps a safe public default.
export const apiBaseUrl = (configuredApiBaseUrl || fallbackApiBaseUrl).replace(/\/$/, "");
