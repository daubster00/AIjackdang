-- ⚠️ Epic 3/4 확장 시 이 파일에 새 마이그레이션 추가 금지 — 반드시 새 번호의 파일로 분리 생성할 것 (AR-2 마이그레이션 단일 소유권 원칙)
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'hidden', 'deleted');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"board" varchar(50) NOT NULL,
	"category" varchar(50),
	"title" varchar(300) NOT NULL,
	"slug" varchar(350) NOT NULL,
	"content_json" jsonb NOT NULL,
	"summary" varchar(500),
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "taggable" (
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "taggable_target_type_target_id_tag_id_pk" PRIMARY KEY("target_type","target_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggable" ADD CONSTRAINT "taggable_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_user_id_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_board_idx" ON "posts" USING btree ("board");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "posts_board_status_idx" ON "posts" USING btree ("board","status");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_uq" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "taggable_target_idx" ON "taggable" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "taggable_tag_id_idx" ON "taggable" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");