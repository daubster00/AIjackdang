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

export function hasAdminPermission(role: AdminRole, action: AdminAction): boolean {
  if (role === "super_admin") return SUPER_ADMIN_ACTIONS.has(action);
  if (role === "staff") return STAFF_ACTIONS.has(action);
  return false;
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
