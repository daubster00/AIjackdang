/**
 * 권한 규칙 (비시각적 공유 코드) — ADR-0003 기반 리팩터링.
 *
 * 핵심 원칙:
 * - 유저(사이트 회원)는 역할 없음. 모두 일반 회원.
 * - 관리자만 AdminRole(staff | super_admin)을 가짐.
 * - 권한 검사는 클라이언트가 아니라 API 서버에서 수행한다.
 * - 이 모듈은 웹/관리자/API 가 동일한 권한 정의를 공유하기 위한 타입과
 *   순수 함수만 제공한다. 실제 세션 검증은 API 서버가 담당한다.
 */

// ── 유저 세션 타입 ─────────────────────────────────────────────────────────────
// 유저는 역할 없음 — 인증 여부(세션 존재)만으로 판단.

export interface UserSession {
  id: string;
  userId: string;
  email: string;
  nickname: string;
  status: "active" | "suspended" | "withdrawn";
  emailVerified: boolean;
}

// ── 관리자 역할 ────────────────────────────────────────────────────────────────

/** 관리자 역할. 일반 유저에게는 없음. */
export type AdminRole = "staff" | "super_admin";

/** 관리자 계정 상태. pending = 승인 대기, active = 정상, suspended/disabled = 차단. */
export type AdminStatus = "pending" | "active" | "suspended" | "disabled";

// ── 관리자 권한 ────────────────────────────────────────────────────────────────

/**
 * 관리자 기능 권한 단위.
 * staff = 일부 / super_admin = 전체.
 */
export type AdminPermission =
  | "post:moderate"      // 게시글·댓글 숨김/삭제
  | "member:view"        // 회원 목록·상세 조회
  | "member:sanction"    // 회원 제재 (경고/정지/영구정지)
  | "member:manage"      // 회원 탈퇴 처리, 상태 변경
  | "admin:approve"      // 관리자 계정 승인 (super_admin 전용)
  | "admin:manage"       // 관리자 역할·상태 변경 (super_admin 전용)
  | "site:settings"      // 사이트 전역 설정 (super_admin 전용)
  | "content:delete"     // 게시글·자료 영구 삭제 (super_admin 전용)
  | "ad:manage";         // 광고 관리 (super_admin 전용)

/** 역할별로 부여되는 관리자 권한 집합. */
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

// ── 유틸리티 함수 ──────────────────────────────────────────────────────────────

/**
 * 관리자가 특정 권한을 가지는지 검사한다.
 * API 가드에서 사용 — 클라이언트 사용 금지.
 */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].has(permission);
}

/**
 * 관리자 애플리케이션 접근 가능 여부.
 * status=active 이어야만 접근 허용.
 */
export function canAccessAdmin(role: AdminRole, status: AdminStatus): boolean {
  return status === "active" && (role === "staff" || role === "super_admin");
}

/**
 * 유저 세션이 존재하고 활성 상태인지 검사한다.
 * 유저 사이트 행동 게이팅에 사용.
 */
export function isAuthenticated(session: UserSession | null): boolean {
  return session !== null && session.status === "active";
}
