/**
 * GET /api/v1/notifications/sse — SSE 커넥션 핸들러 (Story 7.1, AC #3, #4)
 *
 * - 인증 회원: text/event-stream 연결 유지, 25초마다 keepalive ping 전송
 * - 미인증: 401 반환
 * - 연결 시 sseConnectionMap에 등록 + Redis 채널 구독
 * - 연결 해제 시 sseConnectionMap에서 제거 + Redis 채널 구독 해제
 *
 * ⚠️ 반드시 `reply.hijack()`로 Fastify 라이프사이클에서 응답을 분리한다.
 *    hijack 없이 raw 응답에 직접 writeHead 하면, 클라이언트가 연결을 끊을 때
 *    (페이지 이동 등 ECONNRESET) Fastify 에러 핸들러가 이미 전송된 헤더에
 *    다시 쓰려다 ERR_HTTP_HEADERS_SENT 로 **프로세스가 크래시**한다.
 *    (이로 인해 페이지 이동마다 API가 죽어 로그인이 풀리는 버그가 있었다.)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { userAuth } from "../../../auth/user-auth.js";
import { sseConnectionMap } from "../../../lib/sse.js";
import {
  subscribeUserNotifications,
  unsubscribeUserNotifications,
} from "../../../lib/redis-pubsub.js";

const KEEPALIVE_INTERVAL_MS = 25_000; // 25초

export async function registerSseRoute(app: FastifyInstance): Promise<void> {
  app.get("/sse", async (request: FastifyRequest, reply: FastifyReply) => {
    // ── 인증 확인 (hijack 이전 — 미인증은 Fastify가 정상 응답) ──────────────────
    let userId: string;
    try {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      if (!session?.user?.id) {
        return reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }
      userId = session.user.id;
    } catch {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      });
    }

    // ── Fastify 라이프사이클에서 응답 분리 (이후 raw 소켓은 우리가 직접 관리) ────
    // 이 호출 이후 Fastify는 이 reply에 대해 send/에러핸들러를 실행하지 않는다.
    reply.hijack();

    // ── SSE 헤더 설정 ─────────────────────────────────────────────────────────
    try {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // nginx 버퍼링 비활성화
      });
      reply.raw.flushHeaders?.();
    } catch {
      // 헤더 전송 전에 이미 소켓이 닫힌 경우 — 조용히 종료
      try { reply.raw.end(); } catch { /* noop */ }
      return;
    }

    // ── 커넥션 등록 + Redis 구독 ──────────────────────────────────────────────
    sseConnectionMap.add(userId, reply);
    try {
      await subscribeUserNotifications(userId);
    } catch (err) {
      console.warn("[sse] subscribeUserNotifications 오류:", (err as Error).message);
    }

    // ── keepalive ping (25초 간격) ────────────────────────────────────────────
    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(`: ping\n\n`);
      } catch {
        clearInterval(pingInterval);
      }
    }, KEEPALIVE_INTERVAL_MS);

    // ── 연결 해제 클린업 (중복 호출 안전) ─────────────────────────────────────
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(pingInterval);
      sseConnectionMap.remove(userId, reply);
      // 같은 유저의 다른 탭/기기 커넥션이 남아 있으면 Redis 구독을 유지한다.
      // 마지막 커넥션이 닫힐 때만 채널 구독을 해제한다(다중 탭 지원, AC #4).
      if (sseConnectionMap.connectionCount(userId) === 0) {
        unsubscribeUserNotifications(userId).catch((err) => {
          console.warn("[sse] unsubscribeUserNotifications 오류:", (err as Error).message);
        });
      }
    };

    // 연결 종료/오류는 정상 흐름 — 에러를 외부로 전파하지 않고 정리만 한다.
    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    reply.raw.on("error", cleanup);

    // hijack 했으므로 Fastify가 reply를 관리하지 않는다. 그냥 반환하면
    // raw 소켓은 클라이언트가 끊을 때까지 열린 상태로 유지된다.
  });
}
