import { apiClient } from "../../../shared/api/client.js";

export const publicSiteApi = Object.freeze({
  home: () => apiClient.get("/site/pages/home"),
  pageByPath: (path) => apiClient.get(`/site/page?path=${encodeURIComponent(path)}`),
  menu: (location) => apiClient.get(`/site/menus/${location}`),
});

export const siteCmsPublicEnabled = import.meta.env.VITE_SITE_CMS_PUBLIC_ENABLED === "true";
