INSERT INTO "permissions" ("code", "description") VALUES
  ('membership.package.read', 'Xem danh mục gói tập'),
  ('membership.self.read', 'Xem gói tập của bản thân'),
  ('attendance.self.read', 'Xem điểm danh của bản thân'),
  ('payment.self.read', 'Xem thanh toán và biên lai của bản thân'),
  ('training.self.read', 'Xem giáo án và kết quả của bản thân'),
  ('support.ticket.read', 'Xem yêu cầu hỗ trợ trong phạm vi tài khoản'),
  ('support.ticket.create', 'Tạo yêu cầu hỗ trợ'),
  ('support.ticket.respond', 'Tiếp nhận và phản hồi yêu cầu hỗ trợ'),
  ('notification.preference.manage', 'Xem và đổi tùy chọn nhận thông báo'),
  ('ai.assist.read', 'Xem gợi ý hỗ trợ AI'),
  ('ai.assist.deliver', 'Duyệt và gửi hướng dẫn AI'),
  ('class.change.request', 'Đề xuất hủy hoặc đổi lịch lớp')
ON CONFLICT ("code") DO NOTHING;

-- Preserve capabilities that were previously granted implicitly by role checks.
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('manager', 'membership.package.read'),
  ('receptionist', 'membership.package.read'),
  ('member', 'membership.package.read'),
  ('member', 'membership.self.read'),
  ('member', 'attendance.self.read'),
  ('member', 'payment.self.read'),
  ('member', 'training.self.read'),
  ('member', 'support.ticket.read'),
  ('member', 'support.ticket.create'),
  ('member', 'notification.preference.manage'),
  ('manager', 'support.ticket.read'),
  ('manager', 'support.ticket.respond'),
  ('receptionist', 'support.ticket.read'),
  ('receptionist', 'support.ticket.respond'),
  ('coach', 'ai.assist.read'),
  ('coach', 'ai.assist.deliver'),
  ('coach', 'class.change.request')
ON CONFLICT DO NOTHING;
