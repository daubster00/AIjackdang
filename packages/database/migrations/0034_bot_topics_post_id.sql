-- 발굴·실시간 주제를 게시 시 기록하고, 게시글 영구삭제 시 함께 지우기 위한 링크 컬럼.
-- 같은 주제 중복 작성 방지(getRecentTopicTitles가 이 기록을 읽어 발굴에서 회피)를 위해
-- 게시된 주제를 bot_topics에 남기고, post_id로 게시글과 연결한다.
ALTER TABLE "bot_topics" ADD COLUMN IF NOT EXISTS "post_id" uuid;
CREATE INDEX IF NOT EXISTS "bot_topics_post_id_idx" ON "bot_topics" ("post_id");
