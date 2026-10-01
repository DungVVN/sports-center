import { z } from "zod";

const text = (max) => z.string().trim().max(max);
const nonempty = (max) => text(max).min(1);
const safeUrl = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  if (value.startsWith("/")) return /^\/(?!\/)[a-z0-9/_#?=&.-]*$/i.test(value);
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}, "Chỉ dùng đường dẫn nội bộ hoặc HTTPS hợp lệ.");
const blockBase = { id: z.string().uuid(), active: z.boolean().default(true) };
const button = { buttonLabel: text(80).default(""), buttonHref: safeUrl.default("") };

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("hero"), eyebrow: text(100).default(""), title: nonempty(160), description: text(800).default(""), imageUrl: safeUrl.default(""), imageAlt: text(300).default(""), ...button }).strict(),
  z.object({ ...blockBase, type: z.literal("richText"), title: nonempty(160), body: text(5000) }).strict(),
  z.object({ ...blockBase, type: z.literal("imageText"), title: nonempty(160), body: text(3000), imageUrl: safeUrl, imageAlt: text(300).default("") }).strict(),
  z.object({ ...blockBase, type: z.literal("cta"), title: nonempty(160), body: text(800).default(""), ...button }).strict(),
  z.object({ ...blockBase, type: z.literal("faq"), title: nonempty(160), items: z.array(z.object({ question: nonempty(240), answer: nonempty(1500) }).strict()).min(1).max(20) }).strict(),
]);

export const pageDraftSchema = z.object({
  editRevision: z.number().int().nonnegative(),
  title: nonempty(240),
  seoTitle: text(240).default(""),
  seoDescription: text(500).default(""),
  blocks: z.array(blockSchema).max(30),
}).strict().superRefine(({ blocks }, ctx) => {
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) ctx.addIssue({ code: "custom", path: ["blocks"], message: "ID khối nội dung bị trùng." });
});

export const pageCreateSchema = z.object({
  routeKey: z.string().regex(/^[a-z][a-z0-9_-]*$/).max(80),
  path: z.string().regex(/^\/(?:[a-z0-9][a-z0-9/-]*)?$/).max(240),
  kind: z.enum(["home", "static"]),
  title: nonempty(240),
}).strict().superRefine(({ routeKey, path, kind }, ctx) => {
  if (["/gallery", "/calendar"].some((route) => path.startsWith(`${route}/`))) ctx.addIssue({ code: "custom", path: ["path"], message: "Chỉ quản lý đường dẫn chính của trang thư viện và lịch." });
  if (kind === "home" ? routeKey !== "home" || path !== "/" : routeKey === "home" || path === "/") ctx.addIssue({ code: "custom", path: ["path"], message: "Chỉ trang chủ được dùng route home và đường dẫn /." });
  if (["/admin", "/site", "/login", "/register", "/verify", "/pending", "/dashboard", "/profile", "/support", "/members", "/memberships", "/packages", "/classes", "/bookings", "/facilities", "/attendance", "/payments", "/staff", "/training", "/reports", "/audit-logs", "/my"].some((reserved) => path === reserved || path.startsWith(`${reserved}/`))) ctx.addIssue({ code: "custom", path: ["path"], message: "Đường dẫn đã dành cho chức năng hiện có." });
});

const menuFields = {
  id: z.string().uuid(), label: nonempty(80), kind: z.enum(["link", "group"]), href: safeUrl.default(""), active: z.boolean().default(true),
};
const childItem = z.object({ ...menuFields, kind: z.literal("link"), children: z.array(z.never()).max(0).default([]) }).strict();
const menuItem = z.object({ ...menuFields, children: z.array(childItem).max(12).default([]) }).strict();

export const menuDraftSchema = z.object({ editRevision: z.number().int().nonnegative(), items: z.array(menuItem).max(20) }).strict().superRefine(({ items }, ctx) => {
  const ids = new Set();
  const walk = (nodes) => {
    for (const node of nodes) {
      if (ids.has(node.id)) ctx.addIssue({ code: "custom", path: ["items"], message: "ID mục menu bị trùng." });
      ids.add(node.id);
      if (node.kind === "link" && !node.href || node.kind === "group" && node.href) ctx.addIssue({ code: "custom", path: ["items"], message: "Đích đến không hợp lệ với loại mục menu." });
      if (node.kind === "link" && node.children.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Mục liên kết không được chứa mục con." });
      walk(node.children);
    }
  };
  walk(items);
});

export const siteLocationSchema = z.enum(["header", "footer"]);
