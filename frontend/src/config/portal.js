const adminHostname = "admin.kineticsports.io.vn";
const mainHostnames = new Set(["kineticsports.io.vn", "www.kineticsports.io.vn"]);

export function portalSurfaceForHostname(hostname, configuredAdminPortal = false) {
  const normalized = hostname.toLowerCase();
  if (normalized === adminHostname) return "admin";
  if (mainHostnames.has(normalized)) return "main";
  return configuredAdminPortal ? "admin" : "main";
}

export function portalSurface() {
  return portalSurfaceForHostname(window.location.hostname, import.meta.env.VITE_ADMIN_PORTAL === "true");
}
