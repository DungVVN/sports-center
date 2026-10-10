# Sports Center

Hệ thống quản lý trung tâm thể thao: React/Vite frontend, Express/Prisma backend và PostgreSQL. Source sản phẩm ở `frontend/` và `backend/`; `project/` chỉ là tham chiếu thiết kế.

## Phát triển và kiểm tra

Yêu cầu Node.js 22 và PostgreSQL 18 cho integration tests. Chạy `npm ci` trong từng thư mục backend/frontend, sao chép `.env.example` tương ứng và cấu hình database local riêng. Không đưa credential vào Git.

- `npm run check`: architecture gate, backend/frontend lint, unit/contract tests và build.
- `npm --prefix backend run db:validate`: xác minh schema Prisma.
- `npm --prefix backend run db:migrate`: áp dụng migration vào database đã cấu hình; phải xác nhận đúng môi trường trước khi chạy.
- `npm --prefix frontend run test:e2e`: browser tests, yêu cầu `E2E_BASE_URL`.

Test unit không thay thế integration database, UAT, xác minh provider hay deployment. Các database tests bỏ qua khi thiếu URL kiểm thử; CI có PostgreSQL riêng. Browser smoke CI dùng dữ liệu giả lập, không phải nghiệm thu production.

## Hợp đồng và vận hành

Swagger: `/api-docs`; OpenAPI: `/openapi.json`. Danh sách hội viên và phiếu thu trả `data` là array của một trang, kèm `meta.total`, `meta.page`, `meta.pageSize`, `meta.facets`. Mặc định 10, tối đa 100 bản ghi mỗi request. Search/filter/sort được thực hiện ở server.

Liveness: `/api/v1/health`. Readiness database: `/api/v1/ready` (503 nếu database không sẵn sàng hoặc quá 5 giây).

Xem [runbook và checklist UAT](docs/OPERATIONS.md), [backend](backend/README.md) và [frontend](frontend/README.md).

## Cấu trúc và ranh giới source

- `backend/src/app/`: lắp ghép service và đăng ký route. `backend/src/modules/<nghiệp-vụ>/index.js` là cửa vào của mỗi module; presentation xử lý HTTP, application điều phối nghiệp vụ, domain giữ chính sách và infrastructure truy cập database/provider.
- `backend/src/shared/`: các cơ chế dùng chung. `backend/src/openapi/spec.js` ghép hợp đồng từ các file path/schema/contract; schema và migration database ở `backend/database/prisma/`.
- `frontend/src/app/`: lắp ghép trang và layout. `frontend/src/features/<nghiệp-vụ>/`: UI, API/hook và domain của feature, công bố qua `index.js`. `frontend/src/shared/`: UI, API client và tiện ích dùng chung.
- Không import sâu vào module/feature khác. Frontend shared không phụ thuộc feature/app; feature không phụ thuộc app. Backend application và presentation không truy cập persistence trực tiếp; domain không phụ thuộc UI/HTTP hoặc tầng điều phối/persistence.

`npm run check:architecture` kiểm tra toàn bộ JavaScript/JSX trong hai thư mục `src`, import tĩnh, re-export và dynamic import có đường dẫn literal, bao gồm alias `@/` của frontend và đường dẫn không có extension. Gate phát hiện phụ thuộc vòng giữa các file source; test không tham gia đồ thị vòng. Import được tính ở runtime từ biến không thể xác định bằng kiểm tra tĩnh.

Gate dùng parser của dependency ESLint đã khai báo ở backend; cần cài dependency backend trước khi chạy. Các test của bộ phân tích chạy trước gate trong local và CI. Gate này không xác minh quyền sở hữu từng bảng database hoặc trạng thái triển khai.
