import { escapeHtml, pageHead, serializeJson } from "../src/features/site/model/seo-head.js";
export { pageHead, serializeJson };
import { corePages, homeSeo } from "../src/features/site/model/core-pages.js";

export const homePage = {
  ...homeSeo,
  blocks: [{ id: "home", type: "hero", active: true, title: "Đánh Thức Đam Mê Kiến Tạo Sức Khỏe", description: "Không gian tập luyện hiện đại cùng các hoạt động thể thao đa dạng tại Kinetic Sports Center." }],
};

export function safeUrl(value) {
  if (typeof value !== "string" || [...value].some((char) => char.charCodeAt(0) <= 32 || char === "\\")) return "";
  if (/^\/(?!\/)/.test(value)) return value;
  try { return new URL(value).protocol === "https:" ? value : ""; } catch { return ""; }
}

function button(block) {
  const href = safeUrl(block.buttonHref);
  return href && block.buttonLabel ? `<a class="site-blocks__button" href="${escapeHtml(href)}">${escapeHtml(block.buttonLabel)}</a>` : "";
}

export function renderBlocks(blocks = []) {
  return blocks.filter((block) => block.active).map((block) => {
    const title = escapeHtml(block.title);
    const body = `<p style="white-space:pre-line">${escapeHtml(block.body || block.description || "")}</p>`;
    const image = safeUrl(block.imageUrl);
    const imageHtml = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(block.imageAlt)}" loading="lazy">` : "";
    let html = "";
    if (block.type === "hero") html = `<div class="site-blocks__hero${image ? " site-blocks__hero--with-image" : ""}">${imageHtml}<div><p class="site-blocks__eyebrow">${escapeHtml(block.eyebrow)}</p><h1>${title}</h1>${body}${button(block)}</div></div>`;
    if (block.type === "richText") html = `<div class="site-blocks__copy"><h2>${title}</h2>${body}</div>`;
    if (block.type === "imageText") html = `<div class="site-blocks__split${image ? " site-blocks__split--with-image" : ""}">${imageHtml}<div><h2>${title}</h2>${body}</div></div>`;
    if (block.type === "cta") html = `<div class="site-blocks__cta${button(block) ? " site-blocks__cta--with-action" : ""}"><div><h2>${title}</h2>${body}</div>${button(block)}</div>`;
    if (block.type === "faq") html = `<div class="site-blocks__copy"><h2>${title}</h2>${(block.items || []).map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("")}</div>`;
    return html ? `<section class="site-blocks__section site-blocks__section--${escapeHtml(block.type)}">${html}</section>` : "";
  }).join("");
}

export function renderPackages(packages = []) {
  return `<section class="section-pricing"><h2>Gói Hội Viên Linh Hoạt</h2><div class="pricing-grid">${packages.length ? packages.map((pkg) => `<article class="price-card"><div class="price-header"><h3>${escapeHtml(pkg.name)}</h3><p>${escapeHtml(pkg.durationDays)} ngày sử dụng</p><p>${escapeHtml(Number(pkg.priceVnd).toLocaleString("vi-VN"))} ₫ / gói</p></div><div class="price-body"><ul>${(pkg.benefits || []).map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("")}</ul><a class="btn-primary" href="/register">Tạo tài khoản</a></div></article>`).join("") : "<p>Hiện chưa có gói hội viên được mở bán.</p>"}</div></section>`;
}

export function renderPageBody({ path, page, packages }) {
  const navigation = corePages.map((item) => `<a href="${item.path}">${escapeHtml(item.label)}</a>`).join(" ");
  const directory = path === "/" ? `<section class="section-zigzag"><h2>Tìm thông tin cho hành trình tập luyện</h2><div class="public-page-directory">${corePages.map((item) => `<a class="public-page-directory__link" href="${item.path}"><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.description)}</p></a>`).join("")}</div></section>` : "";
  return `<div class="landing-container"><nav class="landing-navbar scrolled" aria-label="Điều hướng trang công khai"><a href="/">Kinetic</a><div class="navbar-links">${navigation}</div><a href="/login">Đăng nhập</a></nav><main class="public-page-body"><div class="site-blocks">${renderBlocks(page.blocks)}</div>${directory}${path === "/bang-gia" && Array.isArray(packages) ? renderPackages(packages) : ""}</main></div>`;
}

export function errorDocument(path, status) {
  return { path, status, noindex: true, page: { title: status === 404 ? "Không tìm thấy trang" : "Nội dung tạm thời chưa tải được", seoDescription: "", blocks: [{ type: "hero", active: true, title: status === 404 ? "Không tìm thấy trang" : "Nội dung tạm thời chưa tải được", description: status === 404 ? "Đường dẫn không tồn tại hoặc chưa được xuất bản." : "Vui lòng tải lại trang sau ít phút.", buttonLabel: "Về trang chủ", buttonHref: "/" }] } };
}

export async function loadPublicDocument(path, env, fetcher = fetch) {
  const builtIn = { "/gallery": ["Thư viện hình ảnh", "Khám phá hình ảnh không gian tập luyện tại Kinetic Sports Center."], "/calendar": ["Lịch hoạt động", "Xem lịch hoạt động và lịch sân tại Kinetic Sports Center."] }[path];
  if (builtIn) return { path, status: 200, page: { title: builtIn[0], seoTitle: `${builtIn[0]} | Kinetic Sports Center`, seoDescription: builtIn[1], blocks: [{ type: "hero", active: true, title: builtIn[0], description: builtIn[1] }] } };
  const api = (env.VITE_API_BASE_URL || "https://api.kineticsports.io.vn/api/v1").replace(/\/$/, "");
  try {
    const response = await fetcher(`${api}/site/page?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404 || response.status === 400) return path === "/" ? { path, page: homePage, status: 200 } : errorDocument(path, 404);
    if (!response.ok) return errorDocument(path, 503);
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.data?.blocks)) return errorDocument(path, 503);
    const document = { path, page: payload.data, status: 200 };
    if (path === "/bang-gia") {
      const packagesResponse = await fetcher(`${api}/public/membership-packages`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!packagesResponse.ok) return errorDocument(path, 503);
      const packages = await packagesResponse.json();
      if (!packages.success || !Array.isArray(packages.data)) return errorDocument(path, 503);
      document.packages = packages.data;
    }
    return document;
  } catch { return errorDocument(path, 503); }
}
