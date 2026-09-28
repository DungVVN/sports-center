import { ApiError } from "./api-error.js";
import { apiBaseUrl } from "../config/runtime.js";

export const authenticationExpiredEvent = "sports-center:authentication-expired";
export const permissionsChangedEvent = "sports-center:permissions-changed";

function buildUrl(path) {
  return `${apiBaseUrl}/${path.replace(/^\//, "")}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function apiErrorFromResponse(response, payload, { suppressAuthenticationExpiredEvent = false } = {}) {
  if (response.status === 401 && !suppressAuthenticationExpiredEvent && typeof window !== "undefined") {
    window.dispatchEvent(new Event(authenticationExpiredEvent));
  }
  if (response.status === 403 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(permissionsChangedEvent));
  }
  return new ApiError({
    status: response.status,
    code: payload?.error?.code ?? "REQUEST_FAILED",
    message: payload?.error?.message ?? "Máy chủ không cung cấp thông báo lỗi hợp lệ.",
    details: payload?.error?.details,
    requestId: payload?.error?.requestId ?? response.headers.get("x-request-id"),
  });
}

export async function request(path, { method = "GET", body, headers, signal, suppressAuthenticationExpiredEvent = false } = {}) {
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
    if (error?.name === "AbortError") throw error;
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: "Không nhận được phản hồi từ API. Kiểm tra kết nối mạng hoặc trạng thái máy chủ rồi thử lại.",
      details: error,
    });
  }

  const payload = await parseResponse(response);
  if (!response.ok || !payload?.success) {
    throw apiErrorFromResponse(response, payload, { suppressAuthenticationExpiredEvent });
  }

  return payload.data;
}

export const apiClient = Object.freeze({
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
});
