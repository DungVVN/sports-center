# Sports Center Frontend

Khung frontend độc lập dùng React + JSX. Chưa có UI, route, API client hoặc màn hình nghiệp vụ.

## Cấu trúc dự kiến

- `src/app`: bootstrap ứng dụng và router.
- `src/api`: HTTP client và API contracts.
- `src/features`: module theo nghiệp vụ MVP.
- `src/pages`: màn hình theo route.
- `src/components`: component dùng chung.
- `src/types`: hằng số và hợp đồng dữ liệu dùng chung (dùng JSDoc khi cần).

`VITE_API_BASE_URL` được khai báo trong `.env`; khi Backend API được tạo, FE sẽ gọi theo URL này.

## Commands

- `npm run dev`: chạy Vite ở cổng 5173.
- `npm run test`: chạy test frontend.
- `npm run lint`: kiểm tra quy chuẩn JavaScript/JSX.
- `npm run build`: build production.
