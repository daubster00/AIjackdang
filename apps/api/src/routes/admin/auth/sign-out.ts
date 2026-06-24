/**
 * POST /api/v1/admin/auth/sign-out — 관리자 로그아웃 (Story 9.2 AC#6).
 *
 * 흐름:
 * 1. adminAuth.api.signOut() 호출 — admin_sessions 레코드 삭제
 * 2. aj_admin_session 쿠키 제거
 * 3. { success: true } 반환
 *
 * 주의: /api/v1/admin/auth/* 경로는 adminGuardHook 제외(auth/* 패턴).
 *       로그인 여부와 무관하게 호출 가능(이미 로그아웃된 경우도 200 반환).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminAuth } from "../../../auth/admin-auth.js";

export async function registerAdminSignOutRoute(app: FastifyInstance): Promise<void> {
  app.post(
    "/admin/auth/sign-out",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Better Auth signOut: 세션 토큰을 쿠키에서 읽어 admin_sessions 레코드 삭제
        await adminAuth.api.signOut({
          headers: request.headers as unknown as Headers,
        });
      } catch {
        // 세션이 없거나 이미 만료된 경우 무시
      }

      // aj_admin_session 쿠키 제거 (클라이언트 쿠키 명시적 삭제)
      // Better Auth 쿠키 prefix: aj_admin_session
      // 세션 쿠키, 도토큰 쿠키 모두 제거
      const cookieNames = [
        "aj_admin_session.session_token",
        "aj_admin_session.session_data",
        "aj_admin_session",
      ];

      for (const cookieName of cookieNames) {
        reply.header(
          "Set-Cookie",
          `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
        );
      }

      return reply.code(200).send({ success: true });
    },
  );
}
