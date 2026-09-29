INSERT INTO "permissions" ("code", "description")
VALUES ('member.credentials.reset', 'Cấp lại mật khẩu tạm cho hội viên')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT "role_code", 'member.credentials.reset'
FROM "role_permissions"
WHERE "permission_code" = 'member.write'
  AND "role_code" IN ('manager', 'receptionist', 'coach')
ON CONFLICT DO NOTHING;
