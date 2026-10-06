import { ApiError } from "./api-error.js";
import { apiBaseUrl } from "../../config/runtime.js";
import { portalSurface } from "../../config/portal.js";

export const authenticationExpiredEvent = "sports-center:authentication-expired";
export const permissionsChangedEvent = "sports-center:permissions-changed";
export const mutationSucceededEvent = "sports-center:mutation-succeeded";

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

export async function request(path, { method = "GET", body, headers, signal, timeoutMs = 30_000, suppressAuthenticationExpiredEvent = false, includeMeta = false } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let response;
  try {
    try {
      response = await fetch(buildUrl(path), {
        method,
        credentials: "include",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "x-sports-center-portal": portalSurface(),
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (error?.name === "AbortError") throw error;
      throw new ApiError({
        code: "NETWORK_ERROR",
        message: "Không nhận được phản hồi từ API. Kiểm tra kết nối mạng hoặc trạng thái máy chủ rồi thử lại.",
        details: error,
      });
    }

    const payload = await parseResponse(response);
    if (controller.signal.aborted) throw controller.signal.reason;
    if (!response.ok || !payload?.success) {
      throw apiErrorFromResponse(response, payload, { suppressAuthenticationExpiredEvent });
    }

    if (method !== "GET" && method !== "HEAD" && !path.startsWith("/notifications/") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(mutationSucceededEvent));
    }
    return includeMeta ? { items: payload.data, meta: payload.meta } : payload.data;
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new ApiError({
      code: "REQUEST_TIMEOUT",
      message: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
    });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export const apiClient = Object.freeze({
  get: (path, options) => request(path, options),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
});
