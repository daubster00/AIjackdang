/**
 * 권한 규칙 (비시각적 공유 코드).
 *
 * 핵심 원칙: 권한 검사는 클라이언트가 아니라 API 서버에서 수행한다.
 * 이 모듈은 웹/관리자/API 가 동일한 권한 정의를 공유하기 위한 타입과
 * 순수 함수만 제공한다. 실제 세션 검증은 API 서버가 담당한다.
 */

/** 사용자 역할. 관리자 기능은 admin 만 접근할 수 있다. */
export type Role = "member" | "admin";

/** 시스템에서 검사하는 권한 단위. */
export type Permission =
  | "post:create"
  | "post:update:own"
  | "post:moderate"
  | "resource:download"
  | "admin:access"
  | "admin:manage-members";

/** 역할별로 부여되는 권한 집합. */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  member: new Set<Permission>(["post:create", "post:update:own", "resource:download"]),
  admin: new Set<Permission>([
    "post:create",
    "post:update:own",
    "post:moderate",
    "resource:download",
    "admin:access",
    "admin:manage-members",
  ]),
};

/** 주어진 역할이 특정 권한을 가지는지 검사한다. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** 관리자 애플리케이션 접근 가능 여부. 관리자 라우트 가드에서 사용한다. */
export function canAccessAdmin(role: Role): boolean {
  return hasPermission(role, "admin:access");
}
