-- Repair the manager training permissions for databases created before
-- training.template.manage was added to the reference permission set.
INSERT INTO permissions (code, description)
VALUES
  ('training.write', 'Tạo kế hoạch và kết quả tập luyện'),
  ('training.template.manage', 'Quản lý mẫu giáo án chung')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('manager', 'training.write'),
  ('manager', 'training.template.manage')
ON CONFLICT DO NOTHING;
