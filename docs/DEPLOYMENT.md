# CI/CD và triển khai

## CI trên GitHub

Workflow `.github/workflows/ci.yml` chạy khi tạo Pull Request vào `main` và khi push lên `main`.
Nó chạy `test`, `lint`, `build` cho Backend và Frontend, đồng thời kiểm tra Prisma schema. CI không kết nối Neon và không cần secrets thật.

Trong GitHub, bật branch protection cho `main` và yêu cầu hai checks `Backend quality gates` và `Frontend quality gates` trước khi merge.

## Backend trên Render

1. Trong Render chọn **New + → Blueprint**, kết nối repository `DungVVN/sports-center` và chọn `render.yaml`.
2. Khai báo giá trị thật cho `DATABASE_URL`, `MIGRATE_DATABASE_URL` và `CORS_ORIGIN` trong Render Environment.
3. Khi có domain Vercel, đặt `CORS_ORIGIN` bằng **đúng origin HTTPS** đó, ví dụ `https://sports-center.vercel.app` (không có dấu `/` cuối). Nếu cần cho phép nhiều frontend, ngăn cách các origin bằng dấu phẩy.
4. Render tự deploy sau mỗi commit mới trên `main`; trước khi start, nó chạy `npm run db:migrate`.

API dùng cookie phiên `HttpOnly; Secure; SameSite=None` ở production để trình duyệt gửi cookie từ frontend Vercel sang API Render. Không dùng HTTP cho các URL production.

## Frontend trên Vercel

1. Import repository vào Vercel, đặt **Root Directory** là `frontend`.
2. Khai báo `VITE_API_BASE_URL=https://<render-domain>/api/v1` trong Production Environment Variables.
3. Bật deploy từ nhánh `main`. Vercel tạo preview cho Pull Request và production deployment cho `main`.

Không commit `.env`, Neon URL, API tokens hoặc credentials cổng thanh toán. `VERIFICATION_DELIVERY_MODE` giữ `development` cho tới khi chọn nhà cung cấp email/SMS.
