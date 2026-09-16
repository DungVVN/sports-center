import { apiClient } from "../../api/client.js";
export const supportApi = Object.freeze({ list: () => apiClient.get("/support-tickets"), create: (input) => apiClient.post("/support-tickets", input) });
