/**
 * 내부 환율 갱신 트리거 라우트.
 *
 * apps/worker의 일일 크론(exchange-rate.refresh)이 이 엔드포인트를 POST해
 * refreshUsdKrwRate()로 한국수출입은행 API에서 최신 USD→KRW 환율을 받아 캐시한다.
 * (커리큘럼 예약 게시 internalCurriculumRoutes와 동일 패턴)
 *
 * 보안:
 *  - x-internal-key 헤더가 INTERNAL_API_KEY env와 일치해야 실행.
 *  - INTERNAL_API_KEY env 미설정(개발환경)이면 통과(dev 편의).
 */

import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { refreshUsdKrwRate } from "../../lib/exchangeRate.js";

export async function internalExchangeRateRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/internal/exchange-rate/refresh",
    {
      schema: {
        response: {
          200: z.object({
            ok: z.boolean(),
            rate: z.number().nullable(),
            baseDate: z.string().nullable(),
          }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const internalKey = process.env.INTERNAL_API_KEY;
      const requestKey = request.headers["x-internal-key"];
      if (internalKey && requestKey !== internalKey) {
        return reply.code(403).send({ error: "Forbidden: invalid internal key" });
      }

      const stored = await refreshUsdKrwRate();
      return {
        ok: stored != null,
        rate: stored?.rate ?? null,
        baseDate: stored?.baseDate ?? null,
      };
    },
  );
}
