/**
 * POST /api/v1/views — 조회수 집계 비콘 (공개·비인증 허용).
 *
 * 브라우저 상세 페이지의 ViewBeacon 클라이언트 컴포넌트가 마운트 시 1회 호출한다.
 * SSR fetch가 아니라 브라우저에서 직접 호출하므로:
 *   - request.ip 가 실제 클라이언트 IP (Caddy X-Forwarded-For + trustProxy)
 *   - 페이지 ISR/캐시와 무관하게 조회마다 발화
 *
 * 처리:
 *   1. body {targetType, targetId} 검증
 *   2. 세션 옵셔널 조회 → userId
 *   3. fingerprint = `${ip}:${userId ?? "anon"}` 로 trackView (30분 dedup)
 *   4. 204 반환 (fire-and-forget)
 *
 * AR-16·AR-17: DB 직접 UPDATE 금지 — Redis 버퍼링만. worker(view-flush)가 flush.
 */

import type { FastifyInstance } from "fastify";
import { userAuth } from "../../../auth/user-auth.js";
import { trackView, type ViewTargetType } from "../../../lib/viewTracker.js";

const VALID_TYPES: ViewTargetType[] = ["post", "question", "resource"];

export async function registerViewsCollectRoute(
  app: FastifyInstance,
): Promise<void> {
  app.post("/views", {
    schema: {
      description:
        "조회수 집계 비콘 (공개 비인증). 브라우저 ViewBeacon이 상세 마운트 시 호출.",
      tags: ["views"],
    },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      targetType?: string;
      targetId?: string;
    };

    // 1. 파라미터 검증
    if (
      !body.targetType ||
      !body.targetId ||
      !VALID_TYPES.includes(body.targetType as ViewTargetType)
    ) {
      return reply.status(400).send({ error: "targetType and targetId are required" });
    }

    // 2. 세션 옵셔널 조회 (실패해도 비회원으로 진행)
    let userId: string | undefined;
    try {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      userId = session?.user?.id;
    } catch {
      // 비회원 — 무시
    }

    // 3. Redis 버퍼링 (fire-and-forget). fingerprint = 실제 IP : userId
    const fingerprint = `${request.ip}:${userId ?? "anon"}`;
    void trackView({
      targetType: body.targetType as ViewTargetType,
      targetId: body.targetId,
      fingerprint,
    });

    // 4. 204 No Content
    return reply.status(204).send();
  });
}
