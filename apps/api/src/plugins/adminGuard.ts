/**
 * adminGuard — /api/v1/admin/* preHandler 훅 (ADR-0003, Story 9.1 AC#7).
 *
 * - aj_admin_session 쿠키 없거나 유효하지 않으면 401 반환.
 * - 유저 세션(aj_session)만 있는 요청도 401 (관리자 세션 필수).
 * - status≠active 이면 401.
 * - /api/v1/admin/auth/* 경로는 가드 제외 (Better Auth가 처리).
 *
 * requireSuperAdmin: role≠super_admin 이면 403. 9.3~9.6 라우트에서 사용.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { adminAuth } from "../auth/admin-auth.js";

/** 관리자 세션 정보를 request에 붙이기 위한 타입 확장 */
export interface AdminSessionInfo {
  adminUserId: string;
  role: string;
  status: string;
}

declare module "fastify" {
  interface FastifyRequest {
    adminSession?: AdminSessionInfo;
  }
}

/**
 * /api/v1/admin/* 전체에 걸리는 preHandler 가드.
 *
 * Better Auth의 api.getSession()을 사용해 aj_admin_session 쿠키를 검증한다.
 * 세션이 없거나 status≠active 이면 401을 반환한다.
 *
 * 주의: /api/v1/admin/auth/* 경로는 app.ts 에서 addHook 범위를 제한하여 제외한다.
 */
export async function adminGuardHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 이 훅은 app.ts에서 전역 preHandler로 등록되므로, 관리자 경로(/api/v1/admin/*)
  // 이외의 요청(헬스체크·유저 인증/api/v1/auth/*·공개 API 등)은 가드를 건너뛴다.
  // (전역 등록 상태에서 이 가드가 모든 경로에 걸리면 유저 로그인까지 401로 막힘)
  if (!request.url.startsWith("/api/v1/admin/")) {
    return;
  }

  // /api/v1/admin/auth/* 경로는 Better Auth가 처리 — 가드 통과
  if (request.url.startsWith("/api/v1/admin/auth/")) {
    return;
  }

  try {
    const session = await adminAuth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session?.user) {
      await reply.status(401).send({
        error: {
          code: "ADMIN_UNAUTHORIZED",
          message: "관리자 인증이 필요합니다.",
        },
      });
      return;
    }

    // admin_users.status 확인
    const adminUser = session.user as typeof session.user & { status?: string; role?: string };
    const status = adminUser.status ?? "pending";

    if (status !== "active") {
      await reply.status(401).send({
        error: {
          code: "ADMIN_INACTIVE",
          message: "승인 대기 또는 비활성 상태의 관리자 계정입니다.",
        },
      });
      return;
    }

    // 세션 정보를 request에 저장
    request.adminSession = {
      adminUserId: session.user.id,
      role: (adminUser.role as string) ?? "staff",
      status,
    };
  } catch {
    await reply.status(401).send({
      error: {
        code: "ADMIN_UNAUTHORIZED",
        message: "관리자 인증이 필요합니다.",
      },
    });
  }
}

/**
 * super_admin 전용 라우트 가드.
 * adminGuardHook 이후에 실행 — adminSession이 이미 request에 있다고 가정.
 * role≠super_admin 이면 403 반환.
 */
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.adminSession?.role !== "super_admin") {
    await reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "최고 관리자(super_admin) 권한이 필요합니다.",
      },
    });
  }
}
