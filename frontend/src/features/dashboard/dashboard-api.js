import { apiClient } from "../../api/client.js";
export const dashboardApi = Object.freeze({ summary: (role) => apiClient.get(`/dashboards/${role}`), notifications: () => apiClient.get("/notifications"), markNotificationRead: (id) => apiClient.patch(`/notifications/${id}/read`, {}), revenue: () => apiClient.get("/reports/revenue") });
