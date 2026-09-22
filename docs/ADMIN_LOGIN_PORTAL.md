# Cổng đăng nhập Admin riêng

`admin.kineticsports.io.vn` là cổng duy nhất cho role `admin`. Giao diện tại hostname này chỉ có đăng nhập quản trị và không có đăng ký hội viên.

- `POST /api/v1/auth/admin/login` chỉ chấp nhận role `admin`.
- `POST /api/v1/auth/login` từ chối role `admin`; các role Manager, Lễ tân, Coach và Hội viên dùng cổng chính.
- Challenge TOTP ghi nhận `login_surface`; challenge Admin chỉ hoàn tất được qua `POST /api/v1/auth/admin/mfa/totp/verify`.
- CAPTCHA vẫn được API xác minh khi `CAPTCHA_ENABLED=true`. TOTP là lựa chọn của người dùng; sau khi đã bật, đăng nhập buộc phải xác thực mã Authenticator.

Triển khai DNS: thêm custom domain `admin.kineticsports.io.vn` vào cùng dự án Vercel với web chính, rồi tạo bản ghi DNS mà Vercel yêu cầu. Hostname được frontend nhận diện trực tiếp, không cần biến môi trường production.
