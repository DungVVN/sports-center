CREATE TABLE "training_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "scheduled_on" DATE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMPTZ(6),
  "coach_comment" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "training_sessions_plan_id_position_key" ON "training_sessions"("plan_id", "position");
