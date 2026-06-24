/**
 * adminGuard 단위 테스트 (Story 9.1 AC#7).
 *
 * adminGuardHook 의 핵심 로직을 단위 테스트한다.
 * Better Auth 세션 조회(getSession)를 vi.fn() 으로 모킹해 실제 DB 없이 검증한다.
 *
 * 케이스:
 * 1. aj_admin_session 없음 → 401 ADMIN_UNAUTHORIZED
 * 2. 유저 세션(aj_session)만 있음 → 401 (adminAuth.getSession 은 null 반환)
 * 3. pending/suspended/disabled admin session → 401 ADMIN_INACTIVE
 * 4. active admin session → request.adminSession 설정, 다음 핸들러 통과
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

// adminAuth 모듈 모킹
vi.mock("../../../auth/admin-auth.js", () => ({
  adminAuth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// 모킹 후 import
import { adminAuth } from "../../../auth/admin-auth.js";
import { adminGuardHook } from "../../../plugins/adminGuard.js";

/** 테스트용 FastifyRequest 최소 mock 생성 */
function makeRequest(url = "/api/v1/admin/users"): FastifyRequest & { adminSession?: unknown } {
  return {
    url,
    headers: {},
    adminSession: undefined,
  } as unknown as FastifyRequest & { adminSession?: unknown };
}

/** 테스트용 FastifyReply mock 생성 */
function makeReply() {
  const reply = {
    _statusCode: 200,
    _body: undefined as unknown,
    status(code: number) {
      reply._statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply._body = body;
      return reply;
    },
  };
  return reply as unknown as FastifyReply & { _statusCode: number; _body: unknown };
}

describe("adminGuardHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("케이스 1: aj_admin_session 없음 — 401 반환", async () => {
    // getSession이 null 반환 (세션 없음)
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce(null);

    const req = makeRequest();
    const reply = makeReply();

    await adminGuardHook(req, reply);

    expect(reply._statusCode).toBe(401);
    expect((reply._body as { error: { code: string } }).error.code).toBe("ADMIN_UNAUTHORIZED");
  });

  it("케이스 2: 유저 세션(aj_session)만 있음 — 401 반환 (adminAuth는 null)", async () => {
    // 관리자 인스턴스에서 세션 조회 시 null (유저 쿠키로는 관리자 세션 없음)
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce(null);

    const req = makeRequest();
    // 유저 쿠키를 헤더에 흉내냄 (결과는 여전히 null)
    (req as unknown as { headers: Record<string, string> }).headers["cookie"] =
      "aj_session.session_token=fake-user-token";

    const reply = makeReply();

    await adminGuardHook(req, reply);

    expect(reply._statusCode).toBe(401);
    expect((reply._body as { error: { code: string } }).error.code).toBe("ADMIN_UNAUTHORIZED");
  });

  it("케이스 3-a: pending 상태 admin session — 401 ADMIN_INACTIVE 반환", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce({
      user: { id: "admin-1", email: "staff@test.com", name: "테스터", status: "pending", role: "staff" } as never,
      session: {} as never,
    });

    const req = makeRequest();
    const reply = makeReply();

    await adminGuardHook(req, reply);

    expect(reply._statusCode).toBe(401);
    expect((reply._body as { error: { code: string } }).error.code).toBe("ADMIN_INACTIVE");
  });

  it("케이스 3-b: suspended 상태 admin session — 401 ADMIN_INACTIVE 반환", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce({
      user: { id: "admin-2", email: "staff@test.com", name: "테스터", status: "suspended", role: "staff" } as never,
      session: {} as never,
    });

    const req = makeRequest();
    const reply = makeReply();

    await adminGuardHook(req, reply);

    expect(reply._statusCode).toBe(401);
    expect((reply._body as { error: { code: string } }).error.code).toBe("ADMIN_INACTIVE");
  });

  it("케이스 3-c: disabled 상태 admin session — 401 ADMIN_INACTIVE 반환", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce({
      user: { id: "admin-3", email: "super@test.com", name: "관리자", status: "disabled", role: "super_admin" } as never,
      session: {} as never,
    });

    const req = makeRequest();
    const reply = makeReply();

    await adminGuardHook(req, reply);

    expect(reply._statusCode).toBe(401);
    expect((reply._body as { error: { code: string } }).error.code).toBe("ADMIN_INACTIVE");
  });

  it("케이스 4: active admin session — request.adminSession 설정, 가드 통과", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValueOnce({
      user: { id: "admin-4", email: "super@test.com", name: "관리자", status: "active", role: "super_admin" } as never,
      session: {} as never,
    });

    const req = makeRequest();
    const reply = makeReply();

    await adminGuardHook(req, reply);

    // reply.send 가 호출되지 않아야 함 (통과)
    expect(reply._statusCode).toBe(200); // 기본값 그대로
    expect(req.adminSession).toEqual({
      adminUserId: "admin-4",
      role: "super_admin",
      status: "active",
    });
  });

  it("케이스 5: /api/v1/admin/auth/* 경로 — 가드 통과 (Better Auth 처리)", async () => {
    const req = makeRequest("/api/v1/admin/auth/sign-in/email");
    const reply = makeReply();

    await adminGuardHook(req, reply);

    // getSession 호출 없이 통과 — status 미변경(기본값 200 유지)
    expect(adminAuth.api.getSession).not.toHaveBeenCalled();
    expect(reply._statusCode).toBe(200);
  });
});
