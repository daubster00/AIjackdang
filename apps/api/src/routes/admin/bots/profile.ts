/**
 * 봇 공개 프로필 "연출" 관리 라우트.
 *
 * 봇은 로그인 자격증명이 없어 /settings/profile(본인 세션 전용)로 프로필을 꾸밀 수 없다.
 * 관리자가 봇 대신 users 행(배너·아바타·소개·링크·노출글)을 채워 넣어 진짜 유저처럼 보이게 한다.
 *
 * GET   /api/v1/admin/bots/:id/profile          — 봇 유저의 프로필 필드 조회
 * PATCH /api/v1/admin/bots/:id/profile          — 소개·기본아바타·링크·아바타/배너 제거
 * POST  /api/v1/admin/bots/:id/uploads/avatar   — 커스텀 아바타 업로드(multipart)
 * POST  /api/v1/admin/bots/:id/uploads/banner   — 배너 업로드(multipart)
 * GET   /api/v1/admin/bots/:id/posts            — 봇이 작성한 발행 글 목록(노출글 선택용)
 * PATCH /api/v1/admin/bots/:id/featured-posts   — 프로필에 노출할 글 id(최대 5개) 설정
 *
 * 모든 라우트: requireSuperAdmin.
 * 봇 페르소나에 연결된 users 행이 없으면(userId=null) 400 을 반환한다.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "@ai-jakdang/database";
import { users, posts, botPersonas } from "@ai-jakdang/database/schema";
import { and, eq, inArray, isNull, desc } from "drizzle-orm";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  uploadImage,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage/index.js";

// ── board 슬러그 → 라벨 (users.ts 와 동일 매핑) ────────────────────────────────
const BOARD_LABEL_MAP: Record<string, string> = {
  "vibe-coding-guide": "바이브 코딩 가이드",
  "vibe-coding-tips": "바이브 코딩 팁",
  "automation-guide": "자동화 가이드",
  "automation-cases": "자동화 사례",
  "automation-tips": "자동화 팁",
  "monetization-tips": "수익화 팁",
  "monetization-cases": "수익화 사례",
  "ai-creation": "AI 창작물",
  "ai-products": "AI 제품 · 서비스",
  talk: "작당 라운지",
  gigs: "구인구직",
  notice: "공지사항",
};

// ── 페르소나 id → 연결된 봇 유저 조회 ───────────────────────────────────────────
// 반환: { userId, nickname }. 페르소나 없음 → NOT_FOUND, 유저 미연결 → NO_USER.
async function resolveBotUser(personaId: string): Promise<{ userId: string; nickname: string }> {
  const db = getDb();
  const [persona] = await db
    .select({ id: botPersonas.id, userId: botPersonas.userId })
    .from(botPersonas)
    .where(eq(botPersonas.id, personaId))
    .limit(1);

  if (!persona) {
    throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }
  if (!persona.userId) {
    throw Object.assign(
      new Error("이 봇에는 연결된 유저 계정이 없습니다. (프로필을 꾸밀 수 없음)"),
      { code: "NO_USER" },
    );
  }

  const [user] = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, persona.userId))
    .limit(1);

  if (!user) {
    throw Object.assign(new Error("봇 유저 계정을 찾을 수 없습니다."), { code: "NO_USER" });
  }
  return { userId: user.id, nickname: user.nickname };
}

// 도메인 에러를 HTTP 응답으로 변환하는 공통 핸들러
function sendDomainError(reply: FastifyReply, err: unknown): FastifyReply {
  const e = err as Error & { code?: string };
  if (e.code === "NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
  }
  if (e.code === "NO_USER") {
    return reply.status(400).send({ error: { code: "NO_USER", message: e.message } });
  }
  throw err;
}

// ── multipart 단일 이미지 업로드 → users 필드 갱신 ─────────────────────────────
async function handleBotImageUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  subdir: "avatars" | "banners",
  userField: "avatarUrl" | "bannerUrl",
): Promise<FastifyReply> {
  const reqWithFile = request as typeof request & {
    isMultipart?: () => boolean;
    file?: () => Promise<
      | {
          filename: string;
          mimetype: string;
          file: { truncated: boolean };
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  };

  if (!reqWithFile.isMultipart?.()) {
    return reply.code(400).send({
      error: { code: "INVALID_CONTENT_TYPE", message: "multipart/form-data 형식으로 전송해주세요." },
    });
  }

  const part = await reqWithFile.file?.();
  if (!part) {
    return reply.code(400).send({ error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." } });
  }
  if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
    return reply.code(400).send({
      error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." },
    });
  }

  const buffer = await part.toBuffer();
  if (part.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
    return reply.code(400).send({
      error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
    });
  }

  const result = await uploadImage(
    { filename: part.filename, mimetype: part.mimetype, data: buffer },
    subdir,
  );

  const db = getDb();
  await db
    .update(users)
    .set({ [userField]: result.url, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return reply.code(200).send({ url: result.url });
}

// ── 스키마 ────────────────────────────────────────────────────────────────────
const profilePatchSchema = z.object({
  bio: z.string().max(200, "소개는 200자 이내여야 합니다").nullable().optional(),
  defaultAvatarIndex: z.number().int().min(0).max(9).optional(),
  links: z
    .array(z.object({ label: z.string().max(40), url: z.string().url("올바른 URL이 아닙니다") }))
    .max(5, "링크는 최대 5개까지 등록할 수 있습니다")
    .optional(),
  /** true 면 커스텀 아바타를 제거하고 기본 아바타로 되돌린다. */
  clearAvatar: z.boolean().optional(),
  /** true 면 배너 이미지를 제거한다. */
  clearBanner: z.boolean().optional(),
});

const featuredPostsSchema = z.object({
  postIds: z
    .array(z.string().uuid("올바른 게시글 id 형식이 아닙니다"))
    .max(5, "최대 5개까지 선택할 수 있습니다"),
});

// ── 라우트 등록 ────────────────────────────────────────────────────────────────
export async function registerAdminBotProfileRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /admin/bots/:id/profile ───────────────────────────────────────────
  app.get(
    "/admin/bots/:id/profile",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const { userId, nickname } = await resolveBotUser(id);
        const db = getDb();
        const [row] = await db
          .select({
            nickname: users.nickname,
            bio: users.bio,
            image: users.image,
            avatarUrl: users.avatarUrl,
            bannerUrl: users.bannerUrl,
            defaultAvatarIndex: users.defaultAvatarIndex,
            links: users.links,
            featuredPostIds: users.featuredPostIds,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        return reply.send({
          userId,
          nickname,
          bio: row?.bio ?? null,
          image: row?.image ?? null,
          avatarUrl: row?.avatarUrl ?? null,
          bannerUrl: row?.bannerUrl ?? null,
          defaultAvatarIndex: row?.defaultAvatarIndex ?? 0,
          links: (row?.links as { label: string; url: string }[] | null) ?? [],
          featuredPostIds: (row?.featuredPostIds as string[] | null) ?? [],
          publicProfilePath: `/u/${nickname}`,
        });
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );

  // ── PATCH /admin/bots/:id/profile ─────────────────────────────────────────
  app.patch(
    "/admin/bots/:id/profile",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = profilePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const { userId } = await resolveBotUser(id);
        const data = parsed.data;
        const updateSet: Record<string, unknown> = { updatedAt: new Date() };
        if (data.bio !== undefined) updateSet.bio = data.bio;
        if (data.defaultAvatarIndex !== undefined) updateSet.defaultAvatarIndex = data.defaultAvatarIndex;
        if (data.links !== undefined) updateSet.links = data.links;
        if (data.clearAvatar) updateSet.avatarUrl = null;
        if (data.clearBanner) updateSet.bannerUrl = null;

        const db = getDb();
        await db.update(users).set(updateSet).where(eq(users.id, userId));
        return reply.send({ ok: true });
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );

  // ── POST /admin/bots/:id/uploads/avatar ───────────────────────────────────
  app.post(
    "/admin/bots/:id/uploads/avatar",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const { userId } = await resolveBotUser(id);
        return handleBotImageUpload(request, reply, userId, "avatars", "avatarUrl");
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );

  // ── POST /admin/bots/:id/uploads/banner ───────────────────────────────────
  app.post(
    "/admin/bots/:id/uploads/banner",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const { userId } = await resolveBotUser(id);
        return handleBotImageUpload(request, reply, userId, "banners", "bannerUrl");
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );

  // ── GET /admin/bots/:id/posts — 봇이 쓴 발행 글 목록(노출글 선택용) ──────────
  app.get(
    "/admin/bots/:id/posts",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const { userId } = await resolveBotUser(id);
        const db = getDb();
        const rows = await db
          .select({
            id: posts.id,
            slug: posts.slug,
            title: posts.title,
            summary: posts.summary,
            board: posts.board,
            viewCount: posts.viewCount,
            createdAt: posts.createdAt,
          })
          .from(posts)
          .where(
            and(
              eq(posts.userId, userId),
              eq(posts.status, "published"),
              isNull(posts.deletedAt),
            ),
          )
          .orderBy(desc(posts.createdAt))
          .limit(100);

        const items = rows.map((p) => ({
          id: p.id,
          board: p.board,
          boardLabel: BOARD_LABEL_MAP[p.board] ?? p.board,
          slug: p.slug,
          title: p.title,
          excerpt: p.summary ?? null,
          createdAt: p.createdAt.toISOString(),
          viewCount: p.viewCount,
        }));
        return reply.send({ items });
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );

  // ── PATCH /admin/bots/:id/featured-posts — 노출글 설정(최대 5개) ────────────
  app.patch(
    "/admin/bots/:id/featured-posts",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = featuredPostsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const { userId } = await resolveBotUser(id);
        const { postIds } = parsed.data;
        const db = getDb();

        if (postIds.length > 0) {
          // 선택 글이 모두 이 봇의 발행 글인지 검증
          const owned = await db
            .select({ id: posts.id })
            .from(posts)
            .where(
              and(
                inArray(posts.id, postIds),
                eq(posts.userId, userId),
                eq(posts.status, "published"),
                isNull(posts.deletedAt),
              ),
            );
          if (owned.length !== postIds.length) {
            return reply.status(400).send({
              error: {
                code: "POST_NOT_OWNED",
                message: "선택한 글 중 이 봇의 글이 아니거나 공개되지 않은 글이 있습니다.",
              },
            });
          }
        }

        await db
          .update(users)
          .set({ featuredPostIds: postIds, updatedAt: new Date() })
          .where(eq(users.id, userId));
        return reply.send({ ok: true });
      } catch (err) {
        try {
          return sendDomainError(reply, err);
        } catch (rethrown) {
          request.log.error(rethrown);
          return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
        }
      }
    },
  );
}
