import { apiClient } from "../../api/client.js";
export const classApi=Object.freeze({list:()=>apiClient.get("/classes"),rooms:()=>apiClient.get("/rooms"),coaches:()=>apiClient.get("/coaches"),create:(input)=>apiClient.post("/classes",input),publish:(id)=>apiClient.post(`/classes/${id}/publish`)});
