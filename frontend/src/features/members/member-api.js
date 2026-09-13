import { apiClient } from "../../api/client.js";
export const memberApi = Object.freeze({ list: () => apiClient.get("/members"), create: (input) => apiClient.post("/members", input), update: (id, input) => apiClient.patch(`/members/${id}`, input), replaceContacts: (id, contacts) => apiClient.put(`/members/${id}/emergency-contacts`, { contacts }) });
