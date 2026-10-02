export const defaultPublicWebOrigin = "https://kineticsports.io.vn";

export function emailWebLink(path, config) {
  const origin = new URL(config.publicWebOrigin ?? defaultPublicWebOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || /^(localhost|127\.|\[::1\])/.test(origin.hostname)) {
    throw new Error("PUBLIC_WEB_ORIGIN must be a public HTTPS origin.");
  }
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Email links must use an application path.");
  }
  const link = new URL(path, origin);
  if (link.origin !== origin.origin) throw new Error("Email links must stay on the web application.");
  return link.href;
}
