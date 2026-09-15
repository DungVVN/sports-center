INSERT INTO permissions (code, description)
VALUES
  ('membership.assign', 'Tạo hoặc hủy yêu cầu gói tập chờ thanh toán cho hội viên'),
  ('membership.freeze.request', 'Gửi yêu cầu đóng băng gói tập của chính mình')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('receptionist', 'membership.assign'),
  ('member', 'membership.freeze.request')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_code = 'manager'
  AND permission_code IN ('membership.freeze.review', 'payment.record');
