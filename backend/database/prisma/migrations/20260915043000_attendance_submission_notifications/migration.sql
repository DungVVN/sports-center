CREATE TABLE "attendance_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id" UUID NOT NULL,
  "submitted_by" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_submissions_class_session_id_key" ON "attendance_submissions"("class_session_id");
