-- 쪽지 휴지통(soft-delete → trash → 영구삭제) 컬럼 추가
-- 수정요청 123/124: 삭제 시 즉시 사라지지 않고 휴지통으로, 휴지통에서 영구삭제·30일 자동삭제
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "trashed_by_sender_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "trashed_by_receiver_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "purged_by_sender"   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "purged_by_receiver" boolean NOT NULL DEFAULT false;
