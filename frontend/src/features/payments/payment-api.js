import { apiClient } from "../../api/client.js";
export const paymentApi = Object.freeze({ mine: () => apiClient.get("/members/me/payments"), list: (memberId) => apiClient.get(`/payments${memberId ? `?memberId=${memberId}` : ""}`), create: (input) => apiClient.post("/payments", input), confirm: (id, status) => apiClient.post(`/payments/${id}/confirm`, { status }) });
