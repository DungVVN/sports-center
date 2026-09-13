import { apiClient } from "../../api/client.js";
export const staffApi = Object.freeze({ list: () => apiClient.get("/staff"), create: (input) => apiClient.post("/staff", input), setStatus: (id, status) => apiClient.patch(`/staff/${id}/status`, { status }) });
