CREATE TABLE "training_session_exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "sets" INTEGER NOT NULL,
  "reps" INTEGER,
  "duration_seconds" INTEGER,
  "rest_seconds" INTEGER NOT NULL,
  "instructions" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "training_session_exercises_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_session_exercises_session_id_position_key" UNIQUE ("session_id", "position"),
  CONSTRAINT "training_session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
