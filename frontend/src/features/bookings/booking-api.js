import { apiClient } from "../../api/client.js";
const optionalId = (value) => typeof value === "string" && value.trim() ? encodeURIComponent(value.trim()) : "";
export const bookingApi=Object.freeze({list:(memberId)=>{const id=optionalId(memberId);return apiClient.get(`/bookings${id?`?memberId=${id}`:""}`);},byClass:(classId)=>apiClient.get(`/classes/${classId}/bookings`),create:(input)=>apiClient.post("/bookings",input),cancel:(id,reason)=>apiClient.patch(`/bookings/${id}/cancel`,{reason})});
