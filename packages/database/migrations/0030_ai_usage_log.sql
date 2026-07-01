-- Story 11.19: ai_usage_log (AI 사용 로그 — 호출 단위 비용 관측).
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "ai_usage_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "feature" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "purpose" text NOT NULL,
  "persona_id" uuid,
  "job_id" uuid,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" numeric(10, 6) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "ai_usage_log_created_idx" ON "ai_usage_log" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_log_provider_model_idx" ON "ai_usage_log" ("provider", "model");
CREATE INDEX IF NOT EXISTS "ai_usage_log_purpose_idx" ON "ai_usage_log" ("purpose");
CREATE INDEX IF NOT EXISTS "ai_usage_log_feature_idx" ON "ai_usage_log" ("feature");
