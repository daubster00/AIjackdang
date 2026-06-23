/**
 * auth-api.ts 단위 테스트 (Story 1.4 Task 6.1).
 *
 * signIn 에러 코드 분기 및 signOut/getSession 동작 검증.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { signIn, signOut, getSession } from "./auth-api";

// fetch 전역 모킹
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

// ── signIn ─────────────────────────────────────────────────────────────────────

describe("signIn", () => {
  it("성공 시 ok:true와 user를 반환한다 (AC #1)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "user-1",
          email: "test@example.com",
          nickname: "테스터",
          status: "active",
          emailVerified: true,
          defaultAvatarIndex: 0,
          avatarUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    });

    const result = await signIn("test@example.com", "password123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.nickname).toBe("테스터");
    }
  });

  it("401 응답 시 INVALID_CREDENTIALS 반환 (AC #3)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: "INVALID_CREDENTIALS" }),
    });

    const result = await signIn("test@example.com", "wrongpassword");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
      expect(result.message).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  });

  it("이메일 미인증 시 EMAIL_NOT_VERIFIED 반환 (AC #3)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: "EMAIL_NOT_VERIFIED" }),
    });

    const result = await signIn("test@example.com", "password123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_NOT_VERIFIED");
    }
  });

  it("이메일 미인증 (소문자 코드) 시 EMAIL_NOT_VERIFIED 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: "email_not_verified" }),
    });

    const result = await signIn("test@example.com", "password123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_NOT_VERIFIED");
    }
  });

  it("suspended 계정 로그인 시 ACCOUNT_SUSPENDED 반환 (AC #3)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "user-2",
          email: "banned@example.com",
          nickname: "정지유저",
          status: "suspended",
          emailVerified: true,
          defaultAvatarIndex: 0,
          avatarUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    });

    const result = await signIn("banned@example.com", "password123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ACCOUNT_SUSPENDED");
    }
  });

  it("429 응답 시 RATE_LIMIT_EXCEEDED 반환 (AC #4)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    const result = await signIn("test@example.com", "password123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMIT_EXCEEDED");
    }
  });

  it("네트워크 오류 시 NETWORK_ERROR 반환", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));

    const result = await signIn("test@example.com", "password123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NETWORK_ERROR");
    }
  });
});

// ── signOut ────────────────────────────────────────────────────────────────────

describe("signOut", () => {
  it("POST /api/v1/auth/sign-out 를 호출한다 (AC #5)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await signOut();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/auth/sign-out",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("실패해도 예외를 던지지 않는다 (graceful)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));

    await expect(signOut()).resolves.toBeUndefined();
  });
});

// ── getSession ─────────────────────────────────────────────────────────────────

describe("getSession", () => {
  it("로그인 상태에서 세션 데이터를 반환한다 (AC #2)", async () => {
    const mockSession = {
      user: {
        id: "user-1",
        email: "test@example.com",
        nickname: "테스터",
        status: "active",
        emailVerified: true,
        defaultAvatarIndex: 0,
        avatarUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      session: { id: "session-1", expiresAt: "2026-12-31T00:00:00.000Z" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSession,
    });

    const result = await getSession();
    expect(result).not.toBeNull();
    expect(result?.user.nickname).toBe("테스터");
  });

  it("비로그인 상태에서 null을 반환한다", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await getSession();
    expect(result).toBeNull();
  });

  it("cookieHeader를 포워딩한다 (서버 컴포넌트용)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    await getSession("aj_session=test-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/auth/get-session",
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: "aj_session=test-token" }),
      }),
    );
  });
});
