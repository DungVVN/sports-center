import { apiClient } from "../../api/client.js";

const requestStatus = (value) => typeof value === "string" && value.trim() ? encodeURIComponent(value.trim()) : "pending";

export const classApi=Object.freeze({list:()=>apiClient.get("/classes"),changeRequests:(status="pending")=>apiClient.get(`/class-change-requests?status=${requestStatus(status)}`),rooms:()=>apiClient.get("/rooms"),coaches:()=>apiClient.get("/coaches"),create:(input)=>apiClient.post("/classes",input),update:(id,input)=>apiClient.patch(`/classes/${id}`,input),publish:(id)=>apiClient.post(`/classes/${id}/publish`),requestChange:(id,input)=>apiClient.post(`/classes/${id}/change-requests`,input),reviewChange:(id,approved)=>apiClient.patch(`/class-change-requests/${id}`,{approved})});
