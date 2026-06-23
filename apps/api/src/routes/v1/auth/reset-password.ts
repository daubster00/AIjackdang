/**
 * POST /api/v1/auth/reset-password — 비밀번호 재설정 완료 (Story 1.6).
 *
 * 흐름:
 * 1. verifications 테이블에서 토큰 조회
 * 2. 만료 또는 미존재 시 400 INVALID_TOKEN
 * 3. accounts(providerId 불문) password 컬럼 Argon2id 재해시
 * 4. 해당 user의 sessions 전부 삭제 (세션 무효화 — 기존 세션 탈취 방지)
 * 5. verifications 토큰 삭제 (재사용 방지)
 * 6. 200 반환
 */

import { resetPasswordSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { getDb, schema } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, like } from "drizzle-orm";
import { hash as argon2Hash } from "@node-rs/argon2";

const resetPasswordResponseSchema = z.object({
  message: z.string(),
});

/** Argon2id 파라미터 — user-auth.ts 와 동일 */
const ARGON2_OPTIONS = {
  algorithm: 2 as const, // Argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

/** verifications identifier 접두사 (forgot-password.ts 와 동일) */
const RESET_PREFIX = "password-reset:";

export async function registerResetPasswordRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/auth/reset-password",
    {
      schema: {
        description: "재설정 토큰으로 새 비밀번호를 설정한다. 기존 세션 전부 무효화.",
        tags: ["auth"],
        body: resetPasswordSchema,
        response: {
          200: resetPasswordResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body;
      const db = getDb();

      try {
        // 토큰 조회
        const verification = await db
          .select()
          .from(schema.verifications)
          .where(
            and(
              eq(schema.verifications.value, token),
              like(schema.verifications.identifier, `${RESET_PREFIX}%`),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (!verification) {
          return reply.code(400).send({
            error: {
              code: "INVALID_TOKEN",
              message: "링크가 만료됐거나 이미 사용됐어요.",
            },
          });
        }

        // 만료 체크
        if (new Date() > verification.expiresAt) {
          // 만료된 토큰 정리
          await db
            .delete(schema.verifications)
            .where(eq(schema.verifications.id, verification.id));

          return reply.code(400).send({
            error: {
              code: "INVALID_TOKEN",
              message: "링크가 만료됐거나 이미 사용됐어요.",
            },
          });
        }

        // identifier에서 이메일 추출: "password-reset:{email}"
        const email = verification.identifier.slice(RESET_PREFIX.length);

        // 사용자 조회
        const user = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (!user) {
          // 토큰은 있지만 사용자 없음 — 토큰 삭제 후 오류 반환
          await db
            .delete(schema.verifications)
            .where(eq(schema.verifications.id, verification.id));

          return reply.code(400).send({
            error: {
              code: "INVALID_TOKEN",
              message: "링크가 만료됐거나 이미 사용됐어요.",
            },
          });
        }

        // 새 비밀번호 Argon2id 해시
        const hashedPassword = await argon2Hash(newPassword, ARGON2_OPTIONS);

        // accounts.password 갱신 (credential 계정)
        await db
          .update(schema.accounts)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(
            and(
              eq(schema.accounts.userId, user.id),
              eq(schema.accounts.providerId, "credential"),
            ),
          );

        // 세션 전부 삭제 (세션 무효화 — AC #2)
        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, user.id));

        // 사용한 토큰 삭제 (재사용 방지)
        await db
          .delete(schema.verifications)
          .where(eq(schema.verifications.id, verification.id));

        request.log.info({ userId: user.id }, "비밀번호 재설정 완료 — 세션 무효화됨");

        return reply.code(200).send({
          message: "비밀번호가 변경됐어요. 다시 로그인해 주세요.",
        });
      } catch (err) {
        request.log.error({ err }, "reset-password 내부 오류");
        return reply.code(500).send({
          error: {
            code: "RESET_FAILED",
            message: "비밀번호 재설정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          },
        });
      }
    },
  );
}
