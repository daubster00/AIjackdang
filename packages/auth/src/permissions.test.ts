import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  hasPermission,
  isAuthenticated,
  type UserSession,
} from "./permissions";

describe("hasPermission — 관리자 권한", () => {
  it("staff 는 게시글 운영(moderate) 권한을 가진다", () => {
    expect(hasPermission("staff", "post:moderate")).toBe(true);
  });

  it("staff 는 회원 목록 조회 권한을 가진다", () => {
    expect(hasPermission("staff", "member:view")).toBe(true);
  });

  it("staff 는 관리자 승인 권한이 없다 (super_admin 전용)", () => {
    expect(hasPermission("staff", "admin:approve")).toBe(false);
  });

  it("staff 는 사이트 설정 권한이 없다 (super_admin 전용)", () => {
    expect(hasPermission("staff", "site:settings")).toBe(false);
  });

  it("super_admin 은 모든 권한을 가진다", () => {
    expect(hasPermission("super_admin", "admin:approve")).toBe(true);
    expect(hasPermission("super_admin", "admin:manage")).toBe(true);
    expect(hasPermission("super_admin", "site:settings")).toBe(true);
    expect(hasPermission("super_admin", "content:delete")).toBe(true);
    expect(hasPermission("super_admin", "ad:manage")).toBe(true);
  });

  it("super_admin 도 일반 운영 권한을 가진다", () => {
    expect(hasPermission("super_admin", "post:moderate")).toBe(true);
    expect(hasPermission("super_admin", "member:sanction")).toBe(true);
  });
});

describe("canAccessAdmin — 관리자 앱 접근", () => {
  it("active 상태 staff 는 관리자 앱에 접근할 수 있다", () => {
    expect(canAccessAdmin("staff", "active")).toBe(true);
  });

  it("active 상태 super_admin 은 관리자 앱에 접근할 수 있다", () => {
    expect(canAccessAdmin("super_admin", "active")).toBe(true);
  });

  it("pending 상태 staff 는 관리자 앱에 접근할 수 없다 (승인 대기)", () => {
    expect(canAccessAdmin("staff", "pending")).toBe(false);
  });

  it("suspended 상태 super_admin 은 관리자 앱에 접근할 수 없다", () => {
    expect(canAccessAdmin("super_admin", "suspended")).toBe(false);
  });

  it("disabled 상태는 접근 불가", () => {
    expect(canAccessAdmin("staff", "disabled")).toBe(false);
    expect(canAccessAdmin("super_admin", "disabled")).toBe(false);
  });
});

describe("isAuthenticated — 유저 세션 검사", () => {
  const activeSession: UserSession = {
    id: "session-1",
    userId: "user-1",
    email: "test@example.com",
    nickname: "테스터",
    status: "active",
    emailVerified: true,
  };

  it("활성 세션이 있으면 인증된 상태다", () => {
    expect(isAuthenticated(activeSession)).toBe(true);
  });

  it("세션이 null 이면 미인증 상태다", () => {
    expect(isAuthenticated(null)).toBe(false);
  });

  it("status=suspended 세션은 미인증 처리된다", () => {
    expect(isAuthenticated({ ...activeSession, status: "suspended" })).toBe(false);
  });

  it("status=withdrawn 세션은 미인증 처리된다", () => {
    expect(isAuthenticated({ ...activeSession, status: "withdrawn" })).toBe(false);
  });
});
