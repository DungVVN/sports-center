# Sports Center Frontend

Các ghi nhận hosting/CAPTCHA bên dưới cần được xác minh trên môi trường chạy hiện tại. Xem [runbook](../docs/OPERATIONS.md) cho deployment phối hợp với API pagination và checklist UAT.

React/Vite frontend cho cổng hội viên và quản trị. Ứng dụng hiện có các màn hình nghiệp vụ, API client, TanStack Query và kiểm thử Vitest/Playwright.

## Cấu trúc

- `src/app`: bootstrap, phiên đăng nhập, điều hướng, layout và phối hợp màn hình.
- `src/config`: cấu hình runtime và phân biệt cổng quản trị/hội viên.
- `src/features`: màn hình, API và state theo nghiệp vụ; các trang public thuộc `features/site`.
- `src/shared/api`: HTTP transport và xử lý lỗi dùng chung.
- `src/shared/ui`: các component và hook UI không gắn nghiệp vụ.
- `src/shared/lib`: hook điều phối mutation và hàm xử lý bảng dùng chung.

Xem [kế hoạch chuyển đổi](../ARCHITECTURE_MIGRATION.md) để biết cấu trúc đích, thứ tự và các điều kiện kiểm tra. `VITE_API_BASE_URL` chỉ tới Backend API của môi trường đang chạy.

## Commands

- `npm run dev`: chạy Vite ở cổng 5173.
- `npm run test`: chạy test frontend.
- `npm run lint`: kiểm tra quy chuẩn JavaScript/JSX.
- `npm run build`: build production.
- `npm run check`: lint, test và build liên tiếp.

## Quản trị nội dung website

Admin dùng `Trang website` và `Menu website` trên cổng quản trị hiện có. Mỗi trang/menu có bản nháp riêng: `Lưu nháp` không thay đổi nội dung công khai; admin xem trước, sau đó chủ động bấm `Xuất bản`. Có thể chọn lại một phiên bản đã xuất bản trong lịch sử. Trang chủ hiện tại và các luồng nghiệp vụ vẫn giữ nguyên khi chưa bật CMS công khai.

`VITE_SITE_CMS_PUBLIC_ENABLED=false` là mặc định. Chỉ bật `true` sau khi API/backend đã triển khai cùng migration, kiểm thử trình duyệt và nội dung đầu tiên đã xuất bản. Nếu trang chủ hoặc menu chưa được xuất bản, giao diện công khai dùng nội dung/đường dẫn dự phòng. Trình biên tập ảnh nhận URL nội bộ/HTTPS hoặc tải trực tiếp lên Cloudinary; cấu hình ba biến `CLOUDINARY_*` ở backend trước khi dùng nút tải ảnh.

Bốn trang công khai `/ve-chung-toi`, `/dich-vu`, `/bang-gia`, `/lien-he` tải bản đã xuất bản từ CMS ngay cả khi cờ triển khai CMS toàn website còn tắt. Tạo và sửa nội dung trong `Trang website`, lưu nháp rồi xuất bản. Menu dự phòng dẫn đến bốn đường dẫn này. Trang `/bang-gia` tự hiển thị thêm bảng giá lấy từ API gói hội viên; giá và quyền lợi vẫn sửa ở mục nghiệp vụ gói tập. Metadata SEO và canonical lấy theo từng trang; `public/sitemap.xml` liệt kê bốn đường dẫn công khai.

## Triển khai frontend trên Cloudflare Pages

`functions/_middleware.js` phục vụ HTML công khai có nội dung CMS đã xuất bản, H1, metadata, canonical, Open Graph và JSON-LD trước khi chạy JavaScript. `/bang-gia` dùng giá hiện tại từ API công khai. `VITE_API_BASE_URL` và `VITE_SITE_CMS_PUBLIC_ENABLED` cần có cả trong build variables và runtime bindings của Pages Functions. Trang không tồn tại trả HTTP 404; lỗi API trả 503/noindex; cổng admin, trang tài khoản và URL preview không được lập chỉ mục. `www` và đường dẫn có dấu `/` cuối chuyển hướng 308 về URL chuẩn. Backend Express/Prisma vẫn chạy trên Render.

Giai đoạn chuyển frontend chỉ thay nơi phục vụ React/Vite. Backend tiếp tục chạy trên Render và dữ liệu tiếp tục ở Neon; **không** đưa API Express/Prisma lên Workers trong giai đoạn này. Một bản build frontend phục vụ cả website chính và cổng admin; ứng dụng phân biệt cổng bằng hostname `admin.kineticsports.io.vn`.

Trong Cloudflare Pages, kết nối repository này và đặt root directory `frontend`, production branch `main`, build command `npm run build`, output directory `dist`. Đặt build variables cho production:

- `VITE_API_BASE_URL=https://api.kineticsports.io.vn/api/v1`
- `VITE_ADMIN_PORTAL=false` (admin được phát hiện qua hostname)
- `VITE_SITE_CMS_PUBLIC_ENABLED=false` cho đến khi nghiệm thu CMS với backend thật
- `NODE_VERSION=22` để Cloudflare build bằng cùng major Node đã kiểm thử
- `VITE_RECAPTCHA_SITE_KEY` bằng site key hiện đang dùng trên Vercel, nếu CAPTCHA được bật

Backend production hiện bật CAPTCHA. Build Pages đã có site key công khai, nhưng Google reCAPTCHA cần cho phép hostname `sports-center-frontend.pages.dev` trong phần Domains của chính key đó; nếu chưa, trang `/login` hiện `Invalid domain for site key` và không thể nghiệm thu đăng nhập. Không tắt CAPTCHA ở backend để vượt bước này.

Cloudflare Pages tự fallback về `index.html` cho các route SPA khi không có `404.html` ở thư mục build; không chuyển `vercel.json` thành `_redirects`. Dự án thử nghiệm đã tạo ở `https://sports-center-frontend.pages.dev` từ GitHub `main`. Trước khi kiểm thử API trên URL này, thêm chính xác `https://sports-center-frontend.pages.dev` vào danh sách `CORS_ORIGIN` trên Render (giữ nguyên các origin cũ, phân tách bằng dấu phẩy); không dùng wildcard. Gắn `kineticsports.io.vn`, `www.kineticsports.io.vn` và `admin.kineticsports.io.vn` vào cùng Pages project **sau** khi deployment `*.pages.dev` qua smoke test. Trước khi đổi DNS, xác nhận backend `CORS_ORIGIN` cho đúng các origin mới. Khi test đăng nhập trên `*.pages.dev`, cookie qua `api.kineticsports.io.vn` có thể bị trình duyệt xem là bên thứ ba; kiểm tra đăng nhập lần cuối trên domain thật sau cutover và giữ Vercel làm đường rollback cho đến khi ổn định. Không đổi `api.kineticsports.io.vn` trong giai đoạn frontend.

Kiểm thử tối thiểu trước cutover: mở trực tiếp `/`, `/gallery`, `/calendar`, `/login`, `/admin/site/pages` trên hostname admin; xác nhận asset không 404, đăng nhập admin/hội viên, gọi API, đăng xuất, responsive và các luồng đặt lịch/giá gói. `vercel.json` được giữ tạm để rollback, không phải cấu hình của Cloudflare Pages.
