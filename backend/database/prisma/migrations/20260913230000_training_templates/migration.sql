CREATE TABLE IF NOT EXISTS training_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_group text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS training_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES training_plan_templates(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  sets integer NOT NULL,
  reps integer,
  duration_seconds integer,
  rest_seconds integer NOT NULL,
  instructions text,
  UNIQUE(template_id, position)
);
