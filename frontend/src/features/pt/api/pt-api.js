import { apiClient } from "../../../shared/api/client.js";
export const ptApi = Object.freeze({
  publicCatalog: () => apiClient.get("/public/pt-packages"),
  cancelPurchase: (id) => apiClient.post(`/pt-purchases/${id}/cancel`, {}),
  setPackageActive: (id, input) => apiClient.patch(`/pt-packages/${id}/availability`, input),
  packages: () => apiClient.get("/pt-packages"),
  purchases: () => apiClient.get("/pt-purchases"),
  resources: () => apiClient.get("/pt-resources"),
  create: (input) => apiClient.post("/pt-packages", input),
  buy: (id) => apiClient.post(`/pt-packages/${id}/buy`, {}),
  payment: (id, input) => apiClient.post(`/pt-purchases/${id}/payment`, input),
  assign: (id, input) => apiClient.patch(`/pt-purchases/${id}/coach`, input),
  book: (id, input) => apiClient.post(`/pt-purchases/${id}/appointments`, input),
  cancel: (id, input, staff) => apiClient.post(`/pt-appointments/${id}/${staff ? "staff-cancel" : "cancel"}`, input),
  complete: (id, input) => apiClient.post(`/pt-appointments/${id}/complete`, input),
});
