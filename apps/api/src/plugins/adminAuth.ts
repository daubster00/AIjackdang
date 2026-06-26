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
import { env } from "@ai-jakdang/config";
import { adminAuth } from "../auth/admin-auth.js";

const betterAdminAuthHandler = toNodeHandler(adminAuth);

/**
 * 관리자 auth 경로 허용 출처. @fastify/cors 와 동일 목록.
 * toNodeHandler 가 reply.raw 에 직접 써서 @fastify/cors 의 onSend 훅을 우회하므로,
 * 이 경로(get-session·sign-out 등)는 여기서 CORS 헤더를 수동으로 붙여야
 * 브라우저(localhost:3004)에서의 client fetch 가 CORS 차단되지 않는다.
 */
const ALLOWED_ORIGINS = new Set(
  [env.ADMIN_PUBLIC_URL, env.WEB_PUBLIC_URL].filter(Boolean) as string[],
);

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
    // CORS 헤더 수동 부착 (toNodeHandler가 @fastify/cors를 우회하므로).
    const origin = request.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      reply.raw.setHeader("Access-Control-Allow-Origin", origin);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      reply.raw.setHeader("Vary", "Origin");
    }
    // 프리플라이트(OPTIONS)는 BetterAuth로 넘기지 않고 여기서 종료.
    if (request.method === "OPTIONS") {
      reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      reply.raw.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
      reply.raw.statusCode = 204;
      reply.raw.end();
      return;
    }
    await betterAdminAuthHandler(request.raw, reply.raw);
  });
}
