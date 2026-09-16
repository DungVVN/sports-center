import { apiClient } from "../../api/client.js";
import { apiBaseUrl } from "../../config/runtime.js";

async function exportCsv(type, query) {
  const response = await fetch(`${apiBaseUrl}/reports/${type}/export?${new URLSearchParams(query)}`, { credentials: "include" });
  if (!response.ok) throw new Error("Không thể xuất báo cáo.");
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `bao-cao-${type}.csv`; link.click(); URL.revokeObjectURL(url);
}

export const dashboardApi = Object.freeze({ summary: (role, query = {}) => apiClient.get(`/dashboards/${role}?${new URLSearchParams(query)}`), notifications: () => apiClient.get("/notifications"), markNotificationRead: (id) => apiClient.patch(`/notifications/${id}/read`, {}), revenue: (query = {}) => apiClient.get(`/reports/revenue?${new URLSearchParams(query)}`), attendance: (query = {}) => apiClient.get(`/reports/attendance?${new URLSearchParams(query)}`), exportCsv, auditLogs: (query = {}) => apiClient.get(`/audit-logs?${new URLSearchParams(query)}`) });
