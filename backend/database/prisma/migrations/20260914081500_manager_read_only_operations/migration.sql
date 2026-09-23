INSERT INTO permissions (code, description)
VALUES
  ('booking.read', 'Xem danh sách đặt chỗ'),
  ('attendance.read', 'Xem danh sách điểm danh'),
  ('payment.read', 'Xem danh sách phiếu thu')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('manager', 'booking.read'),
  ('manager', 'attendance.read'),
  ('manager', 'payment.read'),
  ('receptionist', 'booking.read'),
  ('receptionist', 'attendance.read'),
  ('receptionist', 'payment.read'),
  ('coach', 'booking.read'),
  ('coach', 'attendance.read'),
  ('member', 'booking.read')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_code = 'manager'
  AND permission_code IN (
    'member.write',
    'booking.write',
    'attendance.write',
    'class.change.review',
    'registration.approve',
    'training.write'
  );
