import { dashboardView } from "../src/app/dashboard-routes.js";
import { loadPublicDocument, pageHead, renderPageBody, serializeJson } from "../server/public-seo.js";

const privatePaths = new Set(["/login", "/register", "/verify", "/pending"]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isAdmin = url.hostname === "admin.kineticsports.io.vn";
  if (isAdmin && url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (url.hostname === "www.kineticsports.io.vn") { url.hostname = "kineticsports.io.vn"; return Response.redirect(url.toString(), 308); }
  if (!["GET", "HEAD"].includes(context.request.method) || ["/robots.txt", "/sitemap.xml"].includes(url.pathname)) return context.next();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) { url.pathname = url.pathname.replace(/\/+$/, ""); return Response.redirect(url.toString(), 308); }
  const shell = await context.next();
  if (!shell.headers.get("Content-Type")?.includes("text/html")) return shell;
  if (isAdmin || privatePaths.has(url.pathname) || dashboardView(url.pathname)) {
    const response = new Response(shell.body, shell);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return new HTMLRewriter().on("head", { element(element) { element.append('<meta name="robots" content="noindex,nofollow">', { html: true }); } }).transform(response);
  }
  const document = await loadPublicDocument(url.pathname, context.env);
  const preview = url.hostname !== "kineticsports.io.vn" && url.hostname !== "www.kineticsports.io.vn";
  const response = new Response(shell.body, { status: document.status, headers: shell.headers });
  response.headers.set("Cache-Control", "no-store");
  if (document.noindex || preview) response.headers.set("X-Robots-Tag", "noindex, follow");
  if (document.status === 503) response.headers.set("Retry-After", "60");
  const bootstrap = document.status === 200 ? `<script id="public-page-data" type="application/json">${serializeJson(document)}</script>` : "";
  return new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(document.page.seoTitle || document.page.title); } })
    .on('meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"]', { element(element) { element.remove(); } })
    .on("head", { element(element) { element.append(pageHead({ ...document, noindex: document.noindex || preview }) + bootstrap, { html: true }); } })
    .on("#root", { element(element) { element.setInnerContent(renderPageBody(document), { html: true }); } })
    .transform(response);
}
