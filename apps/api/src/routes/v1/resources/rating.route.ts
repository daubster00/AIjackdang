/**
 * 평점 라우트 — Story 4.7
 *
 * POST /api/v1/resources/:id/ratings   — 평점 등록·수정(upsert), 인증 필수
 * GET  /api/v1/resources/:id/ratings/me — 현재 로그인 회원 기존 평점 조회
 *
 * routes.ts 집계자에 import 1줄 + register 1줄 추가 (Story 4.7 주석).
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ratingSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { userAuth } from "../../../auth/user-auth.js";
import { upsertRating, getMyRating, RatingServiceError } from "./rating.service.js";

/** POST /api/v1/resources/:id/ratings 응답 스키마 */
const upsertRatingResponseSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** 재집계된 평균 평점 */
  avgRating: z.number(),
  /** 재집계된 평점 개수 */
  ratingCount: z.number().int().nonnegative(),
});

/** GET /api/v1/resources/:id/ratings/me 응답 스키마 */
const myRatingResponseSchema = z.object({
  id: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function registerResourceRatingRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /resources/:id/ratings — 평점 등록·수정 ────────────────────────────
  typed.post(
    "/resources/:id/ratings",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "평점 등록·수정(upsert). 인증 필수. 본인 자료 평점 불가(403). 동일 회원 재평점 시 upsert 처리(409 없음).",
        tags: ["resources", "ratings"],
        params: z.object({ id: z.string().uuid() }),
        body: ratingSchema,
        response: {
          200: upsertRatingResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: resourceId } = request.params;
      const { score } = request.body;

      // requireAuthHook에서 user를 request에 주입
      const userId = (request as typeof request & { user: { id: string } }).user.id;

      try {
        const result = await upsertRating(resourceId, userId, score);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof RatingServiceError) {
          if (err.code === "RESOURCE_NOT_FOUND") {
            return reply.code(404).send({
              error: { code: err.code, message: err.message },
            });
          }
          if (err.code === "SELF_RATING_NOT_ALLOWED") {
            return reply.code(403).send({
              error: { code: err.code, message: err.message },
            });
          }
        }
        throw err;
      }
    },
  );

  // ── GET /resources/:id/ratings/me — 현재 로그인 회원 평점 조회 ─────────────
  typed.get(
    "/resources/:id/ratings/me",
    {
      schema: {
        description:
          "현재 로그인 회원의 기존 평점 조회. 비로그인 시 null 반환. 평점 없을 때도 null(404 아님).",
        tags: ["resources", "ratings"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: myRatingResponseSchema.nullable(),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: resourceId } = request.params;

      // 선택적 인증 — 비로그인 시 null 반환
      let userId: string | undefined;
      try {
        const session = await userAuth.api.getSession({
          headers: request.headers as unknown as Headers,
        });
        userId = session?.user?.id;
      } catch {
        // 비회원 — null 반환
      }

      if (!userId) {
        return reply.code(200).send(null);
      }

      const myRating = await getMyRating(resourceId, userId);
      return reply.code(200).send(myRating);
    },
  );
}
