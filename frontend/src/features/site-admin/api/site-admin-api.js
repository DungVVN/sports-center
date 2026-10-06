import { apiClient } from "../../../shared/api/client.js";

export const siteAdminApi = Object.freeze({
  pages: () => apiClient.get("/admin/site/pages"),
  createPage: (input) => apiClient.post("/admin/site/pages", input),
  page: (routeKey) => apiClient.get(`/admin/site/pages/${encodeURIComponent(routeKey)}`),
  startPageDraft: (routeKey) => apiClient.post(`/admin/site/pages/${encodeURIComponent(routeKey)}/draft`, {}),
  savePageDraft: (routeKey, input) => apiClient.put(`/admin/site/pages/${encodeURIComponent(routeKey)}/draft`, input),
  publishPage: (routeKey, editRevision) => apiClient.post(`/admin/site/pages/${encodeURIComponent(routeKey)}/publish`, { editRevision }),
  restorePage: (routeKey, revisionId) => apiClient.post(`/admin/site/pages/${encodeURIComponent(routeKey)}/restore`, { revisionId }),
  cloudinarySignature: () => apiClient.post("/admin/site/media/cloudinary/signature", {}),
  recordCloudinaryUpload: (input) => apiClient.post("/admin/site/media/cloudinary", input),
  menu: (location) => apiClient.get(`/admin/site/menus/${location}`),
  saveMenuDraft: (location, input) => apiClient.put(`/admin/site/menus/${location}/draft`, input),
  publishMenu: (location, editRevision) => apiClient.post(`/admin/site/menus/${location}/publish`, { editRevision }),
  restoreMenu: (location, revisionId) => apiClient.post(`/admin/site/menus/${location}/restore`, { revisionId }),
});
