/**
 * requireAuthHook — Fastify preHandler 훅 (Story 1.7, AC #5).
 *
 * 세션 없는 요청이 쓰기·반응·다운로드·신고 라우트에 도달하면 401을 반환한다.
 * 클라이언트의 UX 게이팅(useGating)은 편의 수단이며, 최종 통제는 이 API 게이트다
 * (project-context §보안: "인증 권위는 API 서버").
 *
 * 사용법:
 * ```ts
 * import { requireAuthHook } from "@/plugins/require-auth.js";
 *
 * fastify.post("/api/v1/posts", { preHandler: [requireAuthHook] }, handler);
 * ```
 *
 * 세션 확인 방법:
 * - Better Auth 세션 쿠키 prefix = "aj_session" (ADR-0002).
 * - 쿠키명: "aj_session.session_token" (httpOnly).
 * - Edge 미들웨어처럼 쿠키 존재 여부만 체크하지 않고,
 *   Better Auth의 /api/v1/auth/get-session을 내부 호출해 유효성을 검증한다.
 *   단, 이는 별도 HTTP 왕복이므로 현재는 쿠키 존재 여부로 빠른 거부 후
 *   실제 핸들러에서 Better Auth session 객체를 확인하는 패턴으로 구현한다.
 *
 * 현재 등록 대상 라우트:
 * - 현재 apps/api에 존재하는 행동 라우트가 없으므로 플러그인만 정의.
 *   각 기능 스토리(Epic 2~9)에서 라우트 등록 시 이 훅을 추가한다.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { userAuth } from "../auth/user-auth.js";

/**
 * 세션 없는 요청을 401로 거부하는 preHandler 훅.
 *
 * Better Auth의 api.getSession()을 사용해 세션 유효성을 검증한다.
 * 세션이 없거나 만료된 경우 401 UNAUTHORIZED를 반환한다.
 */
export async function requireAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // Better Auth의 세션 검증: 요청 쿠키를 기반으로 세션 조회
    const session = await userAuth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session?.user) {
      await reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
        },
      });
      return;
    }

    // 세션 정보를 request에 저장해 핸들러에서 사용할 수 있도록 한다
    // (request.user 패턴 — 각 스토리에서 타입 선언 추가 가능)
    (request as FastifyRequest & { user: typeof session.user }).user = session.user;
  } catch {
    await reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    });
  }
}
