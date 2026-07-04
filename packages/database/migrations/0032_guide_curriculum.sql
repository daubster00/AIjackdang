-- Epic 13: 가이드 커리큘럼 스키마.
-- bot_curriculum_series(시리즈 헤더)·bot_curriculum_chapters(편)·bot_curriculum_image_slots(이미지 슬롯) 3테이블.
-- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4]
-- 멱등 처리: CREATE TYPE 은 DO 가드, CREATE TABLE/ADD CONSTRAINT 은 IF NOT EXISTS.

-- ── pgEnum 3종 ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "bot_curriculum_chapter_status" AS ENUM ('planned', 'drafted', 'ready', 'published', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_curriculum_slot_source_kind" AS ENUM ('ai_diagram', 'web_download', 'capture', 'user_upload');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "bot_curriculum_slot_status" AS ENUM ('pending', 'ready');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_curriculum_series (시리즈 헤더) ───────────────────────────────────────
-- title 은 guide_progress 키 기준 unique 보장.

CREATE TABLE IF NOT EXISTS "bot_curriculum_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "board" text NOT NULL,
  "tool" text NOT NULL,
  "intro" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_curriculum_series_title_uq" UNIQUE("title")
);

-- ── bot_curriculum_chapters (챕터 = 편) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "bot_curriculum_chapters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "series_id" uuid NOT NULL,
  "order_index" integer NOT NULL,
  "title" text NOT NULL,
  "goal" text NOT NULL,
  "outline" jsonb NOT NULL DEFAULT '[]',
  "draft_content" jsonb,
  "draft_text_editable" text,
  "continuity_summary" text,
  "status" "bot_curriculum_chapter_status" NOT NULL DEFAULT 'planned',
  "scheduled_at" timestamp with time zone,
  "published_post_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_curriculum_chapters_series_order_uq" UNIQUE("series_id", "order_index")
);
DO $$ BEGIN
  ALTER TABLE "bot_curriculum_chapters" ADD CONSTRAINT "bot_curriculum_chapters_series_id_fk"
    FOREIGN KEY ("series_id") REFERENCES "bot_curriculum_series"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── bot_curriculum_image_slots (챕터의 이미지 자리) ───────────────────────────

CREATE TABLE IF NOT EXISTS "bot_curriculum_image_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL,
  "asset_key" text NOT NULL,
  "caption" text NOT NULL,
  "alt" text NOT NULL,
  "guidance" text,
  "position_hint" text,
  "source_kind" "bot_curriculum_slot_source_kind" NOT NULL,
  "status" "bot_curriculum_slot_status" NOT NULL DEFAULT 'pending',
  "image_url" text,
  "diagram_prompt" text,
  "source_url" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_curriculum_image_slots_chapter_asset_key_uq" UNIQUE("chapter_id", "asset_key")
);
DO $$ BEGIN
  ALTER TABLE "bot_curriculum_image_slots" ADD CONSTRAINT "bot_curriculum_image_slots_chapter_id_fk"
    FOREIGN KEY ("chapter_id") REFERENCES "bot_curriculum_chapters"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
