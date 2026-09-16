import { apiClient } from "../../api/client.js";
export const supportApi = Object.freeze({ list: () => apiClient.get("/support-tickets"), detail: (id) => apiClient.get(`/support-tickets/${id}`), create: (input) => apiClient.post("/support-tickets", input) });
