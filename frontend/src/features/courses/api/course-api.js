import { apiClient } from "../../../shared/api/client.js";
export const courseApi = Object.freeze({
  publicCatalog: () => apiClient.get("/public/courses"),
  list: () => apiClient.get("/courses"),
  create: (input) => apiClient.post("/courses", input),
  addSession: (id, input) => apiClient.post(`/courses/${id}/sessions`, input),
  publish: (id) => apiClient.post(`/courses/${id}/publish`, {}),
  complete: (id) => apiClient.post(`/courses/${id}/complete`, {}),
  enroll: (id) => apiClient.post(`/courses/${id}/enroll`, {}),
  mine: () => apiClient.get("/course-enrollments/me"),
  enrollments: () => apiClient.get("/course-enrollments"),
  cancel: (id) => apiClient.post(`/course-enrollments/${id}/cancel`, {}),
  payment: (id, method) => apiClient.post(`/course-enrollments/${id}/payment`, { method }),
});
