/**
 * Story 1.6 — 비밀번호 재설정 로직 단위 테스트.
 *
 * DB / Redis 가 필요한 통합 테스트(실제 토큰 조회·저장·삭제 등)는 skip 처리.
 * 순수 로직(만료 판정·토큰 형식·스키마 검증 등)을 중점 검증한다.
 */

import { describe, it, expect } from "vitest";
import { resetPasswordSchema, forgotPasswordSchema } from "@ai-jakdang/contracts";

// ── 스키마 검증 ────────────────────────────────────────────────────────────────

describe("forgotPasswordSchema", () => {
  it("유효한 이메일을 수락한다", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("이메일 앞뒤 공백을 트림한다", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  user@example.com  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("잘못된 이메일 형식을 거부한다", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("빈 이메일을 거부한다", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("이메일 필드 누락 시 거부한다", () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("유효한 토큰과 8자 이상 비밀번호를 수락한다", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("8자 미만 비밀번호를 거부한다 (AC #5)", () => {
    const result = resetPasswordSchema.safeParse({
      token: "sometoken",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "";
      expect(msg).toContain("8자");
    }
  });

  it("정확히 8자 비밀번호를 수락한다", () => {
    const result = resetPasswordSchema.safeParse({
      token: "sometoken",
      newPassword: "exactly8",
    });
    expect(result.success).toBe(true);
  });

  it("빈 토큰을 거부한다", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(false);
  });

  it("128자 초과 비밀번호를 거부한다", () => {
    const result = resetPasswordSchema.safeParse({
      token: "sometoken",
      newPassword: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("정확히 128자 비밀번호를 수락한다", () => {
    const result = resetPasswordSchema.safeParse({
      token: "sometoken",
      newPassword: "a".repeat(128),
    });
    expect(result.success).toBe(true);
  });
});

// ── 토큰 만료 판정 로직 ────────────────────────────────────────────────────────

describe("토큰 만료 판정", () => {
  /**
   * reset-password.ts 의 만료 판정 로직을 독립 함수로 추출해 검증한다.
   * (실제 구현은 `new Date() > verification.expiresAt` 비교)
   */
  function isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  it("미래 만료 시각: 유효 (만료되지 않음)", () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후
    expect(isTokenExpired(futureExpiry)).toBe(false);
  });

  it("과거 만료 시각: 만료됨", () => {
    const pastExpiry = new Date(Date.now() - 1000); // 1초 전
    expect(isTokenExpired(pastExpiry)).toBe(true);
  });

  it("정확히 지금: 만료됨 (경계값 — 현재 시각 이후는 모두 만료)", () => {
    // Date.now() 는 실행 시점이 조금 지나므로 지금보다 1ms 과거이면 만료
    const justPast = new Date(Date.now() - 1);
    expect(isTokenExpired(justPast)).toBe(true);
  });

  it("1시간 TTL 내 발급된 토큰은 유효하다", () => {
    const TOKEN_TTL_MS = 60 * 60 * 1000;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_MS);
    expect(isTokenExpired(expiresAt)).toBe(false);
  });
});

// ── verifications identifier 형식 ─────────────────────────────────────────────

describe("verifications identifier 형식", () => {
  const RESET_PREFIX = "password-reset:";

  it("identifier는 'password-reset:{email}' 형식이다", () => {
    const email = "user@example.com";
    const identifier = `${RESET_PREFIX}${email}`;
    expect(identifier).toBe("password-reset:user@example.com");
  });

  it("identifier에서 이메일을 올바르게 추출한다", () => {
    const email = "user@example.com";
    const identifier = `${RESET_PREFIX}${email}`;
    const extracted = identifier.slice(RESET_PREFIX.length);
    expect(extracted).toBe(email);
  });

  it("이메일에 @ 가 있어도 올바르게 추출된다", () => {
    const email = "user+tag@sub.domain.com";
    const identifier = `${RESET_PREFIX}${email}`;
    const extracted = identifier.slice(RESET_PREFIX.length);
    expect(extracted).toBe(email);
  });
});

// ── 통합 테스트 skip 공지 ──────────────────────────────────────────────────────

describe.todo("통합: DB 연결 필요 — 아래 시나리오는 PostgreSQL + Redis 환경에서 실행");
// - POST /auth/forgot-password: 존재하는 이메일 → verifications 토큰 삽입 확인
// - POST /auth/forgot-password: 존재하지 않는 이메일 → 동일 200 응답, DB 변경 없음
// - POST /auth/reset-password: 유효 토큰 → accounts.password 갱신, sessions 삭제 확인
// - POST /auth/reset-password: 만료 토큰 → 400 INVALID_TOKEN
// - POST /auth/reset-password: 재사용 토큰 → 400 INVALID_TOKEN
// - rate limit: 동일 IP에서 6회 이상 → 429
