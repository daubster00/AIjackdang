/**
 * POST /api/v1/analytics/collect — 방문 로그 적재 (공개·비인증).
 *
 * 브라우저 PageViewTracker 컴포넌트에서 navigator.sendBeacon / fetch 로 호출된다.
 * adminGuard는 /api/v1/admin/* 경로에만 걸리므로 이 경로는 가드 미적용.
 *
 * 두 종류의 호출을 처리한다:
 *  (1) 페이지 진입: { path, visitorId, referrer, searchKeyword, viewId } → INSERT
 *  (2) 체류시간 갱신: { viewId, dwellMs } → 같은 행 UPDATE (진입 시 INSERT한 행)
 *      과거에는 dwell 도 매번 INSERT 라서 페이지당 행이 2개씩 쌓여 PV·"직접" 유입이
 *      부풀려졌다. 이제 viewId 로 같은 행을 UPDATE 하여 중복 적재를 없앤다.
 *
 * 봇 처리:
 *  - 크롤러/스크래퍼 UA(isCrawlerUserAgent)는 삭제 대신 is_bot=true 로 태깅해 적재한다.
 *    접속통계 집계 쿼리가 is_bot=false 로 사람 트래픽만 세므로 통계는 깨끗하고,
 *    봇 트래픽 규모는 별도로 조회할 수 있다.
 *  - 관리자 세션(aj_admin_session 쿠키)으로 공개 사이트를 본 경우는 아예 적재하지 않는다.
 */

import type { FastifyInstance } from "fastify";
import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { userAuth } from "../../../auth/user-auth.js";
import { adminAuth } from "../../../auth/admin-auth.js";
import { isCrawlerUserAgent } from "../../../lib/crawler.js";

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

/** 요청 헤더에 관리자 세션 쿠키가 실려 있는지(값 유무만) 싸게 확인 */
function hasAdminCookie(cookieHeader: string | undefined): boolean {
  return typeof cookieHeader === "string" && cookieHeader.includes("aj_admin_session");
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
    const body = (request.body ?? {}) as {
      path?: string;
      referrer?: string;
      searchKeyword?: string;
      visitorId?: string;
      viewId?: string;
      dwellMs?: number;
    };

    const db = getDb();

    const dwellMs =
      typeof body.dwellMs === "number" && body.dwellMs > 0 ? body.dwellMs : null;

    // (2) 체류시간 갱신 — viewId 로 진입 시 적재된 같은 행을 UPDATE.
    //     행이 없으면(봇 미적재·만료 등) 0행 갱신으로 조용히 끝난다.
    if (dwellMs !== null && body.viewId) {
      await db
        .update(schema.pageViews)
        .set({ dwellMs })
        .where(eq(schema.pageViews.id, body.viewId));
      return reply.status(204).send();
    }

    // (1) 페이지 진입 — 필수 파라미터 검증
    if (!body.visitorId || !body.path) {
      return reply.status(400).send({ error: "path and visitorId are required" });
    }

    // 관리자 세션이면 적재하지 않는다. 쿠키가 있을 때만 세션 조회(불필요한 조회 회피).
    if (hasAdminCookie(request.headers["cookie"])) {
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
    }

    // 크롤러/스크래퍼 UA 판별 → 삭제 대신 태깅.
    const userAgent = request.headers["user-agent"] ?? null;
    const isBot = isCrawlerUserAgent(userAgent ?? undefined);

    // path 정규화 / referrer 처리
    const path = stripQuery(body.path ?? "/");
    const referrer = body.referrer && body.referrer.trim() !== "" ? body.referrer : null;
    const referrerHost = parseReferrerHost(body.referrer);

    // 유저 세션 옵셔널 조회 (실패해도 비인증 방문으로 진행)
    let userId: string | null = null;
    try {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      userId = session?.user?.id ?? null;
    } catch {
      // 세션 없거나 오류 — 비인증 방문으로 처리
    }

    // page_views INSERT. viewId 가 오면 그 값을 PK 로 써서 이후 dwell UPDATE 가 매칭되게 한다.
    // 동일 viewId 재전송(재시도 등)은 onConflictDoNothing 으로 무시한다.
    await db
      .insert(schema.pageViews)
      .values({
        ...(body.viewId ? { id: body.viewId } : {}),
        path,
        visitorId: body.visitorId,
        userId,
        referrer,
        referrerHost,
        searchKeyword: body.searchKeyword ?? null,
        userAgent,
        isBot,
      })
      .onConflictDoNothing();

    return reply.status(204).send();
  });
}
