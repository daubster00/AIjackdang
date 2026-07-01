/**
 * /api/v1/blocks 라우트 — Story 5.11
 *
 * POST   /api/v1/blocks              회원 차단 (인증 필수)
 * DELETE /api/v1/blocks/:id          차단 해제 (인증 필수, 소유자만)
 * GET    /api/v1/users/me/blocks     차단 목록 (인증 필수)
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import { getDefaultAvatarUrl } from "@ai-jakdang/core";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function blocksRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /api/v1/blocks ───────────────────────────────────────────────────
  typed.post(
    "/blocks",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "회원 차단",
        tags: ["blocks"],
        body: z.union([
          z.object({ blockedId: z.string().uuid() }),
          z.object({ blockedNickname: z.string() }),
        ]),
        response: {
          201: z.object({ id: z.string().uuid() }),
          400: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const db = getDb();

      // blockedId 또는 blockedNickname 중 하나 수용
      let blockedId: string;
      if ("blockedNickname" in request.body) {
        const found = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.nickname, request.body.blockedNickname))
          .limit(1);
        if (!found[0]) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." } });
        blockedId = found[0].id;
      } else {
        blockedId = request.body.blockedId;
      }

      if (user.id === blockedId) {
        return reply.code(400).send({
          error: { code: "SELF_BLOCK_FORBIDDEN", message: "자신을 차단할 수 없습니다." },
        });
      }

      const existing = await db
        .select({ id: schema.blocks.id })
        .from(schema.blocks)
        .where(and(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, blockedId)))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: { code: "ALREADY_BLOCKED", message: "이미 차단한 회원입니다." },
        });
      }

      const [row] = await db
        .insert(schema.blocks)
        .values({ blockerId: user.id, blockedId })
        .returning({ id: schema.blocks.id });

      return reply.code(201).send({ id: row.id });
    },
  );

  // ── DELETE /api/v1/blocks/:id ─────────────────────────────────────────────
  typed.delete(
    "/blocks/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "차단 해제",
        tags: ["blocks"],
        params: z.object({ id: z.string().uuid() }),
        response: { 204: z.object({}), 403: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;
      const db = getDb();

      const existing = await db
        .select({ blockerId: schema.blocks.blockerId })
        .from(schema.blocks)
        .where(eq(schema.blocks.id, id))
        .limit(1);

      if (!existing[0]) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "차단 기록을 찾을 수 없습니다." } });
      }
      if (existing[0].blockerId !== user.id) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "권한이 없습니다." } });
      }

      await db.delete(schema.blocks).where(eq(schema.blocks.id, id));
      return reply.code(204).send({});
    },
  );

  // ── GET /api/v1/users/me/blocks ───────────────────────────────────────────
  typed.get(
    "/users/me/blocks",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "차단 목록",
        tags: ["blocks"],
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(50).default(20),
        }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string().uuid(),
                blockedId: z.string().uuid(),
                nickname: z.string(),
                avatarUrl: z.string(),
                createdAt: z.string(),
              }),
            ),
            meta: z.object({ page: z.number(), pageSize: z.number() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { page, pageSize } = request.query;
      const db = getDb();

      const rows = await db
        .select({
          id: schema.blocks.id,
          blockedId: schema.blocks.blockedId,
          nickname: schema.users.nickname,
          avatarUrl: schema.users.avatarUrl,
          image: schema.users.image,
          defaultAvatarIndex: schema.users.defaultAvatarIndex,
          createdAt: schema.blocks.createdAt,
        })
        .from(schema.blocks)
        .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId))
        .where(eq(schema.blocks.blockerId, user.id))
        .orderBy(desc(schema.blocks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return reply.send({
        items: rows.map((r) => ({
          id: r.id,
          blockedId: r.blockedId,
          nickname: r.nickname,
          avatarUrl: r.avatarUrl || r.image || getDefaultAvatarUrl(r.defaultAvatarIndex ?? 0),
          createdAt: r.createdAt.toISOString(),
        })),
        meta: { page, pageSize },
      });
    },
  );
}
