import { describe, expect, it } from "vitest";
import { signUpSchema } from "./auth";

describe("signUpSchema", () => {
  it("올바른 회원가입 입력을 통과시킨다", () => {
    const result = signUpSchema.safeParse({
      email: " user@example.com ",
      password: "password123",
      nickname: "작당회원",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // trim 이 적용되어 공백이 제거된다.
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("짧은 비밀번호를 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "short",
      nickname: "작당회원",
    });
    expect(result.success).toBe(false);
  });

  it("잘못된 이메일을 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      nickname: "작당회원",
    });
    expect(result.success).toBe(false);
  });
});
