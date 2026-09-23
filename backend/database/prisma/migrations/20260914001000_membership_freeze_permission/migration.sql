INSERT INTO permissions (code, description)
VALUES ('membership.freeze.review', 'Duyệt yêu cầu đóng băng gói tập')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_code, permission_code)
VALUES ('receptionist', 'membership.freeze.review'), ('manager', 'membership.freeze.review')
ON CONFLICT DO NOTHING;
