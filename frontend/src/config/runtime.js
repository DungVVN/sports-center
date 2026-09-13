const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!configuredApiBaseUrl) {
  throw new Error("Thiếu VITE_API_BASE_URL. Hãy tạo frontend/.env từ frontend/.env.example.");
}

export const apiBaseUrl = configuredApiBaseUrl.replace(/\/$/, "");
