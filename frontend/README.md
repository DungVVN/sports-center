# Sports Center Frontend

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
