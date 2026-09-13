import { apiClient } from "../../api/client.js";
export const dashboardApi = Object.freeze({ summary: (role) => apiClient.get(`/dashboards/${role}`), notifications: () => apiClient.get("/notifications"), revenue: () => apiClient.get("/reports/revenue") });
