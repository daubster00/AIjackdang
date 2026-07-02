import { describe, expect, it } from "vitest";
import { signUpSchema, sessionSchema } from "./auth";

describe("signUpSchema", () => {
  it("올바른 회원가입 입력을 통과시킨다", () => {
    const result = signUpSchema.safeParse({
      email: " user@example.com ",
      password: "password123",
      phone: "010-1234-5678",
      termsAgreed: true,
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
      phone: "010-1234-5678",
      termsAgreed: true,
    });
    expect(result.success).toBe(false);
  });

  it("잘못된 이메일을 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      phone: "010-1234-5678",
      termsAgreed: true,
    });
    expect(result.success).toBe(false);
  });

  it("약관 미동의(termsAgreed=false)를 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      phone: "010-1234-5678",
      termsAgreed: false,
    });
    expect(result.success).toBe(false);
  });

  it("약관 동의 필드 누락을 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      phone: "010-1234-5678",
    });
    expect(result.success).toBe(false);
  });

  it("회원정보 필드를 함께 허용한다", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      name: "홍길동",
      phone: "010-1234-5678",
      gender: "male",
      birthDate: "1990-01-01",
      marketingAgreed: true,
      termsAgreed: true,
    });
    expect(result.success).toBe(true);
  });

  it("휴대폰 누락을 거부한다", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      termsAgreed: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("sessionSchema (Story 1.4 Task 5.1)", () => {
  const validSession = {
    user: {
      id: "user-1",
      email: "test@example.com",
      nickname: "테스터",
      status: "active",
      emailVerified: true,
      defaultAvatarIndex: 0,
      avatarUrl: null,
      image: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: "session-1",
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
  };

  it("유효한 세션 응답을 통과시킨다 (AC #1)", () => {
    const result = sessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("avatarUrl=null을 허용한다", () => {
    const result = sessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user.avatarUrl).toBeNull();
    }
  });

  it("status가 suspended인 경우를 허용한다", () => {
    const result = sessionSchema.safeParse({
      ...validSession,
      user: { ...validSession.user, status: "suspended" },
    });
    expect(result.success).toBe(true);
  });

  it("user.id 누락 시 실패한다", () => {
    const invalid = {
      ...validSession,
      user: { ...validSession.user, id: undefined },
    };
    const result = sessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
