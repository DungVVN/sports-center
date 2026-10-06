# Runbook vận hành và nghiệm thu

## Cấu hình production

1. Giữ `NODE_ENV=production`. Cung cấp secret riêng cho `AUTH_JWT_SECRET`, `VERIFICATION_CODE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`. Khi cập nhật deployment đang dùng, giữ key/session secret hiện tại; đổi key MFA tùy tiện sẽ không đọc được secret TOTP đã mã hóa.
2. `VERIFICATION_DELIVERY_MODE=provider`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` với sender đã xác minh. Production từ chối mode development. OTP không được ghi vào log.
3. Cấu hình đúng `DATABASE_URL`, migration-owner URL riêng và origin CORS cụ thể. Không dùng wildcard. Cấu hình CAPTCHA/PayOS/Cloudinary trước khi nghiệm thu những chức năng tương ứng.
4. `render.yaml` là blueprint; giá trị `sync: false` phải được cung cấp từ môi trường triển khai, không đưa secret vào file.

## Deploy và rollback

- Chạy `npm run check`, schema validation, CI PostgreSQL và browser smoke; xem rõ test skip/failure.
- Áp dụng migration đã review trước khi deploy code cần schema mới; không sửa migration đã áp dụng. Những thay đổi pagination/audit/readiness này không thêm migration.
- API list thay đổi từ toàn bộ danh sách sang một trang: phối hợp backend/frontend và các consumer ngoài repository. `data` vẫn là array nhưng phải đọc `meta` và gửi `page/pageSize`. Không kết luận đủ dữ liệu chỉ từ trang đầu.
- Kiểm tra `/health`, `/ready`, `/openapi.json`, cookie, CORS và luồng theo vai trò sau deploy.
- Nếu chuyển Render sang Worker, xác minh một scheduler duy nhất. Worker staging mặc định `JOBS_ENABLED=false`; chỉ bật production cron sau khi shutdown scheduler cũ và kiểm tra đầy đủ. Đặt cron phù hợp `JOB_INTERVAL_MINUTES`; service lifecycle cần cadence riêng phù hợp hạn giữ chỗ. Không bật jobs tự động trong source change này.
- Giữ deployment trước để rollback; không rollback schema bằng cách xóa dữ liệu. Đối chiếu độ tương thích giữa API/frontend trước khi rollback một phía.

## Thanh toán và audit

Tạo phiếu thu, payment event và audit cùng transaction; xác nhận/PayOS callback cũng ghi trạng thái, cấp quyền dịch vụ, payment event và audit cùng transaction. Audit lỗi phải rollback thay đổi, không để response lỗi sau khi payment đã commit. Update có điều kiện pending ngăn xác nhận lặp.

Đối soát các payment có `fulfillment_error`; không tự cấp quyền/hoàn tiền chỉ vì provider báo thành công. Khi request timeout, đọc receipt/status trước khi tạo thao tác mới. Giao dịch với provider ngoài database vẫn cần đối soát khi có sự cố mạng.

## Monitoring

- Probe `/health` cho tiến trình, `/ready` cho API và database; theo dõi HTTP 5xx/503, độ trễ, request ID và tình trạng provider.
- Cảnh báo scheduler không chạy, lỗi gửi email và payment cần đối soát. Ngưỡng độ trễ/tỷ lệ lỗi phải được thống nhất từ tải thực tế; source chưa cấu hình dịch vụ cảnh báo ngoài hệ thống.
- Không log OTP, password, bearer token, connection string hoặc nội dung cá nhân. Giới hạn người xem log và retention.
- Bộ xử lý lỗi HTTP chỉ ghi `event`, `statusCode`, `code`, `requestId`; không ghi nguyên error/stack hoặc payload của provider. Dùng request ID để đối chiếu sự cố, tránh thêm lại dữ liệu nhạy cảm vào log khi debug.
- API đăng nhập và API yêu cầu xác thực trả `Cache-Control: no-store`. Sau deploy, xác minh proxy/CDN giữ header này, đặc biệt với hồ sơ, thanh toán và MFA.
- JSON sai trả 400; body vượt 1 MB trả 413; encoding/charset không hỗ trợ trả 415. Những lỗi này có request ID và không được tính là sự cố 5xx của server.
- Xác thực TOTP và xác nhận đăng ký Authenticator giới hạn theo tài khoản bằng `AUTH_LOGIN_MAX_ATTEMPTS` / `AUTH_LOGIN_WINDOW_MINUTES`; mỗi lần thử được giữ chỗ trước khi kiểm tra mã. Worker dùng transaction của Durable Object dùng chung, Node đơn tiến trình dùng bộ nhớ. Không coi limiter bộ nhớ là giới hạn dùng chung khi triển khai nhiều tiến trình Node.
- JWT phiên chỉ chấp nhận HS256 và bắt buộc có `sub`, `sid`, `exp`, `iat`. Challenge MFA hết hạn hoặc sai cổng không được tạo phiên; kiểm tra lại hạn dùng khi consume trong database.
- API đăng ký chờ duyệt chỉ trả thông tin phục vụ màn hình duyệt; không trả password hash hay nguyên bản ghi tài khoản.
- Mỗi request xác thực vẫn đọc trạng thái phiên, tài khoản và quyền hiện tại. `last_seen_at` chỉ được cập nhật nếu đã cũ ít nhất 5 phút để giảm write vào database; timestamp này là chỉ báo hoạt động gần đây, không phải dấu vết từng request.
- Đổi mật khẩu, thu hồi các phiên khác và ghi audit nằm trong cùng transaction. Hai yêu cầu dùng cùng password hash cũ chỉ được một yêu cầu thành công; lỗi revoke/audit phải rollback. Phiên đang đổi mật khẩu được giữ lại.
- Mật khẩu mới không được vượt 72 byte UTF-8 của bcrypt; không cắt ngầm ký tự có dấu/emoji. Hash cũ vẫn được xác minh theo cách cũ để tránh khóa tài khoản; chưa áp dụng chuyển thuật toán hoặc buộc đổi mật khẩu cho dữ liệu legacy.
- Chạy `npm run check:security` với kết nối registry để kiểm tra advisory hiện tại. Kết quả từ cache/offline không đủ để kết luận dependency đang sạch. CI backend/frontend chặn advisory mức high/critical, gồm dependency phát triển.
- Prisma 7.10 dùng override riêng: `@prisma/config` -> `deepmerge-ts@8.0.0`, Prisma -> `mysql2@3.23.1`. Đây là bản vá dependency bắc cầu, không phải nâng major Prisma. Khi cập nhật Prisma, review lại override và chạy schema validation/generate cùng hồi quy database; không dùng audit fix --force để tự hạ major.
- Trên Windows, backend/frontend Vitest dùng 4 worker threads để tránh lỗi thoát native của fork worker đã gặp khi chạy full suite và giảm tải đồng thời của jsdom. CI Linux giữ runner mặc định.
- Scheduler Node bỏ qua tick nếu cùng job vẫn đang chạy; tick sau sẽ thử lại khi job kết thúc, kể cả sau lỗi. Log lỗi job chỉ gồm event và tên job cố định. Cơ chế này chỉ chống chạy chồng trong một tiến trình, không thay thế khóa phân tán hoặc yêu cầu một scheduler duy nhất khi triển khai nhiều instance.
- OTP email giữ chỗ mỗi lần thử bằng update có điều kiện trong database, tối đa 5 lần kể cả request đồng thời. Xác nhận đăng ký consume mã, chuyển trạng thái `pending_verification` -> `pending_approval` và ghi audit trong cùng transaction; không ghi đè trạng thái tài khoản đã active/suspended.
- Đổi/cấp lại mật khẩu làm hết hạn challenge TOTP và OTP đăng nhập nhân viên, gồm cả mã đã consume nhưng chưa tạo phiên. Việc tạo phiên khóa bản ghi user và kiểm tra lại credential/challenge/trạng thái/cổng, nên phải tuần tự với transaction reset mật khẩu. Kích hoạt MFA cũng khóa user, thu hồi phiên/challenge và ghi audit trong cùng transaction.
- Tạo challenge MFA kiểm tra lại password hash và factor hiện tại trong transaction khóa user; yêu cầu đăng nhập đã kiểm tra mật khẩu cũ không được tạo challenge sau reset. Tạo phiên bằng mật khẩu/OTP email bị từ chối nếu tài khoản đã bật MFA. Reset mật khẩu cũng hết hạn enrollment MFA chưa hoàn tất.

## Backup và phục hồi

Chạy `npm --prefix backend run backup:restore-verify` chỉ khi `BACKUP_RESTORE_VERIFY_DATABASE_URL` là database QA riêng và `BACKUP_RESTORE_CONFIRM=restore-verify`. Script dùng `pg_dump/pg_restore`; phải có binary tương thích server PostgreSQL.

Script export snapshot nhất quán, dump cùng snapshot, restore vào target và so số dòng cùng hai fingerprint tổng hợp của mỗi bảng business. Record không chứa nội dung cá nhân; vẫn giữ local/protected. Target tuyệt đối không được là nguồn hoặc database đang phục vụ người dùng. Xác nhận định danh database qua credential/host cấu hình thực tế trước khi chạy.

Record chứng minh dữ liệu snapshot khớp; chưa thay thế kiểm thử luồng sau restore. Thống nhất RPO/RTO, lịch backup và nơi lưu có bảo vệ; thử phục hồi định kỳ trên target cô lập. Giữ target không có writer trong quá trình verify.

## Checklist UAT bắt buộc trước nghiệm thu

Mỗi case ghi môi trường, commit, vai trò, bước thực hiện, kết quả mong đợi/thực tế và bằng chứng. Chưa thực hiện là Pending; loại trừ được thống nhất là N/A.

- [ ] Admin/Manager/Receptionist/Coach/Member: đăng nhập, hết phiên, logout, OTP/MFA, đổi mật khẩu tạm; kiểm tra deny theo role/ownership.
- [ ] Đăng ký, xác minh, duyệt, hồ sơ và phân công coach.
- [ ] Gói tập, thanh toán kích hoạt, freeze, grace/expiry và job thông báo.
- [ ] Lớp/booking/waitlist: slot cuối đồng thời, hủy và promote, trùng lịch, điều kiện gói tại giờ học.
- [ ] Điểm danh/điều chỉnh đúng coach và session window.
- [ ] Khóa học/PT/sân: giữ chỗ, trả phí, cấp quyền, hủy, hết hạn, hoàn tiền và đối soát theo chính sách.
- [ ] Payment: audit lỗi rollback; xác nhận/callback lặp không tạo thêm event/audit; số tiền khớp dịch vụ. Provider sandbox/live được ghi riêng.
- [ ] Danh sách trên 100 bản ghi: đổi trang, tìm bản ghi ngoài trang đầu, multi-filter, sort và giữ thao tác sửa/thu tiền.
- [ ] CMS: draft không lộ public; publish/restore/revision conflict; media provider thật.
- [ ] Mobile/tablet/desktop trên trình duyệt thật: navigation, bảng/form, lỗi mạng và accessibility cơ bản.
- [ ] Migration trên QA, backup/restore, tải/race, monitoring và scheduler cutover.

## Giới hạn của CI

CI architecture/lint/unit/build kiểm tra source; browser smoke dùng API giả lập kiểm tra UI/navigation/pagination. PostgreSQL job riêng xác minh payment/audit rollback và race, booking capacity, pagination/ownership và các ràng buộc dữ liệu được test. Không tuyên bố những job này xác minh email/CAPTCHA/PayOS/Cloudinary production.

Các form chọn hội viên hiện vẫn lấy đủ lựa chọn qua nhiều trang giới hạn 100; bảng chính chỉ tải một trang. Với dữ liệu rất lớn, bước tiếp theo là combobox tìm kiếm từ server để giảm tổng payload của form.

Lượt tải lựa chọn được giới hạn theo tổng số trang của phản hồi đầu tiên, loại ID trùng khi dữ liệu thay đổi giữa các trang, dừng khi trang trống và từ chối metadata không hợp lệ. Query tải danh sách hội viên truyền signal hủy từ React Query xuống API. Đây không phải snapshot database của toàn bộ lượt đọc; dữ liệu thêm mới trong lúc tải cần refetch để thấy đầy đủ.
