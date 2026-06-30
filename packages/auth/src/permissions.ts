/**
 * Permissions (ADR-0003 based).
 *
 * - Users (site members) have no roles.
 * - Only admins have AdminRole (staff | super_admin).
 * - Permission checks are performed on the API server.
 */

// -- User role --
export type UserRole = "member";

// -- User session type --
export interface UserSession {
  id: string;
  userId: string;
  email: string;
  nickname: string;
  status: "active" | "suspended" | "withdrawn";
  emailVerified: boolean;
}

// -- Admin role --
export type AdminRole = "staff" | "super_admin";

/** Admin account status. pending = awaiting approval, active = normal, suspended/disabled = blocked. */
export type AdminStatus = "pending" | "active" | "suspended" | "disabled";

// -- Admin session type --
export interface AdminSession {
  id: string;
  adminUserId: string;
  role: AdminRole;
  status: AdminStatus;
}

// -- AdminPermission --
export type AdminPermission =
  | "post:moderate"
  | "member:view"
  | "member:sanction"
  | "member:manage"
  | "admin:approve"
  | "admin:manage"
  | "site:settings"
  | "content:delete"
  | "ad:manage";

const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  staff: new Set<AdminPermission>([
    "post:moderate",
    "member:view",
    "member:sanction",
    "member:manage",
  ]),
  super_admin: new Set<AdminPermission>([
    "post:moderate",
    "member:view",
    "member:sanction",
    "member:manage",
    "admin:approve",
    "admin:manage",
    "site:settings",
    "content:delete",
    "ad:manage",
  ]),
};

// -- AdminAction (Story 9.1 AC#4) --
export type AdminAction =
  | "content:hide"
  | "content:delete"
  | "report:process"
  | "member:sanction"
  | "member:role-change"
  | "site:settings"
  | "ads:manage"
  | "admin:approve";

/** 모든 AdminAction 목록 (권한 매트릭스 렌더·API에서 유효성 검사에 사용). */
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

// -- Utility functions --

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].has(permission);
}

/**
 * 코드 기본값 기반 권한 확인 (동기, DB 오버라이드 미포함).
 * DB 오버라이드까지 반영한 실효 권한은 resolveEffectivePermissions()를 사용하세요.
 */
export function hasAdminPermission(role: AdminRole, action: AdminAction): boolean {
  if (role === "super_admin") return SUPER_ADMIN_ACTIONS.has(action);
  if (role === "staff") return STAFF_ACTIONS.has(action);
  return false;
}

/** DB 오버라이드 항목 타입 (admin_role_permissions 테이블 행). */
export interface AdminPermissionOverride {
  role: AdminRole;
  action: string;
  allowed: boolean;
}

/**
 * 코드 기본값에 DB 오버라이드를 병합하여 실효 권한 매트릭스를 반환한다.
 * super_admin은 오버라이드와 무관하게 모든 액션이 항상 true.
 */
export function resolveEffectivePermissions(
  overrides: AdminPermissionOverride[],
): Record<AdminRole, Record<AdminAction, boolean>> {
  const result = {
    staff: {} as Record<AdminAction, boolean>,
    super_admin: {} as Record<AdminAction, boolean>,
  };

  for (const action of ALL_ADMIN_ACTIONS) {
    result.staff[action] = hasAdminPermission("staff", action);
    result.super_admin[action] = true; // super_admin 항상 전부 허용
  }

  // DB 오버라이드 적용 (staff 만)
  for (const ov of overrides) {
    if (ov.role === "super_admin") continue;
    if (ALL_ADMIN_ACTIONS.includes(ov.action as AdminAction)) {
      result.staff[ov.action as AdminAction] = ov.allowed;
    }
  }

  return result;
}

export function canAccessAdmin(role: AdminRole, status: AdminStatus): boolean {
  return status === "active" && (role === "staff" || role === "super_admin");
}

export function canAccessAdminSession(session: AdminSession): boolean {
  return canAccessAdmin(session.role, session.status);
}

export function isAuthenticated(session: UserSession | null): boolean {
  return session !== null && session.status === "active";
}
