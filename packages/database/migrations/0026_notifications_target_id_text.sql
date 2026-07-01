-- notifications.target_id 컬럼을 uuid → text 로 정합화
-- 수정요청 12-5(재수정): 질문 채택/답변 알림의 targetId 는 질문 slug(문자열)인데
-- 기존 컬럼이 uuid 라서 INSERT 가 조용히 실패(invalid input syntax for type uuid) → 알림 미수신.
-- 게시글/댓글 알림은 UUID 문자열을 그대로 저장하므로 text 로 바꿔도 무손상(UUID 도 유효한 text).
-- 멱등 처리: 이미 text 면 스킵.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
      AND column_name = 'target_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "notifications"
      ALTER COLUMN "target_id" TYPE text USING "target_id"::text;
  END IF;
END $$;
