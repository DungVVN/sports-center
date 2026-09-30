import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/database.js";
import { menuDraftSchema, pageCreateSchema, pageDraftSchema } from "../src/modules/site/domain/site-content.js";

// One-time snapshot of the former hard-coded landing page and public navigation.
// Pricing and booking data are deliberately excluded: they remain operational data.
const block = (type, fields) => ({ id: randomUUID(), active: true, type, ...fields });
const link = (label, href) => ({ id: randomUUID(), label, kind: "link", href, active: true, children: [] });
const home = pageCreateSchema.parse({ routeKey: "home", path: "/", kind: "home", title: "Trang chủ" });
const pageDraft = pageDraftSchema.parse({
  editRevision: 1,
  title: "Kinetic Sports Center - Trang chủ",
  seoTitle: "Kinetic Sports Center | Trung tâm thể thao đẳng cấp 5 sao",
  seoDescription: "Không gian tập luyện hiện đại, trang thiết bị tối tân cùng hệ sinh thái thể thao đa dạng tại Kinetic Sports Center.",
  blocks: [
    block("hero", { eyebrow: "TRUNG TÂM THỂ THAO ĐẲNG CẤP 5 SAO", title: "Đánh Thức Đam Mê Kiến Tạo Sức Khỏe", description: "Không gian tập luyện hiện đại, trang thiết bị tối tân cùng hệ sinh thái đa dạng. Nơi lý tưởng để bạn bứt phá mọi giới hạn của bản thân. Hơn 10,000+ hội viên đã tin tưởng và đồng hành.", imageUrl: "/assets/images/gym.jpg", buttonLabel: "", buttonHref: "" }),
    block("imageText", { title: "Hành Trình Kiến Tạo Sức Khỏe Cộng Đồng", body: "Kinetic Sports Center không chỉ là một trung tâm thể thao, mà là một hệ sinh thái chăm sóc sức khỏe toàn diện. Chúng tôi tin rằng một cơ thể khỏe mạnh là nền tảng cho một cuộc sống hạnh phúc và thành công.\n\nVới sự đầu tư mạnh mẽ vào cơ sở vật chất, 100% trang thiết bị nhập khẩu từ châu Âu cùng đội ngũ huấn luyện viên đạt chuẩn quốc tế, Kinetic cam kết mang lại trải nghiệm luyện tập an toàn, chuyên nghiệp và hiệu quả nhất cho từng hội viên.\n\nChất lượng 5 sao · Cộng đồng tinh hoa · 10+ năm kinh nghiệm.", imageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop", imageAlt: "Huấn luyện viên hỗ trợ hội viên" }),
    block("richText", { title: "Trải Nghiệm Đỉnh Cao", body: "Mỗi khu vực đều được thiết kế tỉ mỉ, tối ưu hóa không gian và công năng để mang lại trải nghiệm tuyệt vời nhất.\n\n5+ môn thể thao · 5,000 m² diện tích mặt sàn · 50+ HLV quốc tế · 100% thiết bị nhập khẩu." }),
    block("imageText", { title: "Sân Bóng Đá Cỏ Nhân Tạo", body: "Tận hưởng cảm giác thi đấu trên mặt cỏ đạt chuẩn FIFA. Hệ thống thoát nước tối ưu và dàn đèn chiếu sáng LED chống chói giúp các trận đấu diễn ra hoàn hảo bất kể thời tiết hay ngày đêm.\n\nCỏ nhân tạo thế hệ mới, êm ái, chống chấn thương. Băng ghế huấn luyện viên có mái che chuẩn chuyên nghiệp. Cung cấp bóng thi đấu và nước uống miễn phí.", imageUrl: "/assets/images/soccer.jpg", imageAlt: "Sân bóng đá cỏ nhân tạo" }),
    block("imageText", { title: "Phòng Gym & Yoga 360°", body: "Không gian mở với vách kính cường lực nhìn toàn cảnh thành phố. Được trang bị 100% thiết bị từ Technogym, đáp ứng mọi nhu cầu từ Cardio, Free-weight đến các lớp Group X năng động.\n\nHơn 100 máy tập đa dạng, không phải chờ đợi. Inbody miễn phí, lên phác đồ tập luyện cá nhân hóa. Phòng Studio Yoga rộng 200m2 với thảm tập kháng khuẩn.", imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop", imageAlt: "Phòng tập Gym hiện đại" }),
    block("cta", { title: "Bắt đầu hành trình của bạn ngay hôm nay!", body: "Tạo tài khoản, xác thực email và hoàn thiện hồ sơ để được hỗ trợ lựa chọn gói phù hợp.", buttonLabel: "Tạo tài khoản", buttonHref: "/register" }),
    block("richText", { title: "Liên Hệ", body: "Kinetic Sports — Hệ sinh thái thể thao 5 sao, mang đến môi trường tập luyện lý tưởng. Nơi khơi nguồn năng lượng và kết nối cộng đồng yêu thể thao.\n\n123 Đường Thể Thao, Quận 1, TP.HCM\n1900 1234\ncontact@kineticsports.io.vn" }),
  ],
});
const menus = {
  header: menuDraftSchema.parse({ editRevision: 0, items: [link("Về Chúng Tôi", "/#about"), link("Dịch Vụ", "/#facilities"), link("Bảng Giá", "/#pricing"), link("Liên Hệ", "/#contact")] }),
  footer: menuDraftSchema.parse({ editRevision: 0, items: [link("Sân Bóng Đá", "/#facilities"), link("Phòng Gym", "/#facilities"), link("Yoga & Group X", "/#facilities"), link("Sân Tennis", "/#facilities")] }),
};

async function postgresDumpBinary() {
  if (process.env.PG_DUMP_BIN) return process.env.PG_DUMP_BIN;
  const root = join(process.env.ProgramFiles ?? "C:\\Program Files", "PostgreSQL");
  try {
    const versions = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).map((entry) => Number(entry.name)).sort((a, b) => b - a);
    for (const version of versions) {
      const candidate = join(root, String(version), "bin", "pg_dump.exe");
      if (existsSync(candidate)) return candidate;
    }
  } catch { /* pg_dump may be provided by PATH. */ }
  return process.platform === "win32" ? "pg_dump.exe" : "pg_dump";
}

async function backupDatabase(connectionString, binary) {
  const url = new URL(connectionString);
  const directory = join(tmpdir(), "sports-center-backups");
  await mkdir(directory, { recursive: true });
  const filename = join(directory, `before-site-draft-import-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: url.searchParams.get("sslmode") || "require" };
  await new Promise((resolve, reject) => {
    const child = spawn(binary, ["--format=custom", "--no-owner", "--no-privileges", `--file=${filename}`], { env, stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump thất bại (mã ${code}); chưa nhập bản nháp.`)));
  });
  if ((await stat(filename)).size === 0) throw new Error("Bản sao lưu trống; chưa nhập bản nháp.");
  return filename;
}

const mode = process.argv[2] ?? "--dry-run";
if (!["--dry-run", "--apply"].includes(mode)) throw new Error("Chỉ hỗ trợ --dry-run hoặc --apply.");
const awaitedBinary = mode === "--apply" ? await postgresDumpBinary() : null;
try {
  const before = await Promise.all([
    prisma.site_pages.count(), prisma.site_page_revisions.count(), prisma.site_page_publications.count(),
    prisma.site_menu_revisions.count(), prisma.site_menu_publications.count(),
  ]);
  if (before.some(Boolean)) throw new Error("CMS đã có dữ liệu; dừng để tránh ghi đè hoặc tạo trùng. Không có gì được thay đổi.");
  console.log(JSON.stringify({ mode, page: home.path, blocks: pageDraft.blocks.length, headerItems: menus.header.items.length, footerItems: menus.footer.items.length, existingCmsRows: before }));
  if (mode === "--apply") {
    const backupPath = await backupDatabase(process.env.DATABASE_URL, awaitedBinary);
    console.log(`Đã sao lưu database tại: ${backupPath}`);
    await prisma.$transaction(async (tx) => {
      const unchanged = await Promise.all([
        tx.site_pages.count(), tx.site_page_revisions.count(), tx.site_page_publications.count(),
        tx.site_menu_revisions.count(), tx.site_menu_publications.count(),
      ]);
      if (unchanged.some(Boolean)) throw new Error("CMS thay đổi trong lúc sao lưu; không nhập dữ liệu.");
      const page = await tx.site_pages.create({ data: { route_key: home.routeKey, path: home.path, kind: home.kind } });
      await tx.site_page_revisions.create({ data: { page_id: page.id, version_number: 1, status: "draft", title: pageDraft.title, seo_title: pageDraft.seoTitle, seo_description: pageDraft.seoDescription, blocks: pageDraft.blocks } });
      for (const [location, menu] of Object.entries(menus)) await tx.site_menu_revisions.create({ data: { location, version_number: 1, status: "draft", items: menu.items } });
      await tx.audit_logs.create({ data: { action: "site.legacy_drafts_imported", entity_type: "site_page", entity_id: page.id, summary: "Imported legacy public website content and menus as unpublished CMS drafts", new_value: { routeKey: home.routeKey, locations: Object.keys(menus) } } });
    });
    console.log("Đã nhập 1 trang chủ và 2 menu ở trạng thái nháp; không tạo bản xuất bản.");
  }
} finally {
  await prisma.$disconnect();
}
