/**
 * 게이미피케이션 라우트 — Story 6.3
 *
 * GET /api/v1/gamification/me               내 등급 조회 (인증 필수)
 * GET /api/v1/gamification/user/:userId/grade   공개 등급 조회 (비인증 가능)
 *
 * 확장점:
 * - Story 6.4: POST /api/v1/gamification/me/badges (뱃지 체크)
 * - Story 6.5: GET  /api/v1/gamification/ranking (랭킹 조회)
 * → 이 파일에 라우트 핸들러를 추가하고 gamification.service.ts에 서비스 함수 추가.
 */

import { getDb } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { getUserGrade } from "./gamification.service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

/** 등급 정보 응답 스키마 */
const gradeInfoSchema = z.object({
  level: z.number().int().min(1).max(5),
  name: z.string().min(1),
});

/** GET /gamification/me 응답 스키마 */
const userGradeResponseSchema = z.object({
  totalPoints: z.number().int().nonnegative(),
  grade: gradeInfoSchema,
  nextGrade: gradeInfoSchema.nullable(),
  pointsToNext: z.number().int().nonnegative().nullable(),
});

// ── 라우트 등록 ───────────────────────────────────────────────────────────────

export async function gamificationRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /api/v1/gamification/me ───────────────────────────────────────────
  // 로그인 필수. 본인의 포인트 + 현재 등급 + 다음 등급 + 잔여 포인트 반환.
  typed.get(
    "/gamification/me",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "내 등급 조회",
        tags: ["gamification"],
        response: {
          200: userGradeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const db = getDb();
      const result = await getUserGrade(db, user.id);
      return reply.code(200).send(result);
    },
  );

  // ── GET /api/v1/gamification/user/:userId/grade ────────────────────────────
  // 공개 API. 프로필 SSR에서 비인증으로 호출 가능.
  typed.get(
    "/gamification/user/:userId/grade",
    {
      schema: {
        description: "사용자 등급 공개 조회",
        tags: ["gamification"],
        params: z.object({ userId: z.string().uuid() }),
        response: {
          200: userGradeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const db = getDb();
      const result = await getUserGrade(db, userId);
      return reply.code(200).send(result);
    },
  );
}
