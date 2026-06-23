/**
 * /api/v1/users 라우트 (Story 1.8 · 1.10 공유 시드).
 *
 * - GET /users/me            : 인증 필요. 현재 로그인 사용자 전체 공개정보(publicUserSchema).
 * - GET /users/profile/:nickname : 공개. 닉네임 기준 공개 프로필(publicProfileSchema).
 *
 * 인증 권위는 API 서버(project-context §보안). /me 는 requireAuthHook 으로 게이팅한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import {
  publicUserSchema,
  publicProfileSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuthHook } from "../../plugins/require-auth.js";

/** 등급 키: 포인트 시스템(Epic 6) 전까지 신규/기존 모두 'rookie'(새내기). */
const DEFAULT_RANK = "rookie";

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /users/me — 현재 로그인 사용자 (인증 필요) ─────────────────────────────
  typed.get(
    "/users/me",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "현재 로그인한 사용자의 공개 프로필 정보.",
        tags: ["users"],
        response: {
          200: publicUserSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // requireAuthHook 가 request.user(Better Auth 세션 user)를 주입.
      const sessionUser = (request as typeof request & { user?: { id: string } }).user;
      if (!sessionUser?.id) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      // 세션 user 에는 bio 등이 없으므로 DB 에서 전체 row 조회.
      const db = getDb();
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, sessionUser.id))
        .limit(1);

      if (!user || user.status === "withdrawn") {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      return reply.code(200).send({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        status: user.status,
        emailVerified: user.emailVerified,
        defaultAvatarIndex: user.defaultAvatarIndex,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt.toISOString(),
      });
    },
  );

  // ── GET /users/profile/:nickname — 공개 프로필 (인증 불필요) ───────────────────
  typed.get(
    "/users/profile/:nickname",
    {
      schema: {
        description: "닉네임 기준 공개 프로필. 비회원도 열람 가능.",
        tags: ["users"],
        params: z.object({ nickname: z.string() }),
        response: {
          200: publicProfileSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params;
      const db = getDb();
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.nickname, nickname))
        .limit(1);

      // 없거나 탈퇴 회원 → 민감정보 노출 없이 404.
      if (!user || user.status === "withdrawn") {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      return reply.code(200).send({
        id: user.id,
        nickname: user.nickname,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        defaultAvatarIndex: user.defaultAvatarIndex,
        bannerUrl: user.bannerUrl,
        rank: DEFAULT_RANK,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
        followersCount: 0, // Epic 5 Story 5.12 에서 실집계
        followingCount: 0, // Epic 5 Story 5.12 에서 실집계
      });
    },
  );
}
