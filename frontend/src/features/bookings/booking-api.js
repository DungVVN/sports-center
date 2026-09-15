import { apiClient } from "../../api/client.js";
export const bookingApi=Object.freeze({list:(memberId)=>apiClient.get(`/bookings${memberId?`?memberId=${memberId}`:""}`),byClass:(classId)=>apiClient.get(`/classes/${classId}/bookings`),create:(input)=>apiClient.post("/bookings",input),cancel:(id,reason)=>apiClient.patch(`/bookings/${id}/cancel`,{reason})});
