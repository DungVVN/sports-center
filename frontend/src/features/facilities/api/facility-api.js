import { apiClient } from "../../../shared/api/client.js";

export const facilityApi = Object.freeze({
  settings: () => apiClient.get("/facility-settings"),
  configure: (id, input) => apiClient.patch(`/facilities/${id}/configuration`, input),
  payment: (id, input) => apiClient.post(`/facility-reservations/${id}/payment`, input),
  complete: (id, input) => apiClient.post(`/facility-reservations/${id}/complete`, input),
  calendar: ({ from, to, typeId }) => apiClient.get(`/public/facility-calendar?${new URLSearchParams({ from, to, ...(typeId && { typeId }) })}`),
  createType: (input) => apiClient.post("/facility-types", input),
  createFacility: (input) => apiClient.post("/facilities", input),
  createDay: (input) => apiClient.post("/facility-days", input),
  mine: () => apiClient.get("/facility-reservations/me"),
  request: (input) => apiClient.post("/facility-reservations", input),
  reservations: () => apiClient.get("/facility-reservations"),
  review: (id, input) => apiClient.patch(`/facility-reservations/${id}/review`, input),
  cancel: (id, reason) => apiClient.patch(`/facility-reservations/${id}/cancel`, { reason }),
  confirmCancellation: (id) => apiClient.patch(`/facility-reservations/${id}/cancel/confirm`),
});
