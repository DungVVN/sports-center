import { ApiError } from "./api-error.js";
import { apiBaseUrl } from "../config/runtime.js";

export const authenticationExpiredEvent = "sports-center:authentication-expired";
export const permissionsChangedEvent = "sports-center:permissions-changed";

function buildUrl(path) {
  return `${apiBaseUrl}/${path.replace(/^\//, "")}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() : null;
}

export async function request(path, { method = "GET", body, headers, signal } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      credentials: "include",
      signal,
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
      details: error,
    });
  }

  const payload = await parseResponse(response);
  if (!response.ok || !payload?.success) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(authenticationExpiredEvent));
    }
    if (response.status === 403 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(permissionsChangedEvent));
    }
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? "REQUEST_FAILED",
      message: payload?.error?.message ?? "Yêu cầu không thể hoàn tất.",
      details: payload?.error?.details,
    });
  }

  return payload.data;
}

export const apiClient = Object.freeze({
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
});
