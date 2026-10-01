const uuid = { type: "string", format: "uuid" };
const text = (maxLength, minLength = 0) => ({ type: "string", minLength, maxLength });
const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const array = (items, maxItems) => ({ type: "array", items, ...(maxItems === undefined ? {} : { maxItems }) });
const json = (schema) => ({ "application/json": { schema } });
const response = (schema, description = "Thành công") => ({ description, content: json(object({ success: { type: "boolean", const: true }, data: schema })) });
const error = (description) => ({ description, content: json(ref("SiteErrorResponse")) });
const safeUrl = { ...text(1000), description: "Đường dẫn nội bộ bắt đầu bằng / (không dùng //), hoặc HTTPS không chứa tên đăng nhập/mật khẩu. Chuỗi rỗng được phép khi không có liên kết." };
const blockBase = { id: uuid, active: { type: "boolean", default: true } };
const button = { buttonLabel: text(80), buttonHref: safeUrl };
const block = (type, fields, required) => object({ ...blockBase, type: { type: "string", const: type }, ...fields }, ["id", "type", ...required]);
const itemFields = { id: uuid, label: text(80, 1), kind: { type: "string", enum: ["link", "group"] }, href: safeUrl, active: { type: "boolean", default: true } };
const recordFields = { id: uuid, version_number: { type: "integer", minimum: 1 }, edit_revision: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["draft", "published"] }, created_by: nullable(uuid), updated_by: nullable(uuid), created_at: { type: "string", format: "date-time" }, updated_at: { type: "string", format: "date-time" } };
const pageFields = { path: { type: "string", maxLength: 240 }, kind: { type: "string", enum: ["home", "static"] }, title: text(240, 1), seoTitle: text(240), seoDescription: text(500), blocks: array(ref("SiteBlock"), 30) };
const pageRecordFields = { id: uuid, route_key: { type: "string", pattern: "^[a-z][a-z0-9_-]*$", maxLength: 80 }, path: pageFields.path, kind: pageFields.kind, is_active: { type: "boolean" } };
const history = array(object({ id: uuid, versionNumber: { type: "integer", minimum: 1 }, status: recordFields.status, updatedAt: recordFields.updated_at }));
const examples = {
  SitePageCreateRequest: { routeKey: "dich-vu", path: "/dich-vu", kind: "static", title: "Dịch vụ" },
  SitePageDraftRequest: { editRevision: 1, title: "Dịch vụ", seoTitle: "Dịch vụ thể thao | Kinetic Sports", seoDescription: "Khám phá dịch vụ và các hoạt động tại Kinetic Sports.", blocks: [{ id: "fd56c5eb-25a7-4398-8d61-f79fdfe58ebd", type: "hero", active: true, title: "Dịch vụ thể thao", description: "Tìm hoạt động phù hợp với bạn.", buttonLabel: "Liên hệ", buttonHref: "/lien-he" }] },
  SiteMenuDraftRequest: { editRevision: 0, items: [{ id: "718fcb3d-9312-4a58-9ba1-86af9fd95ca6", label: "Dịch Vụ", kind: "link", href: "/dich-vu", active: true, children: [] }] },
  SitePublishRequest: { editRevision: 2 },
  SiteRestoreRequest: { revisionId: "fd56c5eb-25a7-4398-8d61-f79fdfe58ebd" },
  SiteMediaUploadRequest: { secureUrl: "https://res.cloudinary.com/your-cloud/image/upload/v1/kinetic-sports/site/example.jpg", publicId: "kinetic-sports/site/example", originalName: "example.jpg", mimeType: "image/jpeg", bytes: 102400, width: 1200, height: 800 },
};
const body = (name) => ({ required: true, content: { "application/json": { schema: ref(name), example: examples[name] } } });

export function applySiteContract(spec) {
  Object.assign(spec.components.securitySchemes, {
    adminSessionCookie: { type: "apiKey", in: "cookie", name: "sports_center_admin_session", description: "Phiên từ /auth/admin/login hoặc MFA admin. Cookie được gửi từ cổng admin; cookie của cổng hội viên không thay thế phiên admin." },
    sessionBearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token phiên hiện có; các API CMS vẫn yêu cầu tài khoản admin." },
  });
  Object.assign(spec.components.schemas, {
    SiteBlock: { oneOf: ["SiteHeroBlock", "SiteRichTextBlock", "SiteImageTextBlock", "SiteCtaBlock", "SiteFaqBlock"].map(ref), discriminator: { propertyName: "type" } },
    SiteHeroBlock: block("hero", { eyebrow: text(100), title: text(160, 1), description: text(800), imageUrl: safeUrl, imageAlt: text(300), ...button }, ["title"]),
    SiteRichTextBlock: block("richText", { title: text(160, 1), body: text(5000) }, ["title", "body"]),
    SiteImageTextBlock: block("imageText", { title: text(160, 1), body: text(3000), imageUrl: safeUrl, imageAlt: text(300) }, ["title", "body", "imageUrl"]),
    SiteCtaBlock: block("cta", { title: text(160, 1), body: text(800), ...button }, ["title"]),
    SiteFaqBlock: block("faq", { title: text(160, 1), items: { ...array(object({ question: text(240, 1), answer: text(1500, 1) }), 20), minItems: 1 } }, ["title", "items"]),
    SiteMenuChild: object({ ...itemFields, kind: { type: "string", const: "link" }, children: { type: "array", maxItems: 0, items: false, default: [] } }, ["id", "label", "kind"]),
    SiteMenuItem: { ...object({ ...itemFields, children: { ...array(ref("SiteMenuChild"), 12), default: [] } }, ["id", "label", "kind"]), description: "Tối đa hai cấp; ID duy nhất trong toàn cây. link cần href và không có con. group không có href. Chỉ mục active mới được công khai." },
    SitePageCreateRequest: { ...object({ routeKey: pageRecordFields.route_key, path: { ...pageFields.path, pattern: "^/(?:[a-z0-9][a-z0-9/-]*)?$" }, kind: pageFields.kind, title: pageFields.title }), description: "home chỉ dùng routeKey=home và path=/. static không dùng home hoặc /. Không dùng đường dẫn dành cho login, admin, dashboard hoặc các chức năng vận hành." },
    SitePageDraftRequest: { ...object({ editRevision: { type: "integer", minimum: 0 }, title: pageFields.title, seoTitle: pageFields.seoTitle, seoDescription: pageFields.seoDescription, blocks: pageFields.blocks }, ["editRevision", "title", "blocks"]), description: "Dùng edit_revision của draft hiện tại. ID block không được trùng. Lưu chỉ cập nhật bản nháp; không tự xuất bản." },
    SiteMenuDraftRequest: object({ editRevision: { type: "integer", minimum: 0, description: "0 khi chưa có draft; nếu đã có draft phải khớp edit_revision hiện tại." }, items: array(ref("SiteMenuItem"), 20) }),
    SitePublishRequest: object({ editRevision: { type: "integer", minimum: 1 } }),
    SiteRestoreRequest: object({ revisionId: uuid }),
    SitePublicPage: object(pageFields),
    SitePageRecord: object({ ...pageRecordFields, created_at: recordFields.created_at, updated_at: recordFields.updated_at }),
    SitePageRevision: object({ ...recordFields, page_id: uuid, title: pageFields.title, seo_title: pageFields.seoTitle, seo_description: pageFields.seoDescription, blocks: pageFields.blocks }),
    SiteMenuRevision: object({ ...recordFields, location: { type: "string", enum: ["header", "footer"] }, items: array(ref("SiteMenuItem"), 20) }),
    SitePageDetail: object({ page: ref("SitePageRecord"), draft: nullable(ref("SitePageRevision")), published: nullable(ref("SitePageRevision")), revisions: history }),
    SiteMenuDetail: object({ draft: nullable(ref("SiteMenuRevision")), published: nullable(ref("SiteMenuRevision")), revisions: history }),
    SiteRevisionPointer: object({ revisionId: uuid }),
    SiteMediaUploadRequest: object({ secureUrl: { type: "string", format: "uri", maxLength: 2048 }, publicId: text(255, 1), originalName: text(255, 1), mimeType: { type: "string", pattern: "^image/(jpeg|png|webp|gif|avif)$" }, bytes: { type: "integer", minimum: 1, maximum: 10485760 }, width: nullable({ type: "integer", minimum: 1, maximum: 10000 }), height: nullable({ type: "integer", minimum: 1, maximum: 10000 }) }),
    SiteMediaSignature: object({ cloudName: { type: "string" }, apiKey: { type: "string" }, timestamp: { type: "integer" }, signature: { type: "string" }, folder: { type: "string", const: "kinetic-sports/site" }, uploadUrl: { type: "string", format: "uri" }, maxBytes: { type: "integer", const: 10485760 } }),
    SiteMediaRecord: object({ id: uuid, storage_key: text(255), original_name: text(255), mime_type: text(64), byte_size: { type: "integer" }, width: nullable({ type: "integer" }), height: nullable({ type: "integer" }), alt_text: text(500), uploaded_by: nullable(uuid), created_at: recordFields.created_at, deleted_at: nullable(recordFields.created_at) }),
    SiteErrorResponse: object({ success: { type: "boolean", const: false }, error: object({ code: { type: "string" }, message: { type: "string" }, requestId: { type: "string" }, details: {} }, ["code", "message", "requestId"]) }),
  });
  const routeKey = { name: "routeKey", in: "path", required: true, schema: pageRecordFields.route_key };
  const location = { name: "location", in: "path", required: true, schema: { type: "string", enum: ["header", "footer"] } };
  const publicOp = (summary, data, parameters, description) => ({ tags: ["Site CMS"], summary, description, security: [], parameters, responses: { 200: response(data), 404: error("NOT_FOUND: chưa xuất bản, không tồn tại hoặc trang không hoạt động"), 422: error("VALIDATION_ERROR: tham số không hợp lệ") } });
  const adminOp = (summary, data, parameters = [], request, errors = {}, description = "") => ({
    tags: ["Site CMS"], summary, description: `Chỉ admin. ${description}`.trim(), security: [{ adminSessionCookie: [] }, { sessionBearer: [] }], parameters,
    ...(request ? { requestBody: body(request) } : {}),
    responses: { 200: response(data), 401: error("UNAUTHENTICATED hoặc WRONG_PORTAL_SESSION"), 403: error("ADMIN_REQUIRED hoặc PASSWORD_CHANGE_REQUIRED"), ...(request || parameters.length ? { 422: error("VALIDATION_ERROR: dữ liệu không hợp lệ") } : {}), ...errors },
  });
  const missing = { 404: error("NOT_FOUND: trang hoặc phiên bản đã xuất bản không tồn tại") };
  const stale = { 409: error("SITE_DRAFT_STALE hoặc SITE_DRAFT_REQUIRED: tải lại draft trước khi lưu/xuất bản") };
  const pagePublishErrors = { ...stale, 422: error("SITE_PAGE_NOT_READY / SITE_MENU_TARGET_UNPUBLISHED / SITE_PAGE_BLOCK_INVALID: cần block hiển thị và trang đích đã xuất bản") };
  const menuPublishErrors = { ...stale, 422: error("SITE_MENU_NOT_READY / SITE_MENU_TARGET_UNPUBLISHED: cần liên kết hiển thị và trang đích đã xuất bản") };
  Object.assign(spec.paths, {
    "/site/page": { get: publicOp("Đọc trang đã xuất bản theo đường dẫn", ref("SitePublicPage"), [{ name: "path", in: "query", required: true, schema: { type: "string", maxLength: 240, pattern: "^/(?:[a-z0-9][a-z0-9/-]*)?$", example: "/dich-vu" } }], "Đọc publication pointer, không trả draft. Bốn trang độc lập: /ve-chung-toi, /dich-vu, /bang-gia, /lien-he. HTML SEO, canonical, robots và sitemap do frontend Cloudflare Pages phục vụ.") },
    "/site/pages/{routeKey}": { get: publicOp("Đọc trang đã xuất bản", ref("SitePublicPage"), [routeKey], "Chỉ trang active có publication. Không cần đăng nhập và không trả lịch sử hoặc bản nháp.") },
    "/site/menus/{location}": { get: publicOp("Đọc menu đã xuất bản", object({ items: array(ref("SiteMenuItem"), 20) }), [location], "Menu header/footer được lọc active ở cả hai cấp; không trả draft.") },
    "/admin/site/pages": {
      get: adminOp("Admin liệt kê trang", array(object({ ...pageRecordFields, title: pageFields.title, draft_version: nullable({ type: "integer" }), published_version: nullable({ type: "integer" }), block_count: { type: "integer" }, updated_at: nullable(recordFields.updated_at) }))),
      post: adminOp("Admin tạo trang và bản nháp đầu tiên", object({ page: ref("SitePageRecord"), draft: ref("SitePageRevision") }), [], "SitePageCreateRequest", { 409: error("SITE_PAGE_EXISTS: routeKey hoặc path đã tồn tại") }, "Trả HTTP 200. Tạo draft rỗng; trang chưa xuất bản và public read vẫn trả 404."),
    },
    "/admin/site/pages/{routeKey}": { get: adminOp("Admin xem bản nháp, bản công khai và lịch sử", ref("SitePageDetail"), [routeKey], undefined, missing) },
    "/admin/site/pages/{routeKey}/draft": {
      post: adminOp("Tạo bản nháp từ phiên bản gần nhất", ref("SitePageRevision"), [routeKey], undefined, { ...missing, 409: stale[409] }, "Nếu đã có draft, trả draft đó. Không đổi publication pointer."),
      put: adminOp("Lưu bản nháp, không xuất bản", ref("SitePageRevision"), [routeKey], "SitePageDraftRequest", { ...missing, ...stale }, "Tăng edit_revision sau khi lưu. Dùng giá trị trả về cho lần lưu/xuất bản tiếp theo."),
    },
    "/admin/site/pages/{routeKey}/publish": { post: adminOp("Admin xuất bản bản nháp trang", ref("SiteRevisionPointer"), [routeKey], "SitePublishRequest", { ...missing, ...pagePublishErrors }, "Cần ít nhất một block active. Kiểm tra liên kết nội bộ. Đóng băng revision, đổi publication pointer và ghi audit trong transaction.") },
    "/admin/site/pages/{routeKey}/restore": { post: adminOp("Chọn lại phiên bản trang đã xuất bản", ref("SiteRevisionPointer"), [routeKey], "SiteRestoreRequest", missing, "revisionId phải thuộc chính trang này và có status=published. Chỉ đổi publication pointer; giữ lịch sử và draft hiện tại.") },
    "/admin/site/menus/{location}": { get: adminOp("Admin xem menu nháp, công khai và lịch sử", ref("SiteMenuDetail"), [location]) },
    "/admin/site/menus/{location}/draft": { put: adminOp("Lưu menu nháp, không xuất bản", ref("SiteMenuRevision"), [location], "SiteMenuDraftRequest", { 409: stale[409] }, "Header/footer độc lập. editRevision=0 tạo draft đầu tiên; draft đang có cần đúng edit_revision.") },
    "/admin/site/menus/{location}/publish": { post: adminOp("Xuất bản menu đã kiểm tra liên kết", ref("SiteRevisionPointer"), [location], "SitePublishRequest", menuPublishErrors, "Cần ít nhất một liên kết hiển thị. Liên kết CMS nội bộ phải trỏ trang active đã xuất bản. /, /gallery, /calendar, /login và /register là đường dẫn tích hợp được phép.") },
    "/admin/site/menus/{location}/restore": { post: adminOp("Chọn lại phiên bản menu đã xuất bản", ref("SiteRevisionPointer"), [location], "SiteRestoreRequest", { 404: error("NOT_FOUND: phiên bản không thuộc location hoặc chưa xuất bản") }) },
    "/admin/site/media/cloudinary/signature": { post: adminOp("Cấp chữ ký Cloudinary cho admin tải ảnh", ref("SiteMediaSignature"), [], undefined, { 503: error("CLOUDINARY_NOT_CONFIGURED: chưa đủ cấu hình Cloudinary") }, "Upload trực tiếp theo uploadUrl bằng file, api_key, timestamp, signature và folder. API secret không trả về client.") },
    "/admin/site/media/cloudinary": { post: adminOp("Lưu metadata ảnh Cloudinary đã tải", ref("SiteMediaRecord"), [], "SiteMediaUploadRequest", { 422: error("VALIDATION_ERROR / CLOUDINARY_ASSET_INVALID / CLOUDINARY_FILE_TOO_LARGE: JPG, PNG, WebP, GIF, AVIF tối đa 10 MB, đúng cloud và folder"), 503: error("CLOUDINARY_NOT_CONFIGURED") }, "Nhận metadata sau upload; đây không phải endpoint nhận multipart file. secureUrl phải thuộc Cloudinary đã cấu hình và publicId bắt đầu bằng kinetic-sports/site/; ghi metadata theo storage_key để tránh trùng."),
    },
  });
}
