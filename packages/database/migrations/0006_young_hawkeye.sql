CREATE TYPE "public"."resource_file_status" AS ENUM('active', 'deleted');--> statement-breakpoint
ALTER TABLE "resource_files" ADD COLUMN "file_status" "resource_file_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "resource_files_file_status_idx" ON "resource_files" USING btree ("file_status");