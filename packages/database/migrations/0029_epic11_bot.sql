-- Epic 11: 시딩 봇(Seeding Bot) 스키마.
-- 봇 테이블 9종 + pgEnum 9종 + users.is_bot 컬럼.
-- [Source: docs/seeding-bot/ARCHITECTURE.md#2]
-- 멱등 처리: CREATE TYPE 은 DO 가드, CREATE TABLE/ADD COLUMN 은 IF NOT EXISTS.

-- ── pgEnum 9종 ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "bot_ai_provider" AS ENUM ('openai', 'anthropic', 'google');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_model_purpose" AS ENUM ('generation', 'censor', 'image');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_job_kind" AS ENUM ('post', 'comment', 'reply', 'question', 'resource');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_job_status" AS ENUM ('pending', 'generating', 'censoring', 'held', 'approved', 'published', 'discarded', 'blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_topic_kind" AS ENUM ('fixed', 'realtime', 'auto');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_topic_status" AS ENUM ('unused', 'used', 'cooling');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_hold_reason" AS ENUM ('ambiguous', 'injection_suspect', 'copyright_risk', 'observation_mode');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_hold_decision" AS ENUM ('approved', 'discarded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_event_type" AS ENUM ('post.published', 'comment.published', 'held', 'blocked', 'regenerated', 'skipped', 'cost', 'discarded', 'planned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── users.is_bot ──────────────────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_bot" boolean NOT NULL DEFAULT false;

-- ── bot_personas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_personas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "nickname" varchar(64) NOT NULL,
  "hidden_identity" text,
  "age_job" varchar(128),
  "tone" text,
  "persona_prompt" text,
  "info_ratio" integer NOT NULL DEFAULT 50,
  "intentional_flaws" text,
  "is_admin_persona" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_personas" ADD CONSTRAINT "bot_personas_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_model_assignments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_model_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "provider" "bot_ai_provider" NOT NULL,
  "model" varchar(128) NOT NULL,
  "purpose" "bot_model_purpose" NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_model_assignments_persona_purpose_uq" UNIQUE("persona_id", "purpose")
);
DO $$ BEGIN
  ALTER TABLE "bot_model_assignments" ADD CONSTRAINT "bot_model_assignments_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_persona_boards ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_persona_boards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "board" varchar(64) NOT NULL,
  "weight" integer NOT NULL DEFAULT 1,
  CONSTRAINT "bot_persona_boards_persona_board_uq" UNIQUE("persona_id", "board")
);
DO $$ BEGIN
  ALTER TABLE "bot_persona_boards" ADD CONSTRAINT "bot_persona_boards_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_activity_rhythm ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_activity_rhythm" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "posts_per_week" integer NOT NULL DEFAULT 0,
  "comments_per_week" integer NOT NULL DEFAULT 0,
  "active_hours" jsonb,
  "active_days" jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_activity_rhythm" ADD CONSTRAINT "bot_activity_rhythm_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_topics ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "board" varchar(64) NOT NULL,
  "title_seed" text NOT NULL,
  "topic_kind" "bot_topic_kind" NOT NULL DEFAULT 'fixed',
  "status" "bot_topic_status" NOT NULL DEFAULT 'unused',
  "used_at" timestamp with time zone,
  "series_group" varchar(128),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_topics" ADD CONSTRAINT "bot_topics_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_generation_jobs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_generation_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "job_kind" "bot_job_kind" NOT NULL,
  "target_board" varchar(64),
  "target_post_id" uuid,
  "topic_id" uuid,
  "status" "bot_job_status" NOT NULL DEFAULT 'pending',
  "draft_content" jsonb,
  "censor_result" jsonb,
  "regen_count" integer NOT NULL DEFAULT 0,
  "scheduled_at" timestamp with time zone,
  "published_post_id" uuid,
  "published_comment_id" uuid,
  "cost" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_generation_jobs" ADD CONSTRAINT "bot_generation_jobs_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "bot_generation_jobs" ADD CONSTRAINT "bot_generation_jobs_topic_id_bot_topics_id_fk"
    FOREIGN KEY ("topic_id") REFERENCES "bot_topics"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_hold_queue ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_hold_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "reason" "bot_hold_reason" NOT NULL,
  "decided" boolean NOT NULL DEFAULT false,
  "decision" "bot_hold_decision",
  "decided_at" timestamp with time zone,
  "decided_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_hold_queue" ADD CONSTRAINT "bot_hold_queue_job_id_bot_generation_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "bot_generation_jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_activity_log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "event_type" "bot_event_type" NOT NULL,
  "ref_id" uuid,
  "payload" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "bot_activity_log" ADD CONSTRAINT "bot_activity_log_persona_id_bot_personas_id_fk"
    FOREIGN KEY ("persona_id") REFERENCES "bot_personas"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_settings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ── 인덱스(조회 가속) ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bot_topics_persona_status_idx" ON "bot_topics" ("persona_id", "status");
CREATE INDEX IF NOT EXISTS "bot_generation_jobs_status_idx" ON "bot_generation_jobs" ("status");
CREATE INDEX IF NOT EXISTS "bot_generation_jobs_persona_idx" ON "bot_generation_jobs" ("persona_id");
CREATE INDEX IF NOT EXISTS "bot_hold_queue_decided_idx" ON "bot_hold_queue" ("decided");
CREATE INDEX IF NOT EXISTS "bot_activity_log_persona_created_idx" ON "bot_activity_log" ("persona_id", "created_at");
CREATE INDEX IF NOT EXISTS "bot_activity_log_event_type_idx" ON "bot_activity_log" ("event_type");
CREATE INDEX IF NOT EXISTS "users_is_bot_idx" ON "users" ("is_bot");
