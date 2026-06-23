import { describe, expect, it } from "vitest";
import { canAccessAdmin, hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("일반 회원은 글 작성 권한을 가진다", () => {
    expect(hasPermission("member", "post:create")).toBe(true);
  });

  it("일반 회원은 운영(moderate) 권한이 없다", () => {
    expect(hasPermission("member", "post:moderate")).toBe(false);
  });

  it("관리자는 회원 관리 권한을 가진다", () => {
    expect(hasPermission("admin", "admin:manage-members")).toBe(true);
  });
});

describe("canAccessAdmin", () => {
  it("관리자만 관리자 앱에 접근할 수 있다", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("member")).toBe(false);
  });
});
