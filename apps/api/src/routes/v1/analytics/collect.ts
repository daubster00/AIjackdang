/**
 * POST /api/v1/analytics/collect — 방문 로그 적재 (공개·비인증).
 *
 * 브라우저 PageViewTracker 컴포넌트에서 navigator.sendBeacon / fetch 로 호출된다.
 * adminGuard는 /api/v1/admin/* 경로에만 걸리므로 이 경로는 가드 미적용.
 *
 * 처리:
 * 1. path 쿼리스트링 제거
 * 2. referrer 있으면 URL 파싱 → referrer_host 추출 (실패 시 null)
 * 3. 유저 세션 옵셔널 조회 (aj_session 쿠키 → userAuth.api.getSession)
 * 4. page_views INSERT
 * 5. 204 반환
 */

import type { FastifyInstance } from "fastify";
import { getDb, schema } from "@ai-jakdang/database";
import { userAuth } from "../../../auth/user-auth.js";

/** URL에서 쿼리스트링·해시를 제거하고 pathname만 반환 */
function stripQuery(rawPath: string): string {
  const qi = rawPath.indexOf("?");
  const hi = rawPath.indexOf("#");
  const cut = [qi, hi].filter((i) => i !== -1);
  if (cut.length === 0) return rawPath;
  return rawPath.slice(0, Math.min(...cut));
}

/** 전체 referrer URL에서 호스트만 추출 (실패 시 null) */
function parseReferrerHost(referrer?: string): string | null {
  if (!referrer || referrer.trim() === "") return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

export async function registerAnalyticsCollectRoute(
  app: FastifyInstance,
): Promise<void> {
  app.post("/analytics/collect", {
    schema: {
      description: "방문 로그 적재 (공개 비인증). 브라우저 PageViewTracker가 호출.",
      tags: ["analytics"],
    },
  }, async (request, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (request.body ?? {}) as {
      path?: string;
      referrer?: string;
      searchKeyword?: string;
      visitorId?: string;
      dwellMs?: number;
    };

    // 필수 파라미터 검증
    if (!body.visitorId || !body.path) {
      return reply.status(400).send({ error: "path and visitorId are required" });
    }

    // 1. path 정규화
    const path = stripQuery(body.path ?? "/");

    // 2. referrer 처리
    const referrer = body.referrer && body.referrer.trim() !== "" ? body.referrer : null;
    const referrerHost = parseReferrerHost(body.referrer);

    // 3. 유저 세션 옵셔널 조회 (실패해도 진행)
    let userId: string | null = null;
    try {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      userId = session?.user?.id ?? null;
    } catch {
      // 세션 없거나 오류 — 비인증 방문으로 처리
    }

    // 4. page_views INSERT
    // dwellMs: 이탈 비콘(exit beacon)으로 전달된 체류시간(ms). null 이면 미기록.
    const dwellMs =
      typeof body.dwellMs === "number" && body.dwellMs > 0 ? body.dwellMs : null;

    const db = getDb();
    await db.insert(schema.pageViews).values({
      path,
      visitorId: body.visitorId,
      userId,
      referrer,
      referrerHost,
      searchKeyword: body.searchKeyword ?? null,
      dwellMs,
    });

    // 5. 204 No Content
    return reply.status(204).send();
  });
}
