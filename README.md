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
