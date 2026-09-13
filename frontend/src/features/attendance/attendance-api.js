import { apiClient } from "../../api/client.js";
export const attendanceApi = Object.freeze({
  byClass: (classId) => apiClient.get(`/classes/${classId}/attendance`),
  checkIn: (bookingId) => apiClient.post("/attendance/check-in", { bookingId }),
  checkOut: (id) => apiClient.post(`/attendance/${id}/check-out`),
  correct: (id, input) => apiClient.post(`/attendance/${id}/corrections`, input),
});
