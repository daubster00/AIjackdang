/**
 * /api/v1/follows 라우트 — Story 5.12
 *
 * POST   /api/v1/follows                           팔로우 (인증 필수, 멱등)
 * DELETE /api/v1/follows/:targetNickname           언팔로우 (인증 필수)
 * GET    /api/v1/users/:nickname/following         팔로잉 목록
 * GET    /api/v1/users/:nickname/followers         팔로워 목록
 * GET    /api/v1/users/:nickname/follow-status     뷰어의 팔로우 여부
 */

import { getDb, schema } from "@ai-jakdang/database";
import { getNotificationsQueue } from "../../lib/queues.js";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { errorResponseSchema } from "@ai-jakdang/contracts";

type RequestWithUser = FastifyRequest & { user: { id: string } };

const followUserSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  image: z.string().nullable(),
  defaultAvatarIndex: z.number().nullable(),
});

export async function followsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /api/v1/follows ──────────────────────────────────────────────────
  typed.post(
    "/follows",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "팔로우 (멱등)",
        tags: ["follows"],
        body: z.object({ followingId: z.string().uuid() }),
        response: {
          201: z.object({ message: z.string() }),
          400: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { followingId } = request.body;
      const db = getDb();

      if (user.id === followingId) {
        return reply.code(400).send({
          error: { code: "SELF_FOLLOW_FORBIDDEN", message: "자신을 팔로우할 수 없습니다." },
        });
      }

      // INSERT ON CONFLICT DO NOTHING (복합 PK 충돌 무시 — 멱등)
      await db
        .insert(schema.follows)
        .values({ followerId: user.id, followingId })
        .onConflictDoNothing();

      // follow.created 이벤트 발행 (Epic 7 구독 예정)
      try {
        const queue = getNotificationsQueue();
        await queue.add("follow.created", { followerId: user.id, followingId });
      } catch {
        // 큐 실패는 팔로우 자체를 막지 않음
      }

      return reply.code(201).send({ message: "팔로우했습니다." });
    },
  );

  // ── DELETE /api/v1/follows/:targetNickname ────────────────────────────────
  typed.delete(
    "/follows/:targetNickname",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "언팔로우",
        tags: ["follows"],
        params: z.object({ targetNickname: z.string() }),
        response: { 204: z.object({}), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetNickname } = request.params;
      const db = getDb();

      const targetUser = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.nickname, targetNickname))
        .limit(1);

      if (!targetUser[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." } });
      }

      await db
        .delete(schema.follows)
        .where(
          and(
            eq(schema.follows.followerId, user.id),
            eq(schema.follows.followingId, targetUser[0].id),
          ),
        );

      return reply.code(204).send({});
    },
  );

  // ── GET /api/v1/users/:nickname/following ─────────────────────────────────
  typed.get(
    "/users/:nickname/following",
    {
      schema: {
        description: "팔로잉 목록",
        tags: ["follows"],
        params: z.object({ nickname: z.string() }),
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(50).default(20),
        }),
        response: {
          200: z.object({ items: z.array(followUserSchema), meta: z.object({ page: z.number(), pageSize: z.number() }) }),
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params;
      const { page, pageSize } = request.query;
      const db = getDb();

      const targetUser = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.nickname, nickname))
        .limit(1);

      if (!targetUser[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." } });
      }

      const rows = await db
        .select({
          id: schema.users.id,
          nickname: schema.users.nickname,
          bio: schema.users.bio,
          avatarUrl: schema.users.avatarUrl,
          image: schema.users.image,
          defaultAvatarIndex: schema.users.defaultAvatarIndex,
        })
        .from(schema.follows)
        .innerJoin(schema.users, eq(schema.users.id, schema.follows.followingId))
        .where(eq(schema.follows.followerId, targetUser[0].id))
        .orderBy(desc(schema.follows.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return reply.send({ items: rows, meta: { page, pageSize } });
    },
  );

  // ── GET /api/v1/users/:nickname/followers ─────────────────────────────────
  typed.get(
    "/users/:nickname/followers",
    {
      schema: {
        description: "팔로워 목록",
        tags: ["follows"],
        params: z.object({ nickname: z.string() }),
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(50).default(20),
        }),
        response: {
          200: z.object({ items: z.array(followUserSchema), meta: z.object({ page: z.number(), pageSize: z.number() }) }),
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params;
      const { page, pageSize } = request.query;
      const db = getDb();

      const targetUser = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.nickname, nickname))
        .limit(1);

      if (!targetUser[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." } });
      }

      const rows = await db
        .select({
          id: schema.users.id,
          nickname: schema.users.nickname,
          bio: schema.users.bio,
          avatarUrl: schema.users.avatarUrl,
          image: schema.users.image,
          defaultAvatarIndex: schema.users.defaultAvatarIndex,
        })
        .from(schema.follows)
        .innerJoin(schema.users, eq(schema.users.id, schema.follows.followerId))
        .where(eq(schema.follows.followingId, targetUser[0].id))
        .orderBy(desc(schema.follows.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return reply.send({ items: rows, meta: { page, pageSize } });
    },
  );

  // ── GET /api/v1/users/:nickname/follow-status ─────────────────────────────
  typed.get(
    "/users/:nickname/follow-status",
    {
      schema: {
        description: "뷰어의 팔로우 여부 + 팔로워/팔로잉 카운트",
        tags: ["follows"],
        params: z.object({ nickname: z.string() }),
        querystring: z.object({ viewerId: z.string().uuid().optional() }),
        response: {
          404: errorResponseSchema,
          200: z.object({
            isFollowing: z.boolean(),
            isBlocked: z.boolean(),
            followersCount: z.number().int(),
            followingCount: z.number().int(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params;
      const { viewerId } = request.query;
      const db = getDb();

      const targetUser = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.nickname, nickname))
        .limit(1);

      if (!targetUser[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." } });
      }

      const targetId = targetUser[0].id;

      // 팔로워/팔로잉 카운트 (집계)
      const [followersResult, followingResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.follows)
          .where(eq(schema.follows.followingId, targetId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.follows)
          .where(eq(schema.follows.followerId, targetId)),
      ]);

      const followersCount = followersResult[0]?.count ?? 0;
      const followingCount = followingResult[0]?.count ?? 0;

      let isFollowing = false;
      let isBlocked = false;

      if (viewerId && viewerId !== targetId) {
        const [followRow, blockRow] = await Promise.all([
          db
            .select({ followerId: schema.follows.followerId })
            .from(schema.follows)
            .where(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followingId, targetId)))
            .limit(1),
          db
            .select({ id: schema.blocks.id })
            .from(schema.blocks)
            .where(and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, targetId)))
            .limit(1),
        ]);
        isFollowing = followRow.length > 0;
        isBlocked = blockRow.length > 0;
      }

      return reply.send({ isFollowing, isBlocked, followersCount, followingCount });
    },
  );
}
