/**
 * adminAuth 플러그인 — 관리자 Better Auth 핸들러 마운트 (ADR-0003).
 *
 * /api/v1/admin/auth/* 경로를 관리자 Better Auth 인스턴스에 위임한다.
 * 유저 auth 플러그인(app.ts)과 동일한 content-type parser no-op 패턴 사용.
 *
 * - cookiePrefix: aj_admin_session
 * - basePath: /api/v1/admin/auth
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { toNodeHandler } from "better-auth/node";
import { adminAuth } from "../auth/admin-auth.js";

const betterAdminAuthHandler = toNodeHandler(adminAuth);

/**
 * Fastify 플러그인: 관리자 Better Auth 핸들러를 /api/v1/admin/auth/* 에 마운트한다.
 *
 * Better Auth(better-call)는 raw Node.js IncomingMessage stream에서 body를 직접 읽으므로
 * Fastify의 JSON 파서를 no-op으로 대체하여 stream 소비를 방지한다.
 */
export async function adminAuthPlugin(app: FastifyInstance): Promise<void> {
  // admin auth 경로 전용: JSON 파서를 no-op으로 대체 (stream 소비 방지)
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    (
      _req: FastifyRequest,
      payload: NodeJS.ReadableStream,
      done: (err: Error | null, result?: unknown) => void,
    ) => {
      done(null, payload); // raw stream 통과 — Better Auth가 직접 읽음
    },
  );

  app.all("/api/v1/admin/auth/*", async (request: FastifyRequest, reply: FastifyReply) => {
    await betterAdminAuthHandler(request.raw, reply.raw);
  });
}
