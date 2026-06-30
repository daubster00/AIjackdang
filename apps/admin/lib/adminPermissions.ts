/**
 * 클라이언트 안전(client-safe) 권한 헬퍼.
 *
 * `@ai-jakdang/auth` 배럴(index)은 `adminAuth`(better-auth + @node-rs/argon2,
 * 서버 전용)까지 함께 re-export 하므로, 클라이언트 컴포넌트에서 직접 import 하면
 * argon2 가 브라우저 번들로 끌려와 빌드가 깨진다.
 *
 * 권한 매트릭스 같은 클라이언트 표시용 컴포넌트는 순수 함수만 필요하므로,
 * `packages/auth/src/permissions.ts`(source of truth)의 정의를 여기에 복제해
 * 서버 전용 의존성 없이 사용한다. 정의가 바뀌면 두 곳을 함께 갱신할 것.
 */

export type AdminRole = "staff" | "super_admin";

export type AdminAction =
  | "content:hide"
  | "content:delete"
  | "report:process"
  | "member:sanction"
  | "member:role-change"
  | "site:settings"
  | "ads:manage"
  | "admin:approve";

/** 모든 AdminAction 목록 (권한 매트릭스 렌더에 사용). */
export const ALL_ADMIN_ACTIONS: AdminAction[] = [
  "content:hide",
  "content:delete",
  "report:process",
  "member:sanction",
  "member:role-change",
  "site:settings",
  "ads:manage",
  "admin:approve",
];

const STAFF_ACTIONS = new Set<AdminAction>([
  "content:hide",
  "report:process",
  "member:sanction",
]);

const SUPER_ADMIN_ACTIONS = new Set<AdminAction>([
  "content:hide",
  "report:process",
  "member:sanction",
  "content:delete",
  "member:role-change",
  "site:settings",
  "ads:manage",
  "admin:approve",
]);

/**
 * 코드 기본값 기반 권한 확인 (동기, DB 오버라이드 미포함).
 * DB 오버라이드까지 반영한 실효 권한은 API에서 GET /admin/permissions 로 가져오세요.
 */
export function hasAdminPermission(role: AdminRole, action: AdminAction): boolean {
  if (role === "super_admin") return SUPER_ADMIN_ACTIONS.has(action);
  if (role === "staff") return STAFF_ACTIONS.has(action);
  return false;
}

/**
 * 코드 기본값에 API에서 받은 오버라이드 매트릭스를 적용하여 실효 권한을 반환한다.
 * super_admin은 항상 전부 true.
 * @param apiMatrix GET /api/v1/admin/permissions 응답의 matrix 객체
 */
export function resolveEffectivePermissions(
  apiMatrix: Partial<Record<AdminRole, Partial<Record<AdminAction, boolean>>>> | null,
): Record<AdminRole, Record<AdminAction, boolean>> {
  const result = {
    staff: {} as Record<AdminAction, boolean>,
    super_admin: {} as Record<AdminAction, boolean>,
  };

  for (const action of ALL_ADMIN_ACTIONS) {
    result.staff[action] = apiMatrix?.staff?.[action] ?? hasAdminPermission("staff", action);
    result.super_admin[action] = true; // super_admin 항상 전부 허용
  }

  return result;
}
