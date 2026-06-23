/**
 * GET /api/v1/resources/:slug — 실전자료 상세 (Story 4.3)
 *
 * - published 자료: 비회원 포함 공개
 * - deleted/hidden/draft: 404
 * - userIsOwner: 세션 쿠키 기반 인증 (선택적, 실패 시 비회원 처리)
 * - avgRating: DB numeric → number 변환 (detail.service에서 처리)
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { resourceDetailSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { userAuth } from "../../../auth/user-auth.js";
import { getResourceBySlug } from "./detail.service.js";
import { trackView } from "../../../lib/viewTracker.js";

/**
 * 상세 응답 = resourceDetailSchema + userIsOwner + HTML 변환본.
 * HTML 변환본은 API 서버(AR-8 sanitize-html 처리)에서 web SSR로 전달한다.
 */
const resourceDetailResponseSchema = resourceDetailSchema.extend({
  userIsOwner: z.boolean(),
  descriptionHtml: z.string(),
  usageHtml: z.string(),
  cautionHtml: z.string().nullable(),
});

export async function registerResourceDetailRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /resources/:slug — 실전자료 상세 ──────────────────────────────────────
  typed.get(
    "/resources/:slug",
    {
      schema: {
        description:
          "실전자료 slug로 상세 조회. published 자료는 비회원 포함 공개. deleted/hidden/draft는 404.",
        tags: ["resources"],
        params: z.object({ slug: z.string().min(1) }),
        response: {
          200: resourceDetailResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;

      // ── 선택적 인증 (실패 시 비회원으로 처리) ────────────────────────────────
      let currentUserId: string | undefined;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        currentUserId = session?.user?.id;
      } catch {
        // 비회원 — 무시
      }

      const resource = await getResourceBySlug({ slug, userId: currentUserId });

      if (!resource) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "자료를 찾을 수 없습니다.",
          },
        });
      }

      // 조회수 Redis 버퍼링 (fire-and-forget) — Story 5.3
      const fp = `${request.ip}:${currentUserId ?? "anon"}`;
      void trackView({ targetType: "resource", targetId: resource.id, fingerprint: fp });

      return reply.code(200).send(resource);
    },
  );
}
