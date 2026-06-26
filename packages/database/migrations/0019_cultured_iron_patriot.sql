ALTER TABLE "users" ADD COLUMN "featured_post_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "rating" smallint;