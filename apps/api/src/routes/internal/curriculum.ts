/**
 * 내부 커리큘럼 예약 게시 트리거 라우트 — Story 13.6
 *
 * apps/worker(curriculumPublish.processor.ts)가 이 엔드포인트를 POST해
 * runCurriculumPublishScan()을 실행한다.
 *
 * 보안:
 *  - x-internal-key 헤더가 INTERNAL_API_KEY env와 일치해야 실행.
 *  - INTERNAL_API_KEY env 미설정(개발환경)이면 통과(dev 편의).
 *  - 이 라우트는 공개 인터넷에 노출되지 않도록 인프라 레벨(Docker 네트워크·방화벽)에서
 *    내부 트래픽만 허용해야 한다.
 *
 * [Source: _bmad-output/implementation-artifacts/13-6-schedule-publisher-cron.md#오케스트레이터-확정-설계]
 */

import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { runCurriculumPublishScan } from "../../services/bot/curriculum-publish-scan.js";

export async function internalCurriculumRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/internal/bots/curriculum/publish-scan",
    {
      schema: {
        response: {
          200: z.object({
            published: z.number(),
            skipped: z.number(),
            overdue: z.number(),
          }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      // ── 인증: x-internal-key 헤더 확인 ────────────────────────────────────
      const internalKey = process.env.INTERNAL_API_KEY;
      const requestKey = request.headers["x-internal-key"];

      // env 미설정(빈 문자열 포함) → dev 편의로 통과
      if (internalKey && requestKey !== internalKey) {
        return reply.code(403).send({ error: "Forbidden: invalid internal key" });
      }

      // ── 스캔 실행 ─────────────────────────────────────────────────────────
      const result = await runCurriculumPublishScan();
      return result;
    },
  );
}
