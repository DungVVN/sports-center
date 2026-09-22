INSERT INTO "roles" ("code", "label") VALUES ('admin', 'Quản trị hệ thống')
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label";

INSERT INTO "permissions" ("code", "description") VALUES
  ('staff.operational.read', 'Xem hồ sơ vận hành nhân sự'),
  ('staff.operational.assign', 'Phân công vận hành nhân sự')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

-- Admin is the system authority. It is intentionally provisioned only by a
-- controlled bootstrap procedure, not from the staff-management API.
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'admin'::"user_role", "code" FROM "permissions"
ON CONFLICT DO NOTHING;

-- Manager retains operational centre duties but cannot manage identity,
-- privilege, or audit security records.
DELETE FROM "role_permissions"
WHERE "role_code" = 'manager'::"user_role"
  AND "permission_code" IN ('staff.manage', 'audit.read');

INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('manager'::"user_role", 'staff.operational.read'),
  ('manager'::"user_role", 'staff.operational.assign')
ON CONFLICT DO NOTHING;
