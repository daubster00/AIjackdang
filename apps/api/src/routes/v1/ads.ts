/**
 * 공개 광고 API (Story 9.16).
 *
 * GET /api/v1/ads/:placement — 노출 위치 코드에 해당하는 활성 광고 반환.
 * isActive=true AND deleted_at IS NULL AND 기간 범위 내.
 * 없으면 빈 응답(204).
 * 인증 불필요.
 */

import type { FastifyInstance } from "fastify";
import { getActiveAdByPlacement } from "../admin/ads/service.js";

export async function registerPublicAdsRoute(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/ads/:placement", async (request, reply) => {
    const { placement } = request.params as { placement: string };

    try {
      const ad = await getActiveAdByPlacement(placement);
      if (!ad) {
        return reply.status(204).send();
      }
      return reply.send(ad);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });
}
