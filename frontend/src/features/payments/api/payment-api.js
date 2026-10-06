import { apiClient } from "../../../shared/api/client.js";
import { readListChoices, readListPage } from "../../../shared/api/paginated-list.js";
const optionalId = (value) => typeof value === "string" && value.trim() ? encodeURIComponent(value.trim()) : "";
const reconciliationApi = {
  targets: (memberId) => apiClient.get(`/payments/targets?memberId=${encodeURIComponent(memberId)}`),
  refunds: () => apiClient.get("/service-refunds"),
  requestRefund: (id, input) => apiClient.post(`/payments/${id}/refund-request`, input),
  reviewRefund: (id, input) => apiClient.post(`/service-refunds/${id}/review`, input),
  executeRefund: (id, input) => apiClient.post(`/service-refunds/${id}/execute`, input),
  reconcile: (id, input) => apiClient.post(`/payments/${id}/reconcile`, input),
};
export const paymentApi = Object.freeze({ ...reconciliationApi, get: (id) => apiClient.get(`/payments/${encodeURIComponent(id)}`), mine: () => readListChoices("/members/me/payments"), ownReceipt: (id) => apiClient.get(`/members/me/payments/${id}`), page: (query) => readListPage("/payments", query), list: (memberId) => { const id = optionalId(memberId); return readListChoices("/payments", id ? { memberId: decodeURIComponent(id) } : {}); }, create: (input) => apiClient.post("/payments", input), confirm: (id, status, reconciliationNote) => apiClient.post(`/payments/${id}/confirm`, { status, ...(reconciliationNote && { reconciliationNote }) }) });
