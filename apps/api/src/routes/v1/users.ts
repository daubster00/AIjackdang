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
import { eq, and, ne } from "drizzle-orm";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { uploadImage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../services/storage/index.js";
import { parseMultipartFile } from "../../services/storage/multipart.js";
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
        followersCount: 0,
        followingCount: 0,
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

      const { nickname, bio, links, avatarUrl, bannerUrl } = request.body;

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

      return reply.code(200).send({
        id: updatedUser.id,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        status: updatedUser.status,
        emailVerified: updatedUser.emailVerified,
        defaultAvatarIndex: updatedUser.defaultAvatarIndex,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        createdAt: updatedUser.createdAt.toISOString(),
      });
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
    const contentType = request.headers["content-type"] ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return reply.code(400).send({
        error: { code: "INVALID_CONTENT_TYPE", message: "multipart/form-data 형식으로 전송해주세요." },
      });
    }

    // 원시 body 읽기 — multipart/form-data 는 Fastify 기본 파서가 처리하지 않으므로 raw stream 에서 읽는다.
    // Fastify 의 body 파서가 이미 stream 을 소비한 경우 body 가 Buffer 일 수 있다.
    let bodyBuf: Buffer;

    const parsedBody = request.body as Buffer | Record<string, unknown> | null | undefined;
    if (parsedBody instanceof Buffer && parsedBody.length > 0) {
      bodyBuf = parsedBody;
    } else {
      // 스트림에서 직접 읽기
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        request.raw.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.raw.on("end", resolve);
        request.raw.on("error", reject);
      });
      bodyBuf = Buffer.concat(chunks);
    }

    // 크기 제한
    if (bodyBuf.length > MAX_UPLOAD_BYTES + 10 * 1024) {
      return reply.code(400).send({
        error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
      });
    }

    // 멀티파트 파싱
    const file = parseMultipartFile(bodyBuf, contentType);
    if (!file) {
      return reply.code(400).send({
        error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." },
      });
    }

    // 파일 크기 검증
    if (file.data.length > MAX_UPLOAD_BYTES) {
      return reply.code(400).send({
        error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
      });
    }

    // MIME 타입 검증
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return reply.code(400).send({
        error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." },
      });
    }

    // 업로드 (로컬 폴백)
    const result = uploadImage(file, subdir);

    // users 테이블 갱신
    const db = getDb();
    await db
      .update(schema.users)
      .set({ [userField]: result.url, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    return reply.code(200).send({ url: result.url });
  }
}
