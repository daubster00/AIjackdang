-- admin_* 테이블 정합화 (스키마 드리프트 보정)
-- 0015 CREATE TABLE 이 Drizzle 스키마보다 뒤처져 admin_users.email_verified·image,
-- admin_accounts 소셜 토큰 컬럼이 신규 DB 에 없어 최고관리자 시드·admin BetterAuth 가 깨졌다.
-- 개발 DB 는 과거 직접 ALTER 로 이미 존재하므로 IF NOT EXISTS 로 멱등 처리한다.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "image" text;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "access_token" text;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "refresh_token" text;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "id_token" text;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "admin_accounts" ADD COLUMN IF NOT EXISTS "scope" text;
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "admin_verifications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
