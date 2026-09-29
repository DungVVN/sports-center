import { apiClient, apiErrorFromResponse } from "../../../shared/api/client.js";
import { apiBaseUrl } from "../../../config/runtime.js";
import { ApiError } from "../../../shared/api/api-error.js";

async function exportCsv(type, query) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/reports/${type}/export?${new URLSearchParams(query)}`, { credentials: "include" });
  } catch {
    throw new ApiError({ code: "NETWORK_ERROR", message: "Không nhận được phản hồi khi tải báo cáo. Kiểm tra kết nối mạng rồi thử lại." });
  }
  if (!response.ok) {
    const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json().catch(() => null) : null;
    throw apiErrorFromResponse(response, payload);
  }
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `bao-cao-${type}.csv`; link.click(); URL.revokeObjectURL(url);
}

export const dashboardApi = Object.freeze({ summary: (role, query = {}) => apiClient.get(`/dashboards/${role}?${new URLSearchParams(query)}`), notifications: () => apiClient.get("/notifications"), markNotificationRead: (id) => apiClient.patch(`/notifications/${id}/read`, {}), revenue: (query = {}) => apiClient.get(`/reports/revenue?${new URLSearchParams(query)}`), attendance: (query = {}) => apiClient.get(`/reports/attendance?${new URLSearchParams(query)}`), exportCsv, auditLogs: (query = {}) => apiClient.get(`/audit-logs?${new URLSearchParams(query)}`) });
