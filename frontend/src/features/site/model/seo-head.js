import { publicSiteOrigin } from "./core-pages.js";
export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const serializeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export function pageHead({ path, page, noindex = false }) {
  const canonical = `${publicSiteOrigin}${path}`;
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || "";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${publicSiteOrigin}/#organization`, name: "Kinetic Sports Center", url: `${publicSiteOrigin}/` },
      { "@type": "WebPage", "@id": canonical, url: canonical, name: title, description, inLanguage: "vi", isPartOf: { "@id": `${publicSiteOrigin}/#website` } },
      { "@type": "WebSite", "@id": `${publicSiteOrigin}/#website`, name: "Kinetic Sports Center", url: `${publicSiteOrigin}/`, publisher: { "@id": `${publicSiteOrigin}/#organization` } },
      ...(path !== "/" ? [{ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Trang chủ", item: `${publicSiteOrigin}/` }, { "@type": "ListItem", position: 2, name: page.title, item: canonical }] }] : []),
    ],
  };
  return `<meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="vi_VN"><meta property="og:site_name" content="Kinetic Sports Center"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${publicSiteOrigin}/assets/images/gym.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${publicSiteOrigin}/assets/images/gym.jpg">${noindex ? "" : `<script id="public-seo-schema" type="application/ld+json">${serializeJson(schema)}</script>`}`;
}
