/**
 * POST /api/v1/auth/forgot-password — 비밀번호 재설정 이메일 발송 (Story 1.6).
 *
 * 보안 설계:
 * - 계정 존재 여부와 무관하게 항상 동일한 200 응답 (이메일 탐지 공격 방지).
 * - 계정이 존재하는 경우에만 verifications 토큰(1시간 만료) 생성 후 email 큐 발행.
 * - rate limit: IP당 5회/시간 (AC #4).
 */

import { randomBytes } from "node:crypto";
import { forgotPasswordSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { getDb, schema } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { enqueueEmail } from "../../../queues/email.queue.js";
import { env } from "@ai-jakdang/config";

const forgotPasswordResponseSchema = z.object({
  message: z.string(),
});

/** 재설정 토큰 만료 시간: 1시간 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** verifications 테이블 identifier 접두사 */
const RESET_PREFIX = "password-reset:";

export async function registerForgotPasswordRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/auth/forgot-password",
    {
      config: {
        // AC #4: IP당 5회/시간
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
          keyGenerator: (request) => `forgot-password:${request.ip}`,
        },
      },
      schema: {
        description: "비밀번호 재설정 이메일 발송. 계정 존재 여부에 무관하게 동일한 응답.",
        tags: ["auth"],
        body: forgotPasswordSchema,
        response: {
          200: forgotPasswordResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      const normalizedEmail = email.trim().toLowerCase();

      // 항상 동일한 성공 응답 (계정 존재 여부 노출 금지)
      const successMessage = "입력하신 이메일로 재설정 안내를 보냈어요. 메일함을 확인해 주세요.";

      try {
        const db = getDb();

        // 계정 조회 (credential 제공자만)
        const user = await db
          .select({ id: schema.users.id, email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.email, normalizedEmail))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (user) {
          // credential 계정 존재 여부 확인
          const credentialAccount = await db
            .select({ id: schema.accounts.id })
            .from(schema.accounts)
            .where(eq(schema.accounts.userId, user.id))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (credentialAccount) {
            // 재설정 토큰 생성
            const token = randomBytes(32).toString("hex");
            const identifier = `${RESET_PREFIX}${normalizedEmail}`;
            const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

            // 기존 미사용 토큰 삭제 후 새 토큰 삽입 (한 계정당 1개 유지)
            await db
              .delete(schema.verifications)
              .where(eq(schema.verifications.identifier, identifier));

            await db.insert(schema.verifications).values({
              identifier,
              value: token,
              expiresAt,
            });

            // email 큐에 재설정 메일 발행
            const resetUrl = `${env.WEB_PUBLIC_URL}/reset-password?token=${token}`;
            await enqueueEmail({
              to: normalizedEmail,
              subject: "[AI작당] 비밀번호 재설정 안내",
              templateId: "reset-password",
              variables: {
                resetUrl,
                email: normalizedEmail,
              },
            });

            request.log.info({ userId: user.id }, "비밀번호 재설정 토큰 생성 및 이메일 발행");
          }
        }
      } catch (err) {
        // 내부 오류 로깅 — 사용자에게는 동일 성공 응답 반환
        request.log.error({ err }, "forgot-password 내부 오류");
      }

      return reply.code(200).send({ message: successMessage });
    },
  );
}
