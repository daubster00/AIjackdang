DO $$ BEGIN
 CREATE TYPE "public"."ad_device" AS ENUM('all', 'pc', 'mobile');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ad_type" AS ENUM('adsense', 'direct_banner', 'text', 'affiliate', 'internal');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TYPE "public"."sanction_type" ADD VALUE IF NOT EXISTS 'message_restriction';--> statement-breakpoint
ALTER TYPE "public"."comment_status" ADD VALUE IF NOT EXISTS 'hidden' BEFORE 'deleted';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "point_rules" (
	"action_type" text PRIMARY KEY NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"placement" text NOT NULL,
	"device" "ad_device" DEFAULT 'all' NOT NULL,
	"ad_type" "ad_type" DEFAULT 'direct_banner' NOT NULL,
	"start_date" date,
	"end_date" date,
	"click_url" text,
	"code" text,
	"image_url" text,
	"memo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "condition" text;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "auto_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "hidden_by_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_slot_id_ad_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."ad_slots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_impressions_slot_id_idx" ON "ad_impressions" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_slots_placement_idx" ON "ad_slots" USING btree ("placement");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_slots_is_active_idx" ON "ad_slots" USING btree ("is_active");
