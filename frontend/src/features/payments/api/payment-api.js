import { apiClient } from "../../../shared/api/client.js";
const optionalId = (value) => typeof value === "string" && value.trim() ? encodeURIComponent(value.trim()) : "";
const reconciliationApi = {
  refunds: () => apiClient.get("/service-refunds"),
  requestRefund: (id, input) => apiClient.post(`/payments/${id}/refund-request`, input),
  reviewRefund: (id, input) => apiClient.post(`/service-refunds/${id}/review`, input),
  executeRefund: (id, input) => apiClient.post(`/service-refunds/${id}/execute`, input),
  reconcile: (id, input) => apiClient.post(`/payments/${id}/reconcile`, input),
};
export const paymentApi = Object.freeze({ ...reconciliationApi, mine: () => apiClient.get("/members/me/payments"), ownReceipt: (id) => apiClient.get(`/members/me/payments/${id}`), list: (memberId) => { const id = optionalId(memberId); return apiClient.get(`/payments${id ? `?memberId=${id}` : ""}`); }, create: (input) => apiClient.post("/payments", input), confirm: (id, status, reconciliationNote) => apiClient.post(`/payments/${id}/confirm`, { status, ...(reconciliationNote && { reconciliationNote }) }) });
