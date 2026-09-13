import { apiClient } from "../../api/client.js";
export const staffApi = Object.freeze({ list: () => apiClient.get("/staff"), get: (id) => apiClient.get(`/staff/${id}`), create: (input) => apiClient.post("/staff", input), update: (id, input) => apiClient.patch(`/staff/${id}`, input), setStatus: (id, status) => apiClient.patch(`/staff/${id}/status`, { status }) });
