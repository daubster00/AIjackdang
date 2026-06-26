-- 방문 로그(page_views) 테이블 — 관리자 접속통계 실데이터용
-- 수정요청 4/5: 접속통계·대시보드 방문자 추이를 가짜 데이터에서 실데이터로 전환
CREATE TABLE IF NOT EXISTS "page_views" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "path"           text NOT NULL,
  "visitor_id"     text NOT NULL,
  "user_id"        uuid,
  "referrer"       text,
  "referrer_host"  text,
  "search_keyword" text,
  "created_at"     timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "page_views"
    ADD CONSTRAINT "page_views_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "page_views_created_at_idx"    ON "page_views" ("created_at");
CREATE INDEX IF NOT EXISTS "page_views_visitor_id_idx"    ON "page_views" ("visitor_id");
CREATE INDEX IF NOT EXISTS "page_views_referrer_host_idx" ON "page_views" ("referrer_host");
CREATE INDEX IF NOT EXISTS "page_views_search_keyword_idx" ON "page_views" ("search_keyword");
