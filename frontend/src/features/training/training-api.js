import { apiClient } from "../../api/client.js";
export const trainingApi = Object.freeze({ templates: () => apiClient.get("/training-templates"), plans: (memberId) => apiClient.get(`/training-plans${memberId ? `?memberId=${memberId}` : ""}`), createPlan: (input) => apiClient.post("/training-plans", input), recordResult: (input) => apiClient.post("/training-results", input) });
