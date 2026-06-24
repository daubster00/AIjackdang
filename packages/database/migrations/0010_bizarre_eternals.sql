CREATE TYPE "public"."post_kind_enum" AS ENUM('request', 'offer');--> statement-breakpoint
CREATE TYPE "public"."recruit_status_enum" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."work_mode_enum" AS ENUM('remote', 'onsite', 'hybrid');--> statement-breakpoint
CREATE TABLE "recruit_post" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"post_kind" "post_kind_enum" NOT NULL,
	"fields" jsonb NOT NULL,
	"recruit_status" "recruit_status_enum" DEFAULT 'open' NOT NULL,
	"budget" text,
	"duration" text,
	"work_mode" "work_mode_enum",
	"contact_method" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "slug" varchar(350) NOT NULL;--> statement-breakpoint
ALTER TABLE "recruit_post" ADD CONSTRAINT "recruit_post_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recruit_post_kind_status" ON "recruit_post" USING btree ("post_kind","recruit_status");--> statement-breakpoint
CREATE INDEX "idx_recruit_post_fields" ON "recruit_post" USING btree ("fields");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_slug_uq" ON "questions" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_slug_unique" UNIQUE("slug");