-- 접속통계 봇 트래픽 정확도 개선
-- page_views 에 방문 UA 원문(user_agent)과 봇 여부 태그(is_bot)를 추가한다.
-- 크롤러/스크래퍼 방문은 삭제하지 않고 is_bot=true 로 태깅만 하며,
-- 접속통계 집계 쿼리는 is_bot=false 조건으로 사람 트래픽만 집계한다.
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "page_views_is_bot_idx" ON "page_views" ("is_bot");
