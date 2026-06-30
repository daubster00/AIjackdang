-- M12: 커스텀 관리자 역할 지원.
-- admin_users.role / admin_role_permissions.role 를 admin_role enum → text 로 전환하고,
-- 역할 정의 테이블 admin_roles 를 추가한다. staff/super_admin 은 고정 역할(locked)로 시드.
-- 모든 문장은 멱등(idempotent) — 이미 적용된 DB에서도 안전하게 재실행 가능.

-- 1) role 컬럼: enum(admin_role) → text. (값은 그대로 보존)
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'staff';

ALTER TABLE "admin_role_permissions" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;

-- 2) 더 이상 사용하지 않는 enum 타입 제거 (컬럼이 모두 text 로 전환된 뒤)
DROP TYPE IF EXISTS "admin_role";

-- 3) 역할 정의 테이블
CREATE TABLE IF NOT EXISTS "admin_roles" (
  "key" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "locked" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 4) 고정 기본 역할 시드 (이미 있으면 유지)
INSERT INTO "admin_roles" ("key", "name", "description", "locked") VALUES
  ('super_admin', '마스터', '최고 관리자. 모든 관리 항목에 대한 전체 권한이 고정 부여됩니다.', true),
  ('staff', '운영자', '일반 운영진. 게시글 중재·신고 처리·회원 제재 권한을 보유합니다.', true)
ON CONFLICT ("key") DO NOTHING;
