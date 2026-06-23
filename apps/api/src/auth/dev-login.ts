/**
 * 개발 전용 로그인 라우트 (AC #7).
 *
 * AUTH_DEV_BYPASS=true && NODE_ENV !== 'production' 조건에서만 등록.
 * production 환경에서는 이 모듈 자체를 등록하지 않아 404 반환.
 *
 * 사용: GET /api/v1/auth/dev-login
 * 응답: { token, userId, email, nickname } (시드 유저 세션)
 */

import { env } from "@ai-jakdang/config";
import { getDb } from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import { errorResponseSchema } from "@ai-jakdang/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/** 개발용 시드 유저 */
const DEV_SEED_USER = {
  email: "dev@ai-jakdang.local",
  nickname: "개발유저",
} as const;

/** DEV_SESSION_EXPIRE: 24시간 */
const DEV_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

/**
 * 개발 dev-login 라우트를 Fastify 인스턴스에 등록한다.
 *
 * 조건: AUTH_DEV_BYPASS=true && NODE_ENV !== 'production'
 * 조건 미충족 시 이 함수를 호출하지 않음 → 라우트 없음(404).
 */
export async function registerDevLoginRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/auth/dev-login",
    {
      schema: {
        description: "[개발 전용] 시드 유저 세션 즉시 발급. production 미노출.",
        tags: ["dev"],
        response: {
          200: z.object({
            token: z.string(),
            userId: z.string(),
            email: z.string(),
            nickname: z.string(),
            expiresAt: z.string(),
          }),
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      // 이중 안전 장치: 함수 내부에서도 환경 재검사
      if (env.NODE_ENV === "production" || !env.AUTH_DEV_BYPASS) {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "개발 전용 엔드포인트입니다.",
          },
        });
      }

      const db = getDb();

      // 1. 시드 유저 조회 또는 생성
      let [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, DEV_SEED_USER.email))
        .limit(1);

      if (!user) {
        [user] = await db
          .insert(schema.users)
          .values({
            email: DEV_SEED_USER.email,
            nickname: DEV_SEED_USER.nickname,
            emailVerified: true,
            status: "active",
            defaultAvatarIndex: 0,
            termsAgreedAt: new Date(),
            termsVersion: "dev",
          })
          .returning();
      }

      if (!user) {
        return reply.code(500).send({
          error: { code: "INTERNAL_SERVER_ERROR", message: "시드 유저 생성 실패" },
        });
      }

      // 2. 세션 생성 (토큰 발급)
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + DEV_SESSION_TTL_MS);

      await db.insert(schema.sessions).values({
        userId: user.id,
        token,
        expiresAt,
        ipAddress: "127.0.0.1",
        userAgent: "dev-login",
      });

      return reply.code(200).send({
        token,
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );
}

/**
 * dev-login 라우트가 현재 환경에서 활성화되어야 하는지 판단한다.
 * production 빌드 안전 여부를 테스트에서 사용한다.
 */
export function isDevLoginEnabled(): boolean {
  return env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS === true;
}
