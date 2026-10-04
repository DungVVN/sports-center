-- Additive evidence/assessment foundation. No legacy data is rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE "training_evidence_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "publisher" TEXT NOT NULL,
  "url" TEXT NOT NULL CHECK (url ~ '^https://'),
  "source_type" TEXT NOT NULL CHECK (source_type IN ('guideline', 'evidence_synthesis', 'safety_guidance', 'model_documentation')),
  "population_scope" JSONB NOT NULL CHECK (jsonb_typeof(population_scope) = 'object'),
  "limitations" TEXT NOT NULL,
  "published_on" DATE,
  "verified_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("code", "version")
);

CREATE TABLE "training_review_authorizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "discipline" TEXT NOT NULL CHECK (discipline IN ('gym', 'yoga', 'nutrition')),
  "credential_reference" TEXT NOT NULL CHECK (length(trim(credential_reference)) > 0),
  "verified_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "verified_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > verified_at)
);
CREATE INDEX "training_review_authorizations_user_id_discipline_idx" ON "training_review_authorizations" ("user_id", "discipline");

CREATE TABLE "training_protocol_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL CHECK (version > 0),
  "name" TEXT NOT NULL,
  "discipline" TEXT NOT NULL CHECK (discipline IN ('gym', 'yoga', 'nutrition')),
  "population_scope" JSONB NOT NULL CHECK (jsonb_typeof(population_scope) = 'object'),
  "limitations" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "review_authorization_id" UUID REFERENCES "training_review_authorizations"("id") ON DELETE RESTRICT,
  "approved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("code", "version"),
  CHECK ((status = 'draft' AND approved_at IS NULL AND review_authorization_id IS NULL) OR (status IN ('approved','retired') AND approved_at IS NOT NULL AND review_authorization_id IS NOT NULL))
);
CREATE INDEX "training_protocol_versions_discipline_status_idx" ON "training_protocol_versions" ("discipline", "status");

CREATE TABLE "training_protocol_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "protocol_id" UUID NOT NULL REFERENCES "training_protocol_versions"("id") ON DELETE RESTRICT,
  "source_id" UUID NOT NULL REFERENCES "training_evidence_sources"("id") ON DELETE RESTRICT,
  "section_reference" TEXT NOT NULL CHECK (length(trim(section_reference)) > 0),
  "interpretation" TEXT NOT NULL CHECK (length(trim(interpretation)) > 0),
  "applicability" TEXT NOT NULL CHECK (length(trim(applicability)) > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("protocol_id", "source_id", "section_reference")
);

CREATE TABLE "training_protocol_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "protocol_id" UUID NOT NULL REFERENCES "training_protocol_versions"("id") ON DELETE RESTRICT,
  "evidence_id" UUID NOT NULL REFERENCES "training_protocol_evidence"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL,
  "required_inputs" JSONB NOT NULL CHECK (jsonb_typeof(required_inputs) = 'array' AND jsonb_array_length(required_inputs) > 0),
  "conditions" JSONB NOT NULL CHECK (jsonb_typeof(conditions) = 'array' AND jsonb_array_length(conditions) > 0),
  "recommendation" JSONB NOT NULL CHECK (jsonb_typeof(recommendation) = 'object'),
  "rationale" TEXT NOT NULL CHECK (length(trim(rationale)) > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("protocol_id", "code")
);

CREATE TABLE "member_training_consents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "purpose" TEXT NOT NULL CHECK (purpose IN ('assessment', 'nutrition_tracking')),
  "policy_version" TEXT NOT NULL CHECK (length(trim(policy_version)) > 0),
  "recorded_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "granted_at" TIMESTAMPTZ(6) NOT NULL,
  "withdrawn_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (withdrawn_at IS NULL OR withdrawn_at >= granted_at)
);
CREATE INDEX "member_training_consents_member_id_purpose_idx" ON "member_training_consents" ("member_id", "purpose");

CREATE TABLE "member_training_assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "consent_id" UUID NOT NULL REFERENCES "member_training_consents"("id") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL CHECK (version > 0),
  "discipline" TEXT NOT NULL CHECK (discipline IN ('gym', 'yoga', 'nutrition')),
  "goal" TEXT NOT NULL CHECK (length(trim(goal)) > 0),
  "available_days" JSONB NOT NULL CHECK (jsonb_typeof(available_days) = 'array' AND jsonb_array_length(available_days) BETWEEN 1 AND 7),
  "minutes_per_session" INTEGER NOT NULL CHECK (minutes_per_session > 0),
  "experience" TEXT NOT NULL CHECK (experience IN ('new', 'returning', 'experienced')),
  "equipment" JSONB NOT NULL CHECK (jsonb_typeof(equipment) = 'array'),
  "other_activity" TEXT NOT NULL,
  "screening_status" TEXT NOT NULL DEFAULT 'unknown' CHECK (screening_status IN ('unknown', 'follow_up', 'referred', 'reviewed_for_scope')),
  "screening_tool" TEXT,
  "screening_version" TEXT,
  "population" JSONB NOT NULL CHECK (jsonb_typeof(population) = 'object'),
  "assessed_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed')),
  "review_authorization_id" UUID REFERENCES "training_review_authorizations"("id") ON DELETE RESTRICT,
  "assessed_at" TIMESTAMPTZ(6) NOT NULL,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_due_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("member_id", "discipline", "version"),
  CHECK (minutes_per_session <= 1440),
  CHECK (review_due_at > assessed_at),
  CHECK ((status = 'draft' AND reviewed_at IS NULL AND review_authorization_id IS NULL) OR (status = 'reviewed' AND reviewed_at IS NOT NULL AND review_authorization_id IS NOT NULL))
);
CREATE INDEX "member_training_assessments_member_id_assessed_at_idx" ON "member_training_assessments" ("member_id", "assessed_at");

CREATE TABLE "training_metric_definitions" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "discipline" TEXT NOT NULL CHECK (discipline IN ('gym', 'yoga', 'general', 'nutrition')),
  "value_type" TEXT NOT NULL CHECK (value_type IN ('numeric', 'text')),
  "minimum" DECIMAL(12,3),
  "maximum" DECIMAL(12,3),
  "interpretation" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (minimum IS NULL OR maximum IS NULL OR maximum >= minimum)
);

CREATE TABLE "member_training_measurements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "assessment_id" UUID NOT NULL REFERENCES "member_training_assessments"("id") ON DELETE RESTRICT,
  "metric_code" TEXT NOT NULL REFERENCES "training_metric_definitions"("code") ON DELETE RESTRICT,
  "unit" TEXT NOT NULL,
  "value_numeric" DECIMAL(12,3),
  "value_text" TEXT,
  "data_kind" TEXT NOT NULL CHECK (data_kind IN ('observed', 'self_reported', 'estimated')),
  "method" TEXT NOT NULL CHECK (length(trim(method)) > 0),
  "device" TEXT,
  "conditions" TEXT NOT NULL,
  "recorded_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "measured_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((value_numeric IS NOT NULL AND value_text IS NULL) OR (value_numeric IS NULL AND length(trim(value_text)) > 0))
);
CREATE INDEX "member_training_measurements_assessment_id_metric_code_measured_at_idx" ON "member_training_measurements" ("assessment_id", "metric_code", "measured_at");

CREATE TABLE "member_training_findings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "assessment_id" UUID NOT NULL REFERENCES "member_training_assessments"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK (category IN ('movement', 'restriction', 'screening', 'preference')),
  "description" TEXT NOT NULL CHECK (length(trim(description)) > 0),
  "outcome" TEXT NOT NULL CHECK (outcome IN ('observed', 'self_reported', 'professional_instruction')),
  "recorded_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "member_training_findings_assessment_id_category_idx" ON "member_training_findings" ("assessment_id", "category");

CREATE TABLE "member_training_goals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "assessment_id" UUID NOT NULL REFERENCES "member_training_assessments"("id") ON DELETE RESTRICT,
  "metric_code" TEXT NOT NULL REFERENCES "training_metric_definitions"("code") ON DELETE RESTRICT,
  "unit" TEXT NOT NULL,
  "baseline_measurement_id" UUID REFERENCES "member_training_measurements"("id") ON DELETE RESTRICT,
  "target_numeric" DECIMAL(12,3),
  "target_text" TEXT,
  "evaluation_method" TEXT NOT NULL CHECK (length(trim(evaluation_method)) > 0),
  "due_on" DATE NOT NULL,
  "set_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((target_numeric IS NOT NULL AND target_text IS NULL) OR (target_numeric IS NULL AND length(trim(target_text)) > 0))
);
CREATE INDEX "member_training_goals_assessment_id_idx" ON "member_training_goals" ("assessment_id");

CREATE TABLE "training_personalization_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "assessment_id" UUID NOT NULL REFERENCES "member_training_assessments"("id") ON DELETE RESTRICT,
  "protocol_id" UUID NOT NULL REFERENCES "training_protocol_versions"("id") ON DELETE RESTRICT,
  "plan_id" UUID REFERENCES "training_plans"("id") ON DELETE RESTRICT,
  "course_enrollment_id" UUID REFERENCES "course_enrollments"("id") ON DELETE RESTRICT,
  "idempotency_key" TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  "revision" INTEGER NOT NULL CHECK (revision > 0),
  "origin" TEXT NOT NULL CHECK (origin IN ('rules', 'coach')),
  "inputs_snapshot" JSONB NOT NULL CHECK (jsonb_typeof(inputs_snapshot) = 'object'),
  "explanation" TEXT NOT NULL CHECK (length(trim(explanation)) > 0),
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'superseded')),
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "review_authorization_id" UUID REFERENCES "training_review_authorizations"("id") ON DELETE RESTRICT,
  "approved_at" TIMESTAMPTZ(6),
  "previous_decision_id" UUID REFERENCES "training_personalization_decisions"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("idempotency_key"),
  CHECK ((status IN ('draft','rejected') AND approved_at IS NULL AND review_authorization_id IS NULL) OR (status IN ('approved','superseded') AND approved_at IS NOT NULL AND review_authorization_id IS NOT NULL))
);
CREATE INDEX "training_personalization_decisions_member_id_created_at_idx" ON "training_personalization_decisions" ("member_id", "created_at");

CREATE TABLE "training_decision_rules" (
  "decision_id" UUID NOT NULL REFERENCES "training_personalization_decisions"("id") ON DELETE RESTRICT,
  "rule_id" UUID NOT NULL REFERENCES "training_protocol_rules"("id") ON DELETE RESTRICT,
  "evaluation" JSONB NOT NULL CHECK (jsonb_typeof(evaluation) = 'object'),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("decision_id", "rule_id")
);

CREATE TABLE "training_session_prescriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "decision_id" UUID NOT NULL REFERENCES "training_personalization_decisions"("id") ON DELETE RESTRICT,
  "training_session_id" UUID REFERENCES "training_sessions"("id") ON DELETE RESTRICT,
  "class_session_id" UUID REFERENCES "class_sessions"("id") ON DELETE RESTRICT,
  "position" INTEGER NOT NULL CHECK (position > 0),
  "discipline" TEXT NOT NULL CHECK (discipline IN ('gym', 'yoga')),
  "name" TEXT NOT NULL CHECK (length(trim(name)) > 0),
  "variant" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "duration_seconds" INTEGER CHECK (duration_seconds > 0),
  "sets" INTEGER CHECK (sets > 0),
  "reps" INTEGER CHECK (reps > 0),
  "load_kg" DECIMAL(12,3) CHECK (load_kg >= 0),
  "rest_seconds" INTEGER CHECK (rest_seconds >= 0),
  "target_rpe" DECIMAL(12,3) CHECK (target_rpe BETWEEN 0 AND 10),
  "target_rir" INTEGER CHECK (target_rir >= 0),
  "hold_seconds" INTEGER CHECK (hold_seconds > 0),
  "breath_cycles" INTEGER CHECK (breath_cycles > 0),
  "props" JSONB CHECK (jsonb_typeof(props) = 'array'),
  "progression_criteria" TEXT NOT NULL CHECK (length(trim(progression_criteria)) > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("decision_id", "position"),
  CHECK ((discipline = 'gym' AND sets IS NOT NULL AND (reps IS NOT NULL OR duration_seconds IS NOT NULL) AND hold_seconds IS NULL AND breath_cycles IS NULL AND props IS NULL) OR (discipline = 'yoga' AND sets IS NULL AND reps IS NULL AND load_kg IS NULL AND rest_seconds IS NULL AND target_rir IS NULL AND (hold_seconds IS NOT NULL OR breath_cycles IS NOT NULL OR duration_seconds IS NOT NULL)))
);

CREATE TABLE "training_session_checkins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "training_session_id" UUID NOT NULL REFERENCES "training_sessions"("id") ON DELETE RESTRICT,
  "session_date" DATE NOT NULL,
  "available_minutes" INTEGER NOT NULL CHECK (available_minutes > 0),
  "sleep_hours" DECIMAL(12,3) CHECK (sleep_hours BETWEEN 0 AND 24),
  "fatigue_score" INTEGER CHECK (fatigue_score BETWEEN 0 AND 10),
  "discomfort_score" INTEGER CHECK (discomfort_score BETWEEN 0 AND 10),
  "new_symptoms" BOOLEAN NOT NULL,
  "notes" TEXT NOT NULL,
  "other_activity" TEXT NOT NULL,
  "review_status" TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'hold')),
  "reviewed_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("member_id", "training_session_id", "session_date"),
  CHECK (available_minutes <= 1440),
  CHECK (review_status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE "training_session_observations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "training_session_id" UUID NOT NULL REFERENCES "training_sessions"("id") ON DELETE RESTRICT,
  "prescription_id" UUID REFERENCES "training_session_prescriptions"("id") ON DELETE RESTRICT,
  "metric_code" TEXT NOT NULL REFERENCES "training_metric_definitions"("code") ON DELETE RESTRICT,
  "unit" TEXT NOT NULL,
  "value_numeric" DECIMAL(12,3),
  "value_text" TEXT,
  "data_kind" TEXT NOT NULL CHECK (data_kind IN ('observed', 'self_reported', 'estimated')),
  "method" TEXT NOT NULL CHECK (length(trim(method)) > 0),
  "recorded_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((value_numeric IS NOT NULL AND value_text IS NULL) OR (value_numeric IS NULL AND length(trim(value_text)) > 0))
);
CREATE INDEX "training_session_observations_member_id_recorded_at_idx" ON "training_session_observations" ("member_id", "recorded_at");

CREATE TABLE "member_training_energy_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "consent_id" UUID NOT NULL REFERENCES "member_training_consents"("id") ON DELETE RESTRICT,
  "recorded_on" DATE NOT NULL,
  "energy_type" TEXT NOT NULL CHECK (energy_type IN ('intake', 'resting', 'total_daily', 'exercise')),
  "value_kcal" DECIMAL(12,3) NOT NULL CHECK (value_kcal > 0),
  "data_kind" TEXT NOT NULL CHECK (data_kind IN ('observed', 'self_reported', 'estimated')),
  "method" TEXT NOT NULL CHECK (length(trim(method)) > 0),
  "model_version" TEXT,
  "includes_exercise" BOOLEAN NOT NULL,
  "inputs" JSONB NOT NULL CHECK (jsonb_typeof(inputs) = 'object'),
  "recorded_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (data_kind <> 'estimated' OR length(trim(model_version)) > 0),
  CHECK (energy_type = 'total_daily' OR includes_exercise = false)
);
CREATE INDEX "member_training_energy_records_member_id_recorded_on_idx" ON "member_training_energy_records" ("member_id", "recorded_on");

-- Only one current consent per purpose. Withdraw rather than erase history.
CREATE TABLE training_decision_inputs (
  decision_id UUID NOT NULL REFERENCES training_personalization_decisions(id) ON DELETE RESTRICT,
  input_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('assessment','measurement','finding')),
  assessment_field TEXT,
  measurement_id UUID REFERENCES member_training_measurements(id) ON DELETE RESTRICT,
  finding_id UUID REFERENCES member_training_findings(id) ON DELETE RESTRICT,
  value JSONB NOT NULL CHECK (value <> 'null'::jsonb),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (decision_id,input_key),
  CHECK ((kind='assessment' AND assessment_field IS NOT NULL AND measurement_id IS NULL AND finding_id IS NULL)
    OR (kind='measurement' AND assessment_field IS NULL AND measurement_id IS NOT NULL AND finding_id IS NULL)
    OR (kind='finding' AND assessment_field IS NULL AND measurement_id IS NULL AND finding_id IS NOT NULL))
);
CREATE UNIQUE INDEX member_training_consents_current_key ON member_training_consents(member_id, purpose) WHERE withdrawn_at IS NULL;
CREATE UNIQUE INDEX training_decisions_current_plan_key ON training_personalization_decisions(plan_id) WHERE status = 'approved' AND plan_id IS NOT NULL;

CREATE FUNCTION training_require_authorization(authority UUID, subject TEXT, at_time TIMESTAMPTZ) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM training_review_authorizations a JOIN users u ON u.id=a.user_id
    WHERE a.id=authority AND a.discipline=subject AND a.verified_at <= at_time AND a.expires_at > at_time
      AND a.revoked_at IS NULL AND u.status='active') THEN
    RAISE EXCEPTION 'Valid discipline-specific professional authorization required' USING ERRCODE='23514';
  END IF;
END;
$$;

CREATE FUNCTION training_guard_authorization() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Professional authorization history cannot be erased' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.verified_by AND role='admin' AND status='active') THEN
      RAISE EXCEPTION 'An active administrator must verify professional credentials' USING ERRCODE='23514';
    END IF;
    IF NEW.verified_at > CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Credential verification cannot be future-dated' USING ERRCODE='23514'; END IF;
  ELSIF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Authorization identity and verification are immutable; issue a new authorization' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_authorization_guard BEFORE INSERT OR UPDATE OR DELETE ON training_review_authorizations FOR EACH ROW EXECUTE FUNCTION training_guard_authorization();

CREATE FUNCTION training_guard_protocol() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Approved protocol history is immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.status <> 'draft' THEN RAISE EXCEPTION 'Protocols must be created as drafts' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'draft' THEN
    IF OLD.status='retired' OR NEW.status<>'retired' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
      RAISE EXCEPTION 'Approved protocols can only be retired; create a new version to change rules' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.status='approved' THEN
    PERFORM training_require_authorization(NEW.review_authorization_id, NEW.discipline, CURRENT_TIMESTAMP);
    IF NEW.approved_at > CURRENT_TIMESTAMP OR NEW.approved_at < NEW.created_at THEN RAISE EXCEPTION 'Invalid approval timestamp' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM training_protocol_rules WHERE protocol_id=NEW.id) OR NOT EXISTS (SELECT 1 FROM training_protocol_evidence WHERE protocol_id=NEW.id) THEN
      RAISE EXCEPTION 'Approval requires scientific references and explicitly defined rules' USING ERRCODE='23514';
    END IF;
    IF NOT (NEW.population_scope ?& ARRAY['minimum_age_years','pregnancy_allowed','breastfeeding_allowed','clinical_restrictions_allowed'])
      OR jsonb_typeof(NEW.population_scope->'minimum_age_years')<>'number'
      OR jsonb_typeof(NEW.population_scope->'pregnancy_allowed')<>'boolean'
      OR jsonb_typeof(NEW.population_scope->'breastfeeding_allowed')<>'boolean'
      OR jsonb_typeof(NEW.population_scope->'clinical_restrictions_allowed')<>'boolean' THEN
      RAISE EXCEPTION 'Approval requires explicit population boundaries' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_protocol_guard BEFORE INSERT OR UPDATE OR DELETE ON training_protocol_versions FOR EACH ROW EXECUTE FUNCTION training_guard_protocol();

CREATE FUNCTION training_guard_protocol_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent UUID; state TEXT; evidence_parent UUID; condition JSONB;
BEGIN
  parent := CASE WHEN TG_OP='DELETE' THEN OLD.protocol_id ELSE NEW.protocol_id END;
  SELECT status INTO state FROM training_protocol_versions WHERE id=parent FOR UPDATE;
  IF state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Only draft protocol content can change' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW.protocol_id<>OLD.protocol_id THEN RAISE EXCEPTION 'Cannot retarget protocol content' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='training_protocol_rules' AND TG_OP<>'DELETE' THEN
    SELECT protocol_id INTO evidence_parent FROM training_protocol_evidence WHERE id=NEW.evidence_id;
    IF evidence_parent IS DISTINCT FROM NEW.protocol_id THEN RAISE EXCEPTION 'Rule evidence belongs to a different protocol' USING ERRCODE='23514'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.required_inputs) x WHERE jsonb_typeof(x)<>'string' OR x #>> '{}' !~ '^(assessment|measurement|finding)\.[a-z_]+$') THEN
      RAISE EXCEPTION 'Rule input references must be explicit and supported' USING ERRCODE='23514';
    END IF;
    FOR condition IN SELECT jsonb_array_elements(NEW.conditions) LOOP
      IF jsonb_typeof(condition)<>'object' OR NOT (condition ?& ARRAY['input','op','value'])
        OR condition->'value'='null'::jsonb OR condition->>'op' NOT IN ('eq','ne','gte','lte','in','contains')
        OR NOT NEW.required_inputs @> jsonb_build_array(condition->>'input') THEN
        RAISE EXCEPTION 'Rule conditions must reference declared inputs and supported comparisons' USING ERRCODE='23514';
      END IF;
    END LOOP;
    IF jsonb_typeof(NEW.recommendation->'prescriptions') IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.recommendation->'prescriptions')=0 THEN
      RAISE EXCEPTION 'A rule must define its actual prescription output' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_protocol_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON training_protocol_evidence FOR EACH ROW EXECUTE FUNCTION training_guard_protocol_child();
CREATE TRIGGER training_protocol_rules_guard BEFORE INSERT OR UPDATE OR DELETE ON training_protocol_rules FOR EACH ROW EXECUTE FUNCTION training_guard_protocol_child();

CREATE FUNCTION training_guard_reference() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='training_evidence_sources' THEN
    IF EXISTS (SELECT 1 FROM training_protocol_evidence e JOIN training_protocol_versions p ON p.id=e.protocol_id
      WHERE e.source_id=OLD.id AND p.status<>'draft') THEN
      RAISE EXCEPTION 'Evidence supporting an approved protocol is immutable' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM member_training_measurements WHERE metric_code=OLD.code)
      OR EXISTS (SELECT 1 FROM member_training_goals WHERE metric_code=OLD.code)
      OR EXISTS (SELECT 1 FROM training_session_observations WHERE metric_code=OLD.code) THEN
      RAISE EXCEPTION 'Metric definitions already in use are immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_evidence_source_guard BEFORE UPDATE OR DELETE ON training_evidence_sources FOR EACH ROW EXECUTE FUNCTION training_guard_reference();
CREATE TRIGGER training_metric_definition_guard BEFORE UPDATE OR DELETE ON training_metric_definitions FOR EACH ROW EXECUTE FUNCTION training_guard_reference();

CREATE FUNCTION training_guard_consent() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Consent history cannot be erased' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD)-'withdrawn_at') OR OLD.withdrawn_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Consent identity is immutable; withdraw and create a new consent' USING ERRCODE='23514';
  END IF;
  IF NEW.granted_at > CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Consent cannot be future-dated' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_training_consent_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_consents FOR EACH ROW EXECUTE FUNCTION training_guard_consent();

CREATE FUNCTION training_require_consent(consent UUID, owner UUID, requested_purpose TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE found_consent UUID;
BEGIN
  SELECT id INTO found_consent FROM member_training_consents WHERE id=consent AND member_id=owner
    AND purpose=requested_purpose AND withdrawn_at IS NULL AND granted_at<=CURRENT_TIMESTAMP FOR UPDATE;
  IF found_consent IS NULL THEN
    RAISE EXCEPTION 'Current consent with matching member and purpose required' USING ERRCODE='23514';
  END IF;
END;
$$;

CREATE FUNCTION training_guard_assessment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='reviewed' THEN RAISE EXCEPTION 'Reviewed assessments are immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.status <> 'draft' THEN RAISE EXCEPTION 'Assessments must start as drafts' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status='reviewed' OR NEW.member_id<>OLD.member_id OR NEW.discipline<>OLD.discipline) THEN
    RAISE EXCEPTION 'Create a new assessment version instead of rewriting reviewed data' USING ERRCODE='23514';
  END IF;
  PERFORM training_require_consent(NEW.consent_id, NEW.member_id, 'assessment');
  IF NEW.assessed_at > CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Assessment cannot be future-dated' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.available_days) d WHERE jsonb_typeof(d)<>'number' OR d::text !~ '^[0-6]$')
    OR (SELECT count(DISTINCT d) FROM jsonb_array_elements(NEW.available_days) d) <> jsonb_array_length(NEW.available_days) THEN
    RAISE EXCEPTION 'Available days must be distinct weekday numbers 0 to 6' USING ERRCODE='23514';
  END IF;
  IF NEW.status='reviewed' THEN
    PERFORM training_require_authorization(NEW.review_authorization_id, NEW.discipline, CURRENT_TIMESTAMP);
    IF NEW.screening_status<>'reviewed_for_scope' OR length(trim(COALESCE(NEW.screening_tool,'')))=0 OR length(trim(COALESCE(NEW.screening_version,'')))=0 THEN
      RAISE EXCEPTION 'Review requires completed screening with tool and version' USING ERRCODE='23514';
    END IF;
    IF NEW.reviewed_at > CURRENT_TIMESTAMP OR NEW.reviewed_at < NEW.assessed_at OR NEW.review_due_at <= CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'Assessment review timestamps are invalid or stale' USING ERRCODE='23514';
    END IF;
    IF NOT (NEW.population ?& ARRAY['age_years','pregnant','breastfeeding','clinical_restrictions'])
      OR jsonb_typeof(NEW.population->'age_years')<>'number'
      OR jsonb_typeof(NEW.population->'pregnant')<>'boolean'
      OR jsonb_typeof(NEW.population->'breastfeeding')<>'boolean'
      OR jsonb_typeof(NEW.population->'clinical_restrictions')<>'boolean' THEN
      RAISE EXCEPTION 'Missing confirmed population information; unknown is not healthy' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM member_training_findings WHERE assessment_id=NEW.id AND category='movement') THEN
      RAISE EXCEPTION 'Assessment requires a documented movement evaluation' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_training_assessment_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_assessments FOR EACH ROW EXECUTE FUNCTION training_guard_assessment();

CREATE FUNCTION training_validate_metric(metric TEXT, given_unit TEXT, numeric_value NUMERIC, text_value TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE definition training_metric_definitions;
BEGIN
  SELECT * INTO definition FROM training_metric_definitions WHERE code=metric;
  IF NOT FOUND OR definition.unit<>given_unit THEN RAISE EXCEPTION 'Unknown metric or incompatible unit' USING ERRCODE='23514'; END IF;
  IF num_nonnulls(numeric_value,text_value)<>1 OR (text_value IS NOT NULL AND length(trim(text_value))=0)
    OR (definition.value_type='numeric' AND numeric_value IS NULL) OR (definition.value_type='text' AND text_value IS NULL) THEN
    RAISE EXCEPTION 'Metric requires exactly one value of the defined type' USING ERRCODE='23514';
  END IF;
  IF numeric_value IS NOT NULL AND (numeric_value::text IN ('NaN','Infinity','-Infinity')
    OR (definition.minimum IS NOT NULL AND numeric_value<definition.minimum)
    OR (definition.maximum IS NOT NULL AND numeric_value>definition.maximum)) THEN
    RAISE EXCEPTION 'Metric value is outside its data-validation range' USING ERRCODE='23514';
  END IF;
END;
$$;

CREATE FUNCTION training_guard_assessment_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent UUID; state TEXT; baseline member_training_measurements;
BEGIN
  parent := CASE WHEN TG_OP='DELETE' THEN OLD.assessment_id ELSE NEW.assessment_id END;
  SELECT status INTO state FROM member_training_assessments WHERE id=parent FOR UPDATE;
  IF state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Reviewed assessment details are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW.assessment_id<>OLD.assessment_id THEN RAISE EXCEPTION 'Cannot retarget assessment details' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME='member_training_measurements' THEN
    PERFORM training_validate_metric(NEW.metric_code,NEW.unit,NEW.value_numeric,NEW.value_text);
    IF NEW.metric_code IN ('body_fat','rir') AND NEW.data_kind<>'estimated' THEN
      RAISE EXCEPTION 'Body-fat device output and repetitions-in-reserve are estimates, not observed facts' USING ERRCODE='23514';
    END IF;
    IF NEW.measured_at>CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Measurement cannot be future-dated' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='member_training_goals' THEN
    PERFORM training_validate_metric(NEW.metric_code,NEW.unit,NEW.target_numeric,NEW.target_text);
    IF NEW.baseline_measurement_id IS NOT NULL THEN
      SELECT * INTO baseline FROM member_training_measurements WHERE id=NEW.baseline_measurement_id;
      IF NOT FOUND OR baseline.assessment_id<>NEW.assessment_id OR baseline.metric_code<>NEW.metric_code OR baseline.unit<>NEW.unit OR baseline.data_kind='estimated' THEN
        RAISE EXCEPTION 'Goal baseline must be a matching non-estimated assessment measurement' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_training_measurement_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_measurements FOR EACH ROW EXECUTE FUNCTION training_guard_assessment_child();
CREATE TRIGGER member_training_finding_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_findings FOR EACH ROW EXECUTE FUNCTION training_guard_assessment_child();
CREATE TRIGGER member_training_goal_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_goals FOR EACH ROW EXECUTE FUNCTION training_guard_assessment_child();

CREATE FUNCTION training_rule_matches(decision UUID, rule UUID) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE condition JSONB; actual JSONB; expected JSONB; operation TEXT; matched BOOLEAN;
BEGIN
  FOR condition IN SELECT jsonb_array_elements(conditions) FROM training_protocol_rules WHERE id=rule LOOP
    SELECT value INTO actual FROM training_decision_inputs WHERE decision_id=decision AND input_key=condition->>'input';
    expected := condition->'value'; operation := condition->>'op';
    IF actual IS NULL OR actual='null'::jsonb OR expected IS NULL OR expected='null'::jsonb THEN RETURN FALSE; END IF;
    matched := CASE operation
      WHEN 'eq' THEN actual=expected
      WHEN 'ne' THEN actual<>expected
      WHEN 'gte' THEN CASE WHEN jsonb_typeof(actual)='number' AND jsonb_typeof(expected)='number' THEN actual::text::numeric>=expected::text::numeric ELSE FALSE END
      WHEN 'lte' THEN CASE WHEN jsonb_typeof(actual)='number' AND jsonb_typeof(expected)='number' THEN actual::text::numeric<=expected::text::numeric ELSE FALSE END
      WHEN 'in' THEN CASE WHEN jsonb_typeof(expected)='array' THEN expected @> jsonb_build_array(actual) ELSE FALSE END
      WHEN 'contains' THEN CASE WHEN jsonb_typeof(actual)='array' THEN actual @> jsonb_build_array(expected) ELSE FALSE END
      ELSE FALSE END;
    IF matched IS DISTINCT FROM TRUE THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE FUNCTION training_guard_decision_input() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent UUID; decision training_personalization_decisions; assessment member_training_assessments;
  measurement member_training_measurements; finding member_training_findings; expected JSONB; expected_key TEXT;
BEGIN
  parent := CASE WHEN TG_OP='DELETE' THEN OLD.decision_id ELSE NEW.decision_id END;
  SELECT * INTO decision FROM training_personalization_decisions WHERE id=parent FOR UPDATE;
  IF decision.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Final decision inputs are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NEW.decision_id<>OLD.decision_id THEN RAISE EXCEPTION 'Cannot retarget decision input' USING ERRCODE='23514'; END IF;
  SELECT * INTO assessment FROM member_training_assessments WHERE id=decision.assessment_id;
  IF NEW.kind='assessment' THEN
    IF NEW.assessment_field NOT IN ('goal','available_days','minutes_per_session','experience','equipment','other_activity','population') THEN
      RAISE EXCEPTION 'Assessment input field is not supported' USING ERRCODE='23514';
    END IF;
    expected := to_jsonb(assessment)->NEW.assessment_field;
    expected_key := 'assessment.'||NEW.assessment_field;
  ELSIF NEW.kind='measurement' THEN
    SELECT * INTO measurement FROM member_training_measurements WHERE id=NEW.measurement_id;
    IF NOT FOUND OR measurement.assessment_id<>assessment.id OR measurement.data_kind='estimated' THEN
      RAISE EXCEPTION 'Decision inputs require matching non-estimated source measurements' USING ERRCODE='23514';
    END IF;
    expected := CASE WHEN measurement.value_numeric IS NOT NULL THEN to_jsonb(measurement.value_numeric) ELSE to_jsonb(measurement.value_text) END;
    expected_key := 'measurement.'||measurement.metric_code;
  ELSE
    SELECT * INTO finding FROM member_training_findings WHERE id=NEW.finding_id;
    IF NOT FOUND OR finding.assessment_id<>assessment.id THEN RAISE EXCEPTION 'Finding belongs to another assessment' USING ERRCODE='23514'; END IF;
    expected := to_jsonb(finding.description);
    expected_key := 'finding.'||finding.code;
  END IF;
  IF NEW.value IS DISTINCT FROM expected OR NEW.input_key IS DISTINCT FROM expected_key THEN
    RAISE EXCEPTION 'Decision input does not match its recorded source value' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_decision_input_guard BEFORE INSERT OR UPDATE OR DELETE ON training_decision_inputs FOR EACH ROW EXECUTE FUNCTION training_guard_decision_input();

CREATE FUNCTION training_resolve_recommendation(decision UUID, template JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE item RECORD; result JSONB := '{}'::jsonb; resolved JSONB;
BEGIN
  IF jsonb_typeof(template)<>'object' THEN RETURN NULL; END IF;
  FOR item IN SELECT * FROM jsonb_each(template) LOOP
    IF jsonb_typeof(item.value)='object' THEN
      IF NOT item.value ? 'input' OR (SELECT count(*) FROM jsonb_object_keys(item.value))<>1 THEN RETURN NULL; END IF;
      SELECT value INTO resolved FROM training_decision_inputs WHERE decision_id=decision AND input_key=item.value->>'input';
      IF resolved IS NULL THEN RETURN NULL; END IF;
    ELSE resolved := item.value;
    END IF;
    result := result || jsonb_build_object(item.key,resolved);
  END LOOP;
  RETURN jsonb_strip_nulls(result);
END;
$$;

CREATE FUNCTION training_guard_decision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE assessment member_training_assessments; protocol training_protocol_versions; owner UUID; enrollment course_enrollments;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Decision history cannot be erased' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND NEW.status<>'draft' THEN RAISE EXCEPTION 'Decisions must start as drafts' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.member_id<>OLD.member_id OR NEW.assessment_id<>OLD.assessment_id OR NEW.protocol_id<>OLD.protocol_id
    OR (OLD.plan_id IS NOT NULL AND NEW.plan_id IS DISTINCT FROM OLD.plan_id)) THEN
    RAISE EXCEPTION 'Decision source identity is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('approved','superseded','rejected') THEN
    IF OLD.status<>'approved' OR NEW.status<>'superseded' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
      RAISE EXCEPTION 'Final decisions are immutable; create a new revision' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO assessment FROM member_training_assessments WHERE id=NEW.assessment_id FOR UPDATE;
  SELECT * INTO protocol FROM training_protocol_versions WHERE id=NEW.protocol_id FOR UPDATE;
  IF assessment.member_id IS DISTINCT FROM NEW.member_id OR assessment.discipline IS DISTINCT FROM protocol.discipline THEN
    RAISE EXCEPTION 'Assessment owner or discipline mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.plan_id IS NOT NULL THEN
    SELECT member_id INTO owner FROM training_plans WHERE id=NEW.plan_id;
    IF owner IS DISTINCT FROM NEW.member_id THEN RAISE EXCEPTION 'Plan belongs to another member' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.course_enrollment_id IS NOT NULL THEN
    SELECT * INTO enrollment FROM course_enrollments WHERE id=NEW.course_enrollment_id;
    IF NOT FOUND OR enrollment.member_id<>NEW.member_id THEN RAISE EXCEPTION 'Enrollment belongs to another member' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.previous_decision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM training_personalization_decisions
    WHERE id=NEW.previous_decision_id AND member_id=NEW.member_id AND protocol_id=NEW.protocol_id AND revision=NEW.revision-1) THEN
    RAISE EXCEPTION 'Previous decision must match the member, protocol and revision' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' THEN
    PERFORM training_require_consent(assessment.consent_id,NEW.member_id,'assessment');
    PERFORM training_require_authorization(NEW.review_authorization_id,protocol.discipline,CURRENT_TIMESTAMP);
    PERFORM training_require_authorization(protocol.review_authorization_id,protocol.discipline,CURRENT_TIMESTAMP);
    PERFORM training_require_authorization(assessment.review_authorization_id,assessment.discipline,CURRENT_TIMESTAMP);
    IF protocol.status<>'approved' OR assessment.status<>'reviewed' OR assessment.screening_status<>'reviewed_for_scope' OR assessment.review_due_at<=CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'Only approved protocols and current reviewed assessments may be applied' USING ERRCODE='23514';
    END IF;
    IF NEW.plan_id IS NULL OR NEW.approved_at>CURRENT_TIMESTAMP OR NEW.approved_at<NEW.created_at THEN
      RAISE EXCEPTION 'Approval requires a member plan and valid approval timestamp' USING ERRCODE='23514';
    END IF;
    IF NEW.course_enrollment_id IS NOT NULL AND enrollment.status<>'active' THEN
      RAISE EXCEPTION 'Course-linked plan requires active enrollment' USING ERRCODE='23514';
    END IF;
    IF (assessment.population->>'age_years')::numeric < (protocol.population_scope->>'minimum_age_years')::numeric
      OR ((assessment.population->>'pregnant')::boolean AND NOT (protocol.population_scope->>'pregnancy_allowed')::boolean)
      OR ((assessment.population->>'breastfeeding')::boolean AND NOT (protocol.population_scope->>'breastfeeding_allowed')::boolean)
      OR ((assessment.population->>'clinical_restrictions')::boolean AND NOT (protocol.population_scope->>'clinical_restrictions_allowed')::boolean) THEN
      RAISE EXCEPTION 'Assessment is outside the approved scientific population scope' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM training_session_prescriptions WHERE decision_id=NEW.id)
      OR NOT EXISTS (SELECT 1 FROM training_decision_rules WHERE decision_id=NEW.id) THEN
      RAISE EXCEPTION 'Approval requires prescriptions and rule evidence trail' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM training_decision_rules dr JOIN training_protocol_rules r ON r.id=dr.rule_id,
      LATERAL jsonb_array_elements_text(r.required_inputs) required(input_key)
      WHERE dr.decision_id=NEW.id AND NOT EXISTS (SELECT 1 FROM training_decision_inputs i WHERE i.decision_id=NEW.id AND i.input_key=required.input_key)) THEN
      RAISE EXCEPTION 'Decision is missing a required evidenced input' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM training_decision_rules WHERE decision_id=NEW.id AND NOT training_rule_matches(NEW.id,rule_id)) THEN
      RAISE EXCEPTION 'Recorded facts do not satisfy the cited protocol rules' USING ERRCODE='23514';
    END IF;
    IF NEW.origin='rules' AND EXISTS (
      SELECT 1 FROM training_session_prescriptions p WHERE p.decision_id=NEW.id AND NOT EXISTS (
        SELECT 1 FROM training_decision_rules dr JOIN training_protocol_rules r ON r.id=dr.rule_id,
          LATERAL jsonb_array_elements(r.recommendation->'prescriptions') output(template)
        WHERE dr.decision_id=NEW.id AND training_resolve_recommendation(NEW.id,output.template)
          = jsonb_strip_nulls(to_jsonb(p)-ARRAY['id','decision_id','training_session_id','class_session_id','position','created_at'])
      )) THEN
      RAISE EXCEPTION 'Automatic prescription output does not match its scientific rule and recorded inputs' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_decision_guard BEFORE INSERT OR UPDATE OR DELETE ON training_personalization_decisions FOR EACH ROW EXECUTE FUNCTION training_guard_decision();

CREATE FUNCTION training_guard_decision_child() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent UUID; decision training_personalization_decisions; rule_protocol UUID; session training_sessions; class_owner UUID;
BEGIN
  parent := CASE WHEN TG_OP='DELETE' THEN OLD.decision_id ELSE NEW.decision_id END;
  SELECT * INTO decision FROM training_personalization_decisions WHERE id=parent FOR UPDATE;
  IF decision.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Only draft decision content can change' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW.decision_id<>OLD.decision_id THEN RAISE EXCEPTION 'Cannot retarget decision content' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME='training_decision_rules' THEN
    SELECT protocol_id INTO rule_protocol FROM training_protocol_rules WHERE id=NEW.rule_id;
    IF rule_protocol IS DISTINCT FROM decision.protocol_id THEN RAISE EXCEPTION 'Decision rule belongs to another protocol' USING ERRCODE='23514'; END IF;
  ELSE
    IF NEW.discipline IS DISTINCT FROM (SELECT discipline FROM training_protocol_versions WHERE id=decision.protocol_id) THEN
      RAISE EXCEPTION 'Prescription discipline mismatch' USING ERRCODE='23514';
    END IF;
    IF NEW.training_session_id IS NOT NULL THEN
      SELECT * INTO session FROM training_sessions WHERE id=NEW.training_session_id;
      IF NOT FOUND OR session.plan_id IS DISTINCT FROM decision.plan_id THEN RAISE EXCEPTION 'Prescription session belongs to another plan' USING ERRCODE='23514'; END IF;
    END IF;
    IF NEW.class_session_id IS NOT NULL THEN
      SELECT course_id INTO class_owner FROM class_sessions WHERE id=NEW.class_session_id;
      IF decision.course_enrollment_id IS NULL OR class_owner IS DISTINCT FROM (SELECT course_id FROM course_enrollments WHERE id=decision.course_enrollment_id) THEN
        RAISE EXCEPTION 'Prescription class does not belong to enrolled course' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_decision_rule_guard BEFORE INSERT OR UPDATE OR DELETE ON training_decision_rules FOR EACH ROW EXECUTE FUNCTION training_guard_decision_child();
CREATE TRIGGER training_prescription_guard BEFORE INSERT OR UPDATE OR DELETE ON training_session_prescriptions FOR EACH ROW EXECUTE FUNCTION training_guard_decision_child();

CREATE FUNCTION training_guard_session_record() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE owner UUID; prescription training_session_prescriptions;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Session records cannot be erased' USING ERRCODE='23514'; END IF;
  SELECT p.member_id INTO owner FROM training_sessions s JOIN training_plans p ON p.id=s.plan_id WHERE s.id=NEW.training_session_id;
  IF owner IS DISTINCT FROM NEW.member_id THEN RAISE EXCEPTION 'Session belongs to another member' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='training_session_checkins' THEN
    IF TG_OP='UPDATE' AND (OLD.review_status<>'pending' OR
      (to_jsonb(NEW)-ARRAY['review_status','reviewed_by','reviewed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','reviewed_by','reviewed_at'])) THEN
      RAISE EXCEPTION 'Check-in facts are immutable after submission' USING ERRCODE='23514';
    END IF;
    IF NEW.new_symptoms AND NEW.review_status='reviewed' THEN RAISE EXCEPTION 'New symptoms require hold and professional follow-up' USING ERRCODE='23514'; END IF;
  ELSE
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Session observations are append-only' USING ERRCODE='23514'; END IF;
    PERFORM training_validate_metric(NEW.metric_code,NEW.unit,NEW.value_numeric,NEW.value_text);
    IF NEW.recorded_at>CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Observation cannot be future-dated' USING ERRCODE='23514'; END IF;
    IF NEW.prescription_id IS NOT NULL THEN
      SELECT * INTO prescription FROM training_session_prescriptions WHERE id=NEW.prescription_id;
      IF NOT FOUND OR prescription.training_session_id IS DISTINCT FROM NEW.training_session_id THEN
        RAISE EXCEPTION 'Observation prescription belongs to another session' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_checkin_guard BEFORE INSERT OR UPDATE OR DELETE ON training_session_checkins FOR EACH ROW EXECUTE FUNCTION training_guard_session_record();
CREATE TRIGGER training_observation_guard BEFORE INSERT OR UPDATE OR DELETE ON training_session_observations FOR EACH ROW EXECUTE FUNCTION training_guard_session_record();

CREATE FUNCTION training_guard_energy_record() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Energy observations are append-only' USING ERRCODE='23514'; END IF;
  PERFORM training_require_consent(NEW.consent_id,NEW.member_id,'nutrition_tracking');
  IF NEW.value_kcal::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Energy value must be finite' USING ERRCODE='23514'; END IF;
  IF NEW.recorded_on>CURRENT_DATE THEN RAISE EXCEPTION 'Energy observation cannot be future-dated' USING ERRCODE='23514'; END IF;
  IF NEW.data_kind='estimated' THEN
    RAISE EXCEPTION 'Estimated calorie models are disabled until a separate validated and professionally approved model is implemented' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER training_energy_record_guard BEFORE INSERT OR UPDATE OR DELETE ON member_training_energy_records FOR EACH ROW EXECUTE FUNCTION training_guard_energy_record();

-- Reference metadata only. No credentials, clinical clearance or operative rules are seeded.
INSERT INTO training_evidence_sources(code,version,title,publisher,url,source_type,population_scope,limitations,published_on,verified_at) VALUES
('ACSM_RESISTANCE','2026','Resistance Training Prescription: official 2026 position stand summary','American College of Sports Medicine','https://acsm.org/resistance-training-guidelines-update-2026/','evidence_synthesis','{"population":"healthy adults","minimum_age_years":18}','Group-level evidence; not an individual outcome guarantee or rehabilitation protocol. Full paper was not freely accessible during metadata verification.','2026-03-17',CURRENT_TIMESTAMP),
('WHO_PHYSICAL_ACTIVITY','2020','WHO guidelines on physical activity and sedentary behaviour','World Health Organization','https://www.who.int/publications/i/item/9789240015128','guideline','{"population":"age and condition-specific groups"}','Public-health activity targets are not mandatory starting doses; select the correct chapter for the individual.','2020-11-25',CURRENT_TIMESTAMP),
('NCCIH_YOGA_SAFETY','accessed-2026-10-04','Yoga: Effectiveness and Safety','NIH NCCIH','https://www.nccih.nih.gov/health/yoga-effectiveness-and-safety','safety_guidance','{"population":"practice and condition-dependent"}','No universal numeric yoga dose; modifications and qualified instruction may be required.',NULL,CURRENT_TIMESTAMP),
('NIDDK_WEIGHT_PLANNER','accessed-2026-10-04','About the Body Weight Planner','NIH NIDDK','https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner','model_documentation','{"minimum_age_years":18,"pregnancy_allowed":false,"breastfeeding_allowed":false}','Produces estimates, not measured calorie requirements; model execution is not enabled by this migration.',NULL,CURRENT_TIMESTAMP),
('CDC_BMI','2025-12-16','About Body Mass Index','Centers for Disease Control and Prevention','https://www.cdc.gov/bmi/about/index.html','safety_guidance','{"population":"age-specific BMI interpretation"}','BMI does not distinguish fat, muscle and bone; never use as sole prescription input.','2025-12-16',CURRENT_TIMESTAMP);

-- These bounds validate data format, not clinical eligibility or training targets.
INSERT INTO training_metric_definitions(code,name,unit,discipline,value_type,minimum,maximum,interpretation) VALUES
('body_weight','Cân nặng','kg','general','numeric',0.001,NULL,'Record method and conditions; compare trends, not isolated values.'),
('body_height','Chiều cao','cm','general','numeric',0.001,NULL,'Measured height; not a prescription decision.'),
('waist','Vòng eo','cm','general','numeric',0.001,NULL,'Use a consistent measurement protocol.'),
('body_fat','Tỷ lệ mỡ ước tính','percent','general','numeric',0,100,'Body-composition devices estimate; mark data kind and method.'),
('load','Tải thực hiện','kg','gym','numeric',0,NULL,'Actual exercise load, not inferred from body weight.'),
('rpe','Gắng sức cảm nhận','score_0_10','general','numeric',0,10,'Self-reported effort, not a clinical diagnosis.'),
('rir','Số lần ước tính còn làm được','reps','gym','numeric',0,NULL,'An estimate; cannot serve as an observed metric baseline.'),
('sleep','Thời lượng ngủ tự báo','hours','general','numeric',0,24,'Self-reported recovery context.'),
('movement_control','Kiểm soát động tác','assessment_note','general','text',NULL,NULL,'Coach observation using a documented evaluation method.'),
('balance','Khả năng thăng bằng','assessment_note','yoga','text',NULL,NULL,'Document supported task and conditions; no forced maximal testing.'),
('relaxation','Cảm nhận thư giãn','score_0_10','yoga','numeric',0,10,'Member self-report; not a treatment outcome.'),
('session_duration','Thời gian thực hiện','minutes','general','numeric',0,1440,'Actual duration for one session.');

COMMIT;
