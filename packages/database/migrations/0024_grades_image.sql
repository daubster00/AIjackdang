-- 등급(grades) 뱃지 이미지 URL 컬럼 추가.
-- 관리자 등급 관리에서 등급별 뱃지 이미지를 업로드/표시하기 위함.
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "image_url" text;
