import { apiClient } from "../../../shared/api/client.js";

export const rolePermissionApi = Object.freeze({
  matrix: () => apiClient.get("/admin/permissions/matrix"),
  replace: (role, input) => apiClient.put(`/admin/roles/${encodeURIComponent(role)}/permissions`, input),
});
