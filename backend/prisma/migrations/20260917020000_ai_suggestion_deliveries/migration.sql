CREATE TABLE "ai_suggestion_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coach_user_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestion_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_suggestion_deliveries_coach_user_id_delivered_at_idx" ON "ai_suggestion_deliveries"("coach_user_id", "delivered_at");
CREATE INDEX "ai_suggestion_deliveries_member_id_delivered_at_idx" ON "ai_suggestion_deliveries"("member_id", "delivered_at");
