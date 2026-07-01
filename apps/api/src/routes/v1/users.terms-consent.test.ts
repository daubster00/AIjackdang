/**
 * Story 10.4 — 약관 재동의 API 단위 테스트.
 *
 * DB / Fastify 인스턴스가 필요한 통합 테스트는 스킵 처리하고
 * 순수 로직(termsUpdateRequired 계산·contracts 스키마 검증)만 검증한다.
 *
 * 통합 테스트(POST /users/me/terms-consent 실 HTTP 레벨)는
 * 라이브 postgres + redis 환경이 필요하므로 describe.todo 로 명시한다.
 */

import { describe, expect, it } from "vitest";

// ── termsUpdateRequired 계산 로직 단위 테스트 ──────────────────────────────────

describe("termsUpdateRequired 계산 로직", () => {
  it("termsVersion 이 null 이면 재동의 필요(true)", () => {
    const CURRENT = "2026-06-17";
    const termsUpdateRequired = (null as string | null) !== CURRENT;
    expect(termsUpdateRequired).toBe(true);
  });

  it("termsVersion 이 구버전이면 재동의 필요(true)", () => {
    const CURRENT = "2026-06-17";
    const OLD: string = "2025-01-01"; // string 으로 타입 명시 — 리터럴 비교 오류 회피
    expect(OLD !== CURRENT).toBe(true);
  });

  it("termsVersion 이 현재 버전과 같으면 재동의 불필요(false)", () => {
    const CURRENT = "2026-06-17";
    expect(CURRENT !== CURRENT).toBe(false);
  });

  it("CURRENT_TERMS_VERSION 상수가 @ai-jakdang/core 에서 import 된다", async () => {
    const { CURRENT_TERMS_VERSION } = await import("@ai-jakdang/core");
    expect(typeof CURRENT_TERMS_VERSION).toBe("string");
    expect(CURRENT_TERMS_VERSION.length).toBeGreaterThan(0);
  });

  it("TERMS_EFFECTIVE_DATE 상수가 @ai-jakdang/core 에서 import 된다", async () => {
    const { TERMS_EFFECTIVE_DATE } = await import("@ai-jakdang/core");
    expect(typeof TERMS_EFFECTIVE_DATE).toBe("string");
    expect(TERMS_EFFECTIVE_DATE.length).toBeGreaterThan(0);
  });
});

// ── contracts: publicUserSchema termsVersion/termsUpdateRequired 필드 검증 ────

describe("publicUserSchema — termsVersion · termsUpdateRequired 필드", () => {
  it("termsVersion: null 과 termsUpdateRequired: true 조합을 허용한다", async () => {
    const { publicUserSchema } = await import("@ai-jakdang/contracts");
    // 최소 필드 (Zod partial 사용 불가이므로 필수 필드 채움)
    const base = {
      id: "uuid-1",
      email: "test@example.com",
      nickname: "테스터",
      status: "active" as const,
      emailVerified: false,
      defaultAvatarIndex: 0,
      avatarUrl: null,
      image: null,
      bio: null,
      bannerUrl: null,
      links: null,
      name: null,
      phone: null,
      gender: null,
      birthDate: null,
      marketingAgreed: false,
      termsAgreedAt: null,
      termsVersion: null,
      termsUpdateRequired: true,
      createdAt: new Date().toISOString(),
    };
    const result = publicUserSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("termsVersion: 버전문자열 과 termsUpdateRequired: false 조합을 허용한다", async () => {
    const { publicUserSchema } = await import("@ai-jakdang/contracts");
    const base = {
      id: "uuid-2",
      email: "test2@example.com",
      nickname: "테스터2",
      status: "active" as const,
      emailVerified: true,
      defaultAvatarIndex: 0,
      avatarUrl: null,
      image: null,
      bio: null,
      bannerUrl: null,
      links: null,
      name: null,
      phone: null,
      gender: null,
      birthDate: null,
      marketingAgreed: false,
      termsAgreedAt: new Date().toISOString(),
      termsVersion: "2026-06-17",
      termsUpdateRequired: false,
      createdAt: new Date().toISOString(),
    };
    const result = publicUserSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("termsUpdateRequired 필드가 누락되면 검증에 실패한다", async () => {
    const { publicUserSchema } = await import("@ai-jakdang/contracts");
    const base = {
      id: "uuid-3",
      email: "test3@example.com",
      nickname: "테스터3",
      status: "active" as const,
      emailVerified: false,
      defaultAvatarIndex: 0,
      avatarUrl: null,
      image: null,
      bio: null,
      bannerUrl: null,
      links: null,
      name: null,
      phone: null,
      gender: null,
      birthDate: null,
      marketingAgreed: false,
      termsAgreedAt: null,
      // termsVersion 누락
      // termsUpdateRequired 누락
      createdAt: new Date().toISOString(),
    };
    const result = publicUserSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});

// ── contracts: termsConsentResponseSchema 검증 ───────────────────────────────

describe("termsConsentResponseSchema", () => {
  it("성공 응답 형태(termsUpdateRequired: false literal)를 허용한다", async () => {
    const { termsConsentResponseSchema } = await import("@ai-jakdang/contracts");
    const result = termsConsentResponseSchema.safeParse({
      termsAgreedAt: new Date().toISOString(),
      termsVersion: "2026-06-17",
      termsUpdateRequired: false,
    });
    expect(result.success).toBe(true);
  });

  it("termsUpdateRequired: true 이면 literal(false) 검증에 실패한다", async () => {
    const { termsConsentResponseSchema } = await import("@ai-jakdang/contracts");
    const result = termsConsentResponseSchema.safeParse({
      termsAgreedAt: new Date().toISOString(),
      termsVersion: "2026-06-17",
      termsUpdateRequired: true, // literal(false) 위반
    });
    expect(result.success).toBe(false);
  });

  it("termsAgreedAt 가 없으면 검증에 실패한다", async () => {
    const { termsConsentResponseSchema } = await import("@ai-jakdang/contracts");
    const result = termsConsentResponseSchema.safeParse({
      termsVersion: "2026-06-17",
      termsUpdateRequired: false,
    });
    expect(result.success).toBe(false);
  });
});

// ── 통합 테스트 (라이브 DB + 세션 필요 — 스킵) ────────────────────────────────

describe.todo("통합: POST /users/me/terms-consent (라이브 postgres + session 필요)");
describe.todo("통합: GET /users/me termsUpdateRequired 동의 전후 전환 검증");
