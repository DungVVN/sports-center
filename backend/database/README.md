# Cơ sở dữ liệu Sports Center

Ứng dụng dùng Neon PostgreSQL. Thư mục này chứa Prisma schema, migration và hướng dẫn; không có script SQL độc lập để khởi tạo hoặc nâng cấp database. Nguồn chuẩn của cấu trúc dữ liệu là [`prisma/schema.prisma`](prisma/schema.prisma) cùng các migration theo thứ tự trong [`prisma/migrations/`](prisma/migrations/). Prisma ghi nhận migration đã chạy trong bảng `_prisma_migrations`.

File `database/schema.sql` cũ đã được bỏ vì là snapshot trước các thay đổi về Admin, phân quyền cấu hình, onboarding và PayOS. Không chạy lại snapshot đó trên Neon hoặc trên database mới: nó không tạo ledger migration và có thể khiến schema lệch với ứng dụng.

Migration đầu tiên vẫn giữ nguyên lời chú thích lịch sử nhắc tới `database/schema.sql`; migration đó đã được áp dụng nên không chỉnh sửa lại. Khi dựng DB mới, chỉ chạy qua Prisma để các migration sau nâng schema lên trạng thái hiện tại.

## Cấu hình

- `DATABASE_URL`: kết nối runtime của backend.
- `MIGRATE_DATABASE_URL`: kết nối có quyền DDL dùng cho migration; nếu thiếu, Prisma dùng `DATABASE_URL` theo `../prisma.config.js`. Với Neon, dùng endpoint **direct** cho biến này (không chứa `-pooler`) để Prisma giữ được advisory lock trong suốt migration.
- Hai URL phải trỏ đến cùng database và schema dự định nâng cấp. Giữ giá trị thật trong `.env` cục bộ hoặc biến môi trường bảo mật của Render; không commit URL hay mật khẩu.
- Không dùng Docker cho database production; Neon là nguồn dữ liệu production.

## Dựng database mới

1. Tạo một Neon PostgreSQL database rỗng và cấu hình hai biến môi trường nêu trên.
2. Từ thư mục `backend/`, chạy `npm ci` và `npm run db:validate`.
3. Kiểm tra đúng host/database/schema đích, sau đó chạy `npm run db:migrate` để áp dụng toàn bộ migration theo thứ tự.
4. Chạy `npm run db:generate` để tạo Prisma Client và `npx prisma migrate status` để xác nhận không còn migration chờ áp dụng.

`npm run db:migrate` **thay đổi DB**. Script giữ advisory lock của Prisma và tự thử lại tối đa năm lần khi lock tạm thời bận (`P1002`); các lỗi migration khác vẫn dừng ngay. Với Neon đang có dữ liệu, chỉ chạy trong quy trình deploy đã được phê duyệt; không dùng `prisma migrate reset`, `db push` hoặc SQL snapshot để đồng bộ thủ công. Khi thay đổi schema, thêm migration mới, không sửa migration đã áp dụng.

## Phạm vi hiện tại

Schema/migration hiện bao gồm tài khoản và xác thực, Admin cùng bốn role nghiệp vụ, bảng quyền và quyền cấu hình theo role, hồ sơ nhân viên/hội viên, gói hội viên và quyền sử dụng, lớp và booking, khóa học/PT, sân/phòng, điểm danh, thanh toán/hoàn tiền dịch vụ/PayOS, giáo án và cá nhân hóa, thông báo, hỗ trợ, CMS và audit. Quy tắc phân quyền theo người dùng/phạm vi dữ liệu vẫn được backend kiểm tra, không suy ra chỉ từ bảng quyền hoặc giao diện. Xem [runbook](../../docs/OPERATIONS.md) cho quy trình backup/restore và nghiệm thu database.

## Nền tảng quản trị nội dung website công khai

Migration `20260930010000_public_site_content_foundation` bổ sung riêng sáu bảng, chưa đổi dữ liệu hoặc luồng nghiệp vụ hiện có:

- `site_pages`: danh mục route công khai (`home`, `static`), không chứa lịch hay giá gói tập.
- `site_page_revisions`: bản nháp/bản xuất bản của tiêu đề, SEO và danh sách block JSON; `site_page_publications` trỏ tới đúng bản đang hiển thị.
- `site_menu_revisions`: cây menu header/footer theo từng phiên bản; `site_menu_publications` trỏ tới bản đang hiển thị. Đây **không phải** menu sidebar của nhân viên/admin (sidebar vẫn sinh từ quyền hiện có).
- `site_media_assets`: metadata ảnh Cloudinary; ảnh được tải trực tiếp bằng chữ ký ngắn hạn chỉ cấp cho admin, với MIME, dung lượng và thư mục delivery được API kiểm tra.

Các bản đã xuất bản bất biến ở mức DB; con trỏ công khai không thể trỏ tới bản nháp. Chỉ cho một bản nháp trên mỗi trang/vị trí menu. `audit_logs` sẵn có sẽ ghi thao tác quản trị khi triển khai API, không tạo bảng audit thứ hai. Backend phải kiểm tra schema từng block/menu item, route hợp lệ, quyền admin và cập nhật phiên bản/pointer trong transaction. Không đưa giá gói tập, lịch trống hay trạng thái đặt chỗ vào JSON nội dung; các block động chỉ giữ khóa binding tới API nghiệp vụ.

Migration này không seed trang/menu. API quản trị và giao diện biên tập có trong mã nguồn hiện tại, nhưng áp dụng migration một mình không thay đổi website công khai: frontend giữ `VITE_SITE_CMS_PUBLIC_ENABLED=false` theo mặc định. Khi triển khai, giữ fallback hiện tại cho tới khi backend mới và nội dung đã xuất bản được kiểm tra trên trình duyệt. Chỉ chạy migration lên đúng DB sau khi xác nhận đích; với Neon đang có dữ liệu cần quy trình deploy/backup như phần trên.

Swagger/OpenAPI tại `../src/openapi/spec.js` là nguồn chuẩn của HTTP contract, không phải nguồn chuẩn của cấu trúc DB.
