CREATE TYPE "public"."cost_type_enum" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TABLE "post_creative_spec" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"media_type" jsonb,
	"tools" jsonb,
	"prompt" text,
	"negative_prompt" text,
	"params" jsonb,
	"postprocess" jsonb,
	"cost_type" "cost_type_enum",
	"time_spent" text,
	"license_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_creative_spec" ADD CONSTRAINT "post_creative_spec_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;