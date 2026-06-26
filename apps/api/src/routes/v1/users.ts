/**
 * /api/v1/users 라우트 (Story 1.8 · 1.9 · 1.10 공유 시드).
 *
 * Story 1.8 (읽기 전용):
 * - GET /users/me            : 인증 필요. 현재 로그인 사용자 전체 공개정보(publicUserSchema).
 * - GET /users/profile/:nickname : 공개. 닉네임 기준 공개 프로필(publicProfileSchema).
 *
 * Story 1.9 (계정 설정):
 * - PATCH /users/me               : 프로필 수정 (인증 필요)
 * - GET   /users/check-nickname   : 닉네임 중복 확인 (인증 필요)
 * - POST  /users/me/password      : 비밀번호 변경 (인증 필요)
 * - GET   /users/me/accounts      : 연결된 providers 목록 (인증 필요)
 * - DELETE /users/me              : 회원 탈퇴 (인증 필요)
 * - POST  /users/uploads/avatar   : 아바타 이미지 업로드 (인증 필요)
 * - POST  /users/uploads/banner   : 배너 이미지 업로드 (인증 필요)
 * - POST  /users/uploads/editor-image : 에디터 인라인 이미지 업로드 (인증 필요)
 *
 * 인증 권위는 API 서버(project-context §보안). 인증 필요 라우트는 requireAuthHook 으로 게이팅한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import {
  publicUserSchema,
  publicProfileSchema,
  updateProfileSchema,
  changePasswordSchema,
  nicknameSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, ne, sql, desc, isNull, inArray } from "drizzle-orm";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { uploadImage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../services/storage/index.js";
import { enqueueAnonymize } from "../../queues/cleanup.queue.js";

/** 등급 키: 포인트 시스템(Epic 6) 전까지 신규/기존 모두 'rookie'(새내기). */
const DEFAULT_RANK = "rookie";

/** Argon2id 해시 파라미터 — user-auth.ts 와 동일 */
const ARGON2_OPTIONS = {
  algorithm: 2 as const, // Argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

/** 세션 user 타입 헬퍼 */
type RequestWithUser = { user?: { id: string; email?: string } };

/** request 에서 인증된 userId 추출 (requireAuthHook 통과 후 사용) */
function getSessionUserId(request: Parameters<typeof requireAuthHook>[0]): string {
  const u = (request as typeof request & RequestWithUser).user;
  return u?.id ?? "";
}

/** users 행 → publicUserSchema 응답 객체. GET·PATCH 공용. */
function toPublicUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    status: user.status,
    emailVerified: user.emailVerified,
    defaultAvatarIndex: user.defaultAvatarIndex,
    avatarUrl: user.avatarUrl,
    image: user.image,
    bio: user.bio,
    bannerUrl: user.bannerUrl,
    links: (user.links as { label: string; url: string }[] | null) ?? null,
    name: user.name ?? null,
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    // date 컬럼은 drizzle 에서 'YYYY-MM-DD' 문자열로 반환됨
    birthDate: (user.birthDate as string | null) ?? null,
    marketingAgreed: user.marketingAgreedAt != null,
    termsAgreedAt: user.termsAgreedAt ? user.termsAgreedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

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
      const sessionUser = (request as typeof request & { user?: { id: string } }).user;
      if (!sessionUser?.id) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

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

      return reply.code(200).send(toPublicUser(user));
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

      if (!user || user.status === "withdrawn") {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      const [followersResult, followingResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.follows)
          .where(eq(schema.follows.followingId, user.id)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.follows)
          .where(eq(schema.follows.followerId, user.id)),
      ]);

      return reply.code(200).send({
        id: user.id,
        nickname: user.nickname,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        image: user.image,
        defaultAvatarIndex: user.defaultAvatarIndex,
        bannerUrl: user.bannerUrl,
        rank: DEFAULT_RANK,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
        followersCount: followersResult[0]?.count ?? 0,
        followingCount: followingResult[0]?.count ?? 0,
        featuredPostIds: (user.featuredPostIds as string[] | null) ?? [],
      });
    },
  );

  // ── [1.9] PATCH /users/me — 프로필 수정 (인증 필요) ────────────────────────────
  typed.patch(
    "/users/me",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "현재 로그인한 사용자의 프로필을 수정한다.",
        tags: ["users"],
        body: updateProfileSchema.extend({
          avatarUrl: z.string().nullable().optional(),
          bannerUrl: z.string().nullable().optional(),
          /** 기본 아바타 선택 시 인덱스. 함께 avatarUrl:null 을 보내면 커스텀 해제. */
          defaultAvatarIndex: z.number().int().nonnegative().optional(),
        }),
        response: {
          200: publicUserSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const db = getDb();
      const [existingUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!existingUser || existingUser.status === "withdrawn") {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      const {
        nickname,
        bio,
        links,
        avatarUrl,
        bannerUrl,
        defaultAvatarIndex,
        name,
        phone,
        gender,
        birthDate,
        marketingAgreed,
      } = request.body;

      // 닉네임 변경 시 중복 체크
      if (nickname !== undefined && nickname !== existingUser.nickname) {
        // nicknameSchema 검증은 updateProfileSchema 가 이미 수행
        const [dup] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              eq(schema.users.nickname, nickname),
              ne(schema.users.id, userId),
            ),
          )
          .limit(1);

        if (dup) {
          return reply.code(409).send({
            error: { code: "NICKNAME_TAKEN", message: "이미 사용 중인 닉네임입니다." },
          });
        }
      }

      // 업데이트 페이로드 구성 (변경된 필드만)
      const updatePayload: Partial<typeof schema.users.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (nickname !== undefined) updatePayload.nickname = nickname;
      if (bio !== undefined) updatePayload.bio = bio;
      if (links !== undefined) updatePayload.links = links;
      if (avatarUrl !== undefined) updatePayload.avatarUrl = avatarUrl;
      if (bannerUrl !== undefined) updatePayload.bannerUrl = bannerUrl;
      if (defaultAvatarIndex !== undefined) updatePayload.defaultAvatarIndex = defaultAvatarIndex;
      // 회원정보 (수정요청 F)
      if (name !== undefined) updatePayload.name = name;
      if (phone !== undefined) updatePayload.phone = phone;
      if (gender !== undefined) updatePayload.gender = gender;
      if (birthDate !== undefined) updatePayload.birthDate = birthDate;
      if (marketingAgreed !== undefined) {
        updatePayload.marketingAgreedAt = marketingAgreed ? new Date() : null;
      }

      const [updatedUser] = await db
        .update(schema.users)
        .set(updatePayload)
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      return reply.code(200).send(toPublicUser(updatedUser));
    },
  );

  // ── [1.9] GET /users/check-nickname — 닉네임 중복 확인 (인증 필요) ──────────────
  typed.get(
    "/users/check-nickname",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "닉네임 중복 여부 확인. 현재 사용자 자신은 제외한다.",
        tags: ["users"],
        querystring: z.object({ nickname: z.string() }),
        response: {
          200: z.object({ available: z.boolean() }),
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { nickname } = request.query;

      // 닉네임 형식 검증
      const parsed = nicknameSchema.safeParse(nickname);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "INVALID_NICKNAME", message: parsed.error.issues[0]?.message ?? "올바르지 않은 닉네임 형식입니다." },
        });
      }

      const db = getDb();
      const [dup] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.nickname, nickname),
            ne(schema.users.id, userId),
          ),
        )
        .limit(1);

      return reply.code(200).send({ available: !dup });
    },
  );

  // ── [1.9] POST /users/me/password — 비밀번호 변경 (인증 필요) ──────────────────
  typed.post(
    "/users/me/password",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "현재 비밀번호 확인 후 새 비밀번호로 변경한다.",
        tags: ["users"],
        body: changePasswordSchema,
        response: {
          200: z.object({ ok: z.literal(true) }),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { currentPassword, newPassword } = request.body;
      const db = getDb();

      // credential 계정 조회 (accounts.providerId = 'credential')
      const [credentialAccount] = await db
        .select()
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.userId, userId),
            eq(schema.accounts.providerId, "credential"),
          ),
        )
        .limit(1);

      if (!credentialAccount || !credentialAccount.password) {
        return reply.code(401).send({
          error: { code: "NO_CREDENTIAL_ACCOUNT", message: "비밀번호 로그인 계정이 없습니다." },
        });
      }

      // 현재 비밀번호 검증 (Argon2id)
      const valid = await argon2Verify(credentialAccount.password, currentPassword);
      if (!valid) {
        return reply.code(401).send({
          error: { code: "WRONG_PASSWORD", message: "현재 비밀번호가 올바르지 않습니다." },
        });
      }

      // 새 비밀번호 Argon2id 해시
      const newHash = await argon2Hash(newPassword, ARGON2_OPTIONS);

      await db
        .update(schema.accounts)
        .set({ password: newHash, updatedAt: new Date() })
        .where(eq(schema.accounts.id, credentialAccount.id));

      return reply.code(200).send({ ok: true });
    },
  );

  // ── [1.9] GET /users/me/accounts — 연결된 providers 목록 (인증 필요) ───────────
  typed.get(
    "/users/me/accounts",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "현재 사용자에 연결된 인증 providers 목록. 소셜 전용 여부 판별에 사용.",
        tags: ["users"],
        response: {
          200: z.object({
            providers: z.array(z.string()),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const db = getDb();
      const accountRows = await db
        .select({ providerId: schema.accounts.providerId })
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, userId));

      const providers = accountRows.map((a) => a.providerId);
      return reply.code(200).send({ providers });
    },
  );

  // ── [1.9] DELETE /users/me — 회원 탈퇴 (인증 필요) ────────────────────────────
  typed.delete(
    "/users/me",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "회원 탈퇴. users.status=withdrawn + deletedAt 설정. 세션 전부 삭제.",
        tags: ["users"],
        response: {
          200: z.object({ ok: z.literal(true) }),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const db = getDb();

      // 사용자 존재 확인
      const [existingUser] = await db
        .select({ id: schema.users.id, status: schema.users.status })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!existingUser || existingUser.status === "withdrawn") {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      // Soft-delete: status = 'withdrawn' + deletedAt = now()
      await db
        .update(schema.users)
        .set({ status: "withdrawn", deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.users.id, userId));

      // 세션 전부 삭제 (sessions.userId cascade 가 있지만 명시적으로 제거)
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, userId));

      // 콘텐츠 익명화를 cleanup 큐에 위임 (fire-and-forget)
      await enqueueAnonymize(userId);

      return reply.code(200).send({ ok: true });
    },
  );

  // ── [1.9] POST /users/uploads/avatar — 아바타 이미지 업로드 (인증 필요) ─────────
  app.post(
    "/users/uploads/avatar",
    { preHandler: [requireAuthHook] },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      return handleImageUpload(request, reply, userId, "avatars", "avatarUrl");
    },
  );

  // ── [1.9] POST /users/uploads/banner — 배너 이미지 업로드 (인증 필요) ──────────
  app.post(
    "/users/uploads/banner",
    { preHandler: [requireAuthHook] },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      return handleImageUpload(request, reply, userId, "banners", "bannerUrl");
    },
  );

  // ── [에디터] POST /users/uploads/editor-image — 에디터 인라인 이미지 업로드 ──────
  app.post(
    "/users/uploads/editor-image",
    { preHandler: [requireAuthHook] },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

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
        return reply.code(400).send({
          error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." },
        });
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
        "editor-images",
      );

      return reply.code(200).send({ url: result.url });
    },
  );

  // ── GET /users/me/posts — 내가 쓴 글 + 실전자료 통합 목록 ─────────────────────
  // 마이페이지 "내가 쓴 글" 탭: posts(published) + resources(published/draft/hidden)
  // 두 결과를 createdAt DESC 로 머지하여 반환.
  // board 슬러그가 BOARDS 상수 키와 동일하므로 urlPath 조합은 웹에서 처리.
  typed.get(
    "/users/me/posts",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "현재 로그인 사용자가 작성한 게시글(published) + 실전자료(draft 포함) 통합 목록. 최신순 반환.",
        tags: ["users"],
        querystring: z.object({
          pageSize: z.coerce.number().int().positive().max(200).default(100),
        }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                kind: z.enum(["post", "resource"]),
                board: z.string(),
                boardLabel: z.string(),
                slug: z.string(),
                title: z.string(),
                excerpt: z.string().nullable(),
                createdAt: z.string(),
                likeCount: z.number(),
                commentCount: z.number(),
                viewCount: z.number(),
              }),
            ),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }
      const { pageSize } = request.query;
      const db = getDb();

      // ── 게시글 (status=published, deletedAt IS NULL) ──────────────────────────
      const postRows = await db
        .select({
          id: schema.posts.id,
          slug: schema.posts.slug,
          title: schema.posts.title,
          summary: schema.posts.summary,
          board: schema.posts.board,
          viewCount: schema.posts.viewCount,
          createdAt: schema.posts.createdAt,
        })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.userId, userId),
            eq(schema.posts.status, "published"),
            isNull(schema.posts.deletedAt),
          ),
        )
        .orderBy(desc(schema.posts.createdAt))
        .limit(pageSize);

      // ── 실전자료 (status != deleted, deletedAt IS NULL) ──────────────────────
      const resourceRows = await db
        .select({
          id: schema.resources.id,
          slug: schema.resources.slug,
          title: schema.resources.title,
          summary: schema.resources.summary,
          createdAt: schema.resources.createdAt,
        })
        .from(schema.resources)
        .where(
          and(
            eq(schema.resources.userId, userId),
            ne(schema.resources.status, "deleted"),
            isNull(schema.resources.deletedAt),
          ),
        )
        .orderBy(desc(schema.resources.createdAt))
        .limit(pageSize);

      // ── 두 결과 머지 + createdAt DESC 정렬 + pageSize 제한 ──────────────────
      type MergedItem = {
        id: string;
        kind: "post" | "resource";
        board: string;
        boardLabel: string;
        slug: string;
        title: string;
        excerpt: string | null;
        createdAt: string;
        likeCount: number;
        commentCount: number;
        viewCount: number;
        _ts: number;
      };

      // board 슬러그 → 라벨 매핑 (contracts/board.ts 기반, 웹 BOARDS와 동일 값)
      const boardLabelMap: Record<string, string> = {
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

      const merged: MergedItem[] = [
        ...postRows.map((p) => ({
          id: p.id,
          kind: "post" as const,
          board: p.board,
          boardLabel: boardLabelMap[p.board] ?? p.board,
          slug: p.slug,
          title: p.title,
          excerpt: p.summary ?? null,
          createdAt: p.createdAt.toISOString(),
          likeCount: 0,
          commentCount: 0,
          viewCount: p.viewCount,
          _ts: p.createdAt.getTime(),
        })),
        ...resourceRows.map((r) => ({
          id: r.id,
          kind: "resource" as const,
          board: "resources",
          boardLabel: "실전자료",
          slug: r.slug,
          title: r.title,
          excerpt: r.summary ?? null,
          createdAt: r.createdAt.toISOString(),
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
          _ts: r.createdAt.getTime(),
        })),
      ];

      merged.sort((a, b) => b._ts - a._ts);
      const items = merged.slice(0, pageSize).map(({ _ts: _, ...rest }) => rest);

      return reply.code(200).send({ items });
    },
  );

  // ── GET /users/profile/:nickname/featured-posts — 공개 피처드 글 목록 ─────────
  // 해당 사용자의 featuredPostIds 에 해당하는 게시글 데이터를 공개로 반환한다.
  typed.get(
    "/users/profile/:nickname/featured-posts",
    {
      schema: {
        description: "사용자가 계정 페이지에 노출로 설정한 글 목록 (공개).",
        tags: ["users"],
        params: z.object({ nickname: z.string() }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                kind: z.enum(["post", "resource"]),
                board: z.string(),
                boardLabel: z.string(),
                slug: z.string(),
                title: z.string(),
                excerpt: z.string().nullable(),
                createdAt: z.string(),
                viewCount: z.number(),
              }),
            ),
          }),
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params;
      const db = getDb();

      const [user] = await db
        .select({ id: schema.users.id, featuredPostIds: schema.users.featuredPostIds })
        .from(schema.users)
        .where(eq(schema.users.nickname, nickname))
        .limit(1);

      if (!user || !user.id) {
        return reply.code(404).send({
          error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없어요." },
        });
      }

      const ids = (user.featuredPostIds as string[] | null) ?? [];
      if (ids.length === 0) {
        return reply.code(200).send({ items: [] });
      }

      // board 슬러그 → 라벨 매핑
      const boardLabelMap: Record<string, string> = {
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

      const postRows = await db
        .select({
          id: schema.posts.id,
          slug: schema.posts.slug,
          title: schema.posts.title,
          summary: schema.posts.summary,
          board: schema.posts.board,
          viewCount: schema.posts.viewCount,
          createdAt: schema.posts.createdAt,
        })
        .from(schema.posts)
        .where(
          and(
            inArray(schema.posts.id, ids),
            eq(schema.posts.status, "published"),
            isNull(schema.posts.deletedAt),
          ),
        );

      // featured 순서를 featuredPostIds 배열 순서에 맞춰 정렬
      const rowMap = new Map(postRows.map((r) => [r.id, r]));
      const items = ids
        .filter((id) => rowMap.has(id))
        .map((id) => {
          const p = rowMap.get(id)!;
          return {
            id: p.id,
            kind: "post" as const,
            board: p.board,
            boardLabel: boardLabelMap[p.board] ?? p.board,
            slug: p.slug,
            title: p.title,
            excerpt: p.summary ?? null,
            createdAt: p.createdAt.toISOString(),
            viewCount: p.viewCount,
          };
        });

      return reply.code(200).send({ items });
    },
  );

  // ── PATCH /users/me/featured-posts — 피처드 글 설정 (인증 필요) ────────────────
  // 본인 글(post, published) 중 최대 5개를 featuredPostIds 로 등록한다.
  typed.patch(
    "/users/me/featured-posts",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "계정 페이지에 노출할 글 id 목록을 설정한다. 최대 5개, 본인 글만 허용.",
        tags: ["users"],
        body: z.object({
          postIds: z
            .array(z.string().uuid("올바른 게시글 id 형식이 아닙니다"))
            .max(5, "최대 5개까지 선택할 수 있습니다"),
        }),
        response: {
          200: z.object({ ok: z.literal(true) }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      if (!userId) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const { postIds } = request.body;

      if (postIds.length > 0) {
        const db = getDb();
        // 모든 id 가 본인 글(published)인지 검증
        const ownedPosts = await db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(
            and(
              inArray(schema.posts.id, postIds),
              eq(schema.posts.userId, userId),
              eq(schema.posts.status, "published"),
              isNull(schema.posts.deletedAt),
            ),
          );

        if (ownedPosts.length !== postIds.length) {
          return reply.code(403).send({
            error: {
              code: "POST_NOT_OWNED",
              message: "선택한 글 중 본인 글이 아니거나 공개되지 않은 글이 포함되어 있습니다.",
            },
          });
        }

        await db
          .update(schema.users)
          .set({ featuredPostIds: postIds, updatedAt: new Date() })
          .where(eq(schema.users.id, userId));
      } else {
        // 빈 배열: 피처드 글 전부 해제
        const db = getDb();
        await db
          .update(schema.users)
          .set({ featuredPostIds: [], updatedAt: new Date() })
          .where(eq(schema.users.id, userId));
      }

      return reply.code(200).send({ ok: true });
    },
  );

  /**
   * 공통 이미지 업로드 핸들러.
   * multipart/form-data 요청에서 파일을 읽어 업로드 후 users 테이블을 갱신한다.
   */
  async function handleImageUpload(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
    userId: string,
    subdir: "avatars" | "banners",
    userField: "avatarUrl" | "bannerUrl",
  ) {
    // @fastify/multipart 로 단일 파일을 읽는다.
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
      return reply.code(400).send({
        error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." },
      });
    }

    // MIME 타입 검증
    if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
      return reply.code(400).send({
        error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." },
      });
    }

    const buffer = await part.toBuffer();
    // 크기 초과(@fastify/multipart limits.fileSize 초과 시 truncated=true)
    if (part.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
      return reply.code(400).send({
        error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
      });
    }

    // 업로드 (S3/MinIO, 미설정 시 로컬 폴백)
    const result = await uploadImage(
      { filename: part.filename, mimetype: part.mimetype, data: buffer },
      subdir,
    );

    // users 테이블 갱신
    const db = getDb();
    await db
      .update(schema.users)
      .set({ [userField]: result.url, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    return reply.code(200).send({ url: result.url });
  }
}
