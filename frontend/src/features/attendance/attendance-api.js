import { apiClient } from "../../api/client.js";
export const attendanceApi = Object.freeze({
  mine: () => apiClient.get("/members/me/attendance"),
  byClass: (classId) => apiClient.get(`/classes/${classId}/attendance`),
  checkIn: (bookingId) => apiClient.post("/attendance/check-in", { bookingId }),
  submit: (classId, entries) => apiClient.post(`/classes/${classId}/attendance/submit`, { entries }),
  correct: (id, input) =>
    apiClient.post(`/attendance/${id}/corrections`, input),
});
