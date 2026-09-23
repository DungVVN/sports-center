INSERT INTO permissions (code, description)
VALUES ('membership.package.manage', 'Tạo và cập nhật gói tập cùng quyền sử dụng')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES ('manager', 'membership.package.manage')
ON CONFLICT DO NOTHING;
