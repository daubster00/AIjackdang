import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canAccessAdminSession,
  hasAdminPermission,
  hasPermission,
  isAuthenticated,
  type AdminSession,
  type UserSession,
} from "./permissions";

describe("hasPermission — 관리자 권한(AdminPermission)", () => {
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

describe("hasAdminPermission — AdminAction 기반 권한 검사 (AC#4)", () => {
  it("staff 는 content:hide 액션을 수행할 수 있다", () => {
    expect(hasAdminPermission("staff", "content:hide")).toBe(true);
  });

  it("staff 는 report:process 액션을 수행할 수 있다", () => {
    expect(hasAdminPermission("staff", "report:process")).toBe(true);
  });

  it("staff 는 member:sanction 액션을 수행할 수 있다", () => {
    expect(hasAdminPermission("staff", "member:sanction")).toBe(true);
  });

  it("staff 는 content:delete 액션을 수행할 수 없다 (super_admin 전용)", () => {
    expect(hasAdminPermission("staff", "content:delete")).toBe(false);
  });

  it("staff 는 member:role-change 액션을 수행할 수 없다 (super_admin 전용)", () => {
    expect(hasAdminPermission("staff", "member:role-change")).toBe(false);
  });

  it("staff 는 site:settings 액션을 수행할 수 없다 (super_admin 전용)", () => {
    expect(hasAdminPermission("staff", "site:settings")).toBe(false);
  });

  it("staff 는 ads:manage 액션을 수행할 수 없다 (super_admin 전용)", () => {
    expect(hasAdminPermission("staff", "ads:manage")).toBe(false);
  });

  it("staff 는 admin:approve 액션을 수행할 수 없다 (super_admin 전용)", () => {
    expect(hasAdminPermission("staff", "admin:approve")).toBe(false);
  });

  it("super_admin 은 모든 AdminAction 을 수행할 수 있다", () => {
    expect(hasAdminPermission("super_admin", "content:hide")).toBe(true);
    expect(hasAdminPermission("super_admin", "content:delete")).toBe(true);
    expect(hasAdminPermission("super_admin", "report:process")).toBe(true);
    expect(hasAdminPermission("super_admin", "member:sanction")).toBe(true);
    expect(hasAdminPermission("super_admin", "member:role-change")).toBe(true);
    expect(hasAdminPermission("super_admin", "site:settings")).toBe(true);
    expect(hasAdminPermission("super_admin", "ads:manage")).toBe(true);
    expect(hasAdminPermission("super_admin", "admin:approve")).toBe(true);
  });
});

describe("canAccessAdmin — 관리자 앱 접근 (role, status 기반)", () => {
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

describe("canAccessAdminSession — 세션 객체 기반 접근 검사 (AC#4)", () => {
  const activeStaffSession: AdminSession = {
    id: "session-1",
    adminUserId: "admin-1",
    role: "staff",
    status: "active",
  };

  const activeSuperSession: AdminSession = {
    id: "session-2",
    adminUserId: "admin-2",
    role: "super_admin",
    status: "active",
  };

  it("active staff 세션은 접근 가능하다", () => {
    expect(canAccessAdminSession(activeStaffSession)).toBe(true);
  });

  it("active super_admin 세션은 접근 가능하다", () => {
    expect(canAccessAdminSession(activeSuperSession)).toBe(true);
  });

  it("pending 세션은 접근 불가하다", () => {
    expect(canAccessAdminSession({ ...activeStaffSession, status: "pending" })).toBe(false);
  });

  it("suspended 세션은 접근 불가하다", () => {
    expect(canAccessAdminSession({ ...activeSuperSession, status: "suspended" })).toBe(false);
  });

  it("disabled 세션은 접근 불가하다", () => {
    expect(canAccessAdminSession({ ...activeStaffSession, status: "disabled" })).toBe(false);
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
