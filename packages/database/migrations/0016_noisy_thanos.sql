ALTER TABLE "posts" ADD COLUMN "is_notice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_main_featured" boolean DEFAULT false NOT NULL;