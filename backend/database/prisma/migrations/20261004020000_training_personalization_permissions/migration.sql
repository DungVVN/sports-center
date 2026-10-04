BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE training_plans ADD CONSTRAINT training_plans_status_extended_check CHECK (status IN ('draft','active','completed','paused')) NOT VALID;
ALTER TABLE training_plans VALIDATE CONSTRAINT training_plans_status_extended_check;
ALTER TABLE training_plans DROP CONSTRAINT training_plans_status_check;
ALTER TABLE training_plans RENAME CONSTRAINT training_plans_status_extended_check TO training_plans_status_check;
INSERT INTO permissions(code,description) VALUES
('training.assessment.read','Xem hồ sơ đánh giá tập luyện trong phạm vi chuyên môn'),
('training.assessment.write','Lập đánh giá và duyệt giáo án theo xác minh chuyên môn'),
('training.protocol.manage','Soạn và duyệt quy tắc có bằng chứng khoa học'),
('training.review.authorize','Xác minh chứng chỉ và phạm vi của người duyệt chuyên môn'),
('training.self.manage','Quản lý đồng ý, check-in và nhật ký tập luyện của bản thân')
ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_code,permission_code) VALUES
('coach','training.assessment.read'),('coach','training.assessment.write'),('coach','training.protocol.manage'),
('member','training.self.manage')
ON CONFLICT DO NOTHING;
UPDATE roles SET permission_version=permission_version+1 WHERE code IN ('coach','member');
-- Sports Center records member calendar days in Vietnam; DB sessions otherwise use UTC.
DO $$
DECLARE definition TEXT; routine RECORD;
BEGIN
  FOR routine IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'training\_%' ESCAPE '\' LOOP
    SELECT pg_get_functiondef(routine.oid) INTO definition;
    -- CURRENT_TIMESTAMP is fixed at transaction start and can reject a valid
    -- approval recorded later in that same transaction. Validate per statement.
    definition := replace(definition, 'CURRENT_TIMESTAMP', 'statement_timestamp()');
    definition := replace(definition, 'NEW.recorded_on>CURRENT_DATE', 'NEW.recorded_on>(statement_timestamp() AT TIME ZONE ''Asia/Ho_Chi_Minh'')::date');
    EXECUTE definition;
  END LOOP;
END $$;
COMMIT;
