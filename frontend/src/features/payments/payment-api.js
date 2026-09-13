import { apiClient } from "../../api/client.js";
export const paymentApi = Object.freeze({ list: () => apiClient.get("/payments"), create: (input) => apiClient.post("/payments", input), confirm: (id, status) => apiClient.post(`/payments/${id}/confirm`, { status }) });
