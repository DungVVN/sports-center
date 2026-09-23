INSERT INTO permissions (code, description)
VALUES ('training.template.manage', 'Quản lý mẫu giáo án chung')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES ('manager', 'training.template.manage')
ON CONFLICT DO NOTHING;
