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
import { pointsHistoryResponseSchema, gradesListResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import {
  getUserGrade,
  getRanking,
  getPointsHistory,
  getGradesList,
} from "./gamification.service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

/** 등급 정보 응답 스키마 */
const gradeInfoSchema = z.object({
  level: z.number().int().min(1).max(5),
  name: z.string().min(1),
});

/** GET /gamification/me 응답 스키마 */
const meResponseSchema = z.object({
  totalPoints: z.number().int().nonnegative(),
  grade: gradeInfoSchema,
  nextGrade: gradeInfoSchema.nullable(),
  pointsToNext: z.number().int().nonnegative().nullable(),
});

/** GET /gamification/user/:userId/grade 응답 스키마 */
const userGradeResponseSchema = meResponseSchema;

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
          200: meResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const db = getDb();
      const gradeResult = await getUserGrade(db, user.id);
      return reply.code(200).send(gradeResult);
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

  // ── [6.5] 랭킹 라우트 ────────────────────────────────────────────────────

  // ── GET /api/v1/gamification/ranking ──────────────────────────────────────
  // 공개 API (비회원 열람 가능). 주간·월간 기여자 TOP 10 랭킹 반환.
  // Redis 캐시 hit → 반환 / miss → DB 즉석 계산 후 Redis 저장 + 반환.
  // limit 파라미터: Redis 저장은 항상 10개, 응답 시 slice 처리.
  typed.get(
    "/gamification/ranking",
    {
      schema: {
        description: "기여자 랭킹 조회 (주간·월간)",
        tags: ["gamification"],
        querystring: z.object({
          period: z.enum(["weekly", "monthly"]).default("weekly"),
          limit: z.coerce.number().int().min(1).max(10).default(10),
        }),
        response: {
          200: z.object({
            period: z.enum(["weekly", "monthly"]),
            items: z.array(
              z.object({
                rank: z.number().int().positive(),
                userId: z.string().uuid(),
                nickname: z.string(),
                gradeLevel: z.number().int().min(1).max(5),
                gradeName: z.string(),
                totalDelta: z.number().int(),
              }),
            ),
            generatedAt: z.string().datetime(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { period, limit } = request.query as { period: "weekly" | "monthly"; limit: number };
      const db = getDb();
      const result = await getRanking(db, period, limit);
      return reply.code(200).send(result);
    },
  );

  // ── [6.5] END ─────────────────────────────────────────────────────────────

  // ── [수정요청 G] GET /api/v1/gamification/me/points-history ──────────────────
  // 인증 필수. 본인의 포인트 적립/회수 내역(최신순, 페이지네이션) + 누적 포인트.
  typed.get(
    "/gamification/me/points-history",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "내 포인트 적립/회수 내역 조회",
        tags: ["gamification"],
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: pointsHistoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { page, pageSize } = request.query as { page: number; pageSize: number };
      const db = getDb();
      const result = await getPointsHistory(db, user.id, page, pageSize);
      return reply.code(200).send(result);
    },
  );

  // ── [수정요청 G] GET /api/v1/gamification/grades ─────────────────────────────
  // 공개 API. 등급 안내 페이지용 전체 등급 목록(레벨 오름차순).
  typed.get(
    "/gamification/grades",
    {
      schema: {
        description: "전체 등급 목록 조회 (등급 안내)",
        tags: ["gamification"],
        response: {
          200: gradesListResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();
      const result = await getGradesList(db);
      return reply.code(200).send(result);
    },
  );

  // ── [수정요청 G] END ─────────────────────────────────────────────────────────
}
