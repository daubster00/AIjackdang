-- Epic9 관리자 수정요청 일괄 — 스키마 변경 (오케스트레이터 단독 소유)
-- 1) 뱃지(업적뱃지) 기능 전면 삭제: user_badges · badges 테이블 DROP
-- 2) 접속통계 페이지별 머문시간: page_views.dwell_ms 컬럼 추가
-- 3) 권한 설정 실동작: admin_role_permissions 테이블(역할별 권한 오버라이드) 신설

-- ── 1. 뱃지 테이블 삭제 ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS "user_badges";
DROP TABLE IF EXISTS "badges";

-- ── 2. 페이지별 머문시간(ms) ─────────────────────────────────────────────────
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "dwell_ms" integer;

-- ── 3. 역할별 권한 오버라이드 ────────────────────────────────────────────────
-- role: admin_role enum('staff'|'super_admin'), action: 권한 키, allowed: 허용 여부
CREATE TABLE IF NOT EXISTS "admin_role_permissions" (
  "role"       "admin_role" NOT NULL,
  "action"     text NOT NULL,
  "allowed"    boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "admin_role_permissions_pk" PRIMARY KEY ("role", "action")
);

-- 기본값 시드: staff(일반 운영자)는 콘텐츠 숨김·신고 처리·회원 제재 3종 허용
INSERT INTO "admin_role_permissions" ("role", "action", "allowed") VALUES
  ('staff', 'content:hide', true),
  ('staff', 'report:process', true),
  ('staff', 'member:sanction', true),
  ('staff', 'content:delete', false),
  ('staff', 'member:role-change', false),
  ('staff', 'site:settings', false),
  ('staff', 'ads:manage', false),
  ('staff', 'admin:approve', false)
ON CONFLICT ("role", "action") DO NOTHING;
