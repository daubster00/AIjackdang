CREATE TABLE "link_previews" (
	"url" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"site_name" text,
	"fetched_at" timestamp with time zone,
	"error_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "search_vector" text GENERATED ALWAYS AS (title || ' ' || coalesce(content_json::text, '')) STORED;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "search_vector" text GENERATED ALWAYS AS (title || ' ' || coalesce(content_json::text, '')) STORED;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "search_vector" text GENERATED ALWAYS AS (title || ' ' || coalesce(description_json::text, '')) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_search_vector_idx" ON "posts" USING GIN ("search_vector" gin_bigm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_search_vector_idx" ON "questions" USING GIN ("search_vector" gin_bigm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resources_search_vector_idx" ON "resources" USING GIN ("search_vector" gin_bigm_ops);