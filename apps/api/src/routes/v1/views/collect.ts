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
 *   2. 크롤러/봇 UA는 집계 제외 (검색엔진·SNS 미리보기 봇)
 *   3. 관리자 세션이면 집계 제외 (관리자 계정으로 공개 사이트를 봐도 조회수 미반영)
 *   4. 세션 옵셔널 조회 → userId
 *   5. fingerprint = `${ip}:${userId ?? "anon"}` 로 trackView (24시간 dedup)
 *   6. 204 반환 (fire-and-forget)
 *
 * AR-16·AR-17: DB 직접 UPDATE 금지 — Redis 버퍼링만. worker(view-flush)가 flush.
 */

import type { FastifyInstance } from "fastify";
import { userAuth } from "../../../auth/user-auth.js";
import { adminAuth } from "../../../auth/admin-auth.js";
import { trackView, type ViewTargetType } from "../../../lib/viewTracker.js";
import { isCrawlerUserAgent } from "../../../lib/crawler.js";

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

    // 2. 크롤러/봇 조회는 집계 제외 (검색엔진·SNS 미리보기 봇). 204로 조용히 무시.
    if (isCrawlerUserAgent(request.headers["user-agent"])) {
      return reply.status(204).send();
    }

    // 3. 관리자 세션이면 집계 제외.
    //    관리자 계정으로 로그인한 채 공개 사이트를 봐도 조회수가 오르지 않게 한다.
    //    (관리자 쿠키 aj_admin_session 가 요청에 실려 있을 때만 감지됨 — 없으면 no-op.)
    try {
      const adminSession = await adminAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      if (adminSession?.user?.id) {
        return reply.status(204).send();
      }
    } catch {
      // 관리자 아님 — 계속 진행
    }

    // 4. 세션 옵셔널 조회 (실패해도 비회원으로 진행)
    let userId: string | undefined;
    try {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      userId = session?.user?.id;
    } catch {
      // 비회원 — 무시
    }

    // 5. Redis 버퍼링 (fire-and-forget). fingerprint = 실제 IP : userId
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
