/**
 * POST /api/v1/auth/sign-up — 이메일 가입 (Story 1.3).
 *
 * 검증 흐름:
 * 1. signUpSchema(Zod) 입력 검증
 * 2. 일회용 이메일 도메인 차단
 * 3. Better Auth의 /sign-up/email 엔드포인트를 내부적으로 호출
 *    → databaseHooks.user.create.before 에서 닉네임·아바타·약관 자동 주입
 *    → emailVerification.sendVerificationEmail 에서 email 큐 발행
 * 4. 201 응답: { message: "인증 메일을 보냈어요. 메일함을 확인해 주세요." }
 *
 * 에러:
 * - 422 (Better Auth 이메일 중복 응답) → 우리가 409로 변환
 * - 일회용 이메일 → 422
 * - rate limit → app.ts 의 rate-limit 플러그인이 429 반환
 */

import { signUpSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { isDisposableEmail, generateNicknameWithFallback } from "@ai-jakdang/core";
import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { userAuth } from "../../../auth/user-auth.js";

const signUpResponseSchema = z.object({
  message: z.string(),
});

/** 이메일이 이미 가입돼 있는지 확인한다(소셜 전용 계정 포함). */
async function isEmailTaken(normalizedEmail: string): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);
  return Boolean(existing);
}

/**
 * 이메일 가입 라우트를 Fastify 인스턴스에 등록한다.
 */
export async function registerSignUpRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/auth/sign-up",
    {
      config: {
        // @fastify/rate-limit: IP당 10회/시간
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (request) => `sign-up:${request.ip}`,
        },
      },
      schema: {
        description: "이메일·비밀번호로 회원가입. 성공 시 인증 메일이 발송됩니다.",
        tags: ["auth"],
        body: signUpSchema,
        response: {
          201: signUpResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // signUpSchema는 termsAgreed: literal(true)를 검증함. 도달했으면 이미 true.
      const { email, password, name, phone, gender, birthDate, marketingAgreed } = request.body;

      // email 정규화
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = name?.trim() || null;
      const normalizedPhone = phone.trim();

      // 일회용 이메일 도메인 차단 (AC #6)
      if (isDisposableEmail(normalizedEmail)) {
        return reply.code(422).send({
          error: {
            code: "DISPOSABLE_EMAIL",
            message: "일회용 이메일 서비스는 사용할 수 없습니다. 다른 이메일을 사용해 주세요.",
          },
        });
      }

      // 중복 이메일 차단 (AC #6) — 소셜 전용 계정도 포함해 명시적으로 막는다.
      // (Better Auth signUpEmail 은 소셜 전용 계정에 대해 예외를 던지지 않아 직접 확인한다.)
      if (await isEmailTaken(normalizedEmail)) {
        return reply.code(409).send({
          error: {
            code: "EMAIL_DUPLICATE",
            message: "이미 가입된 이메일이에요. 로그인하거나 소셜 로그인을 이용해 주세요.",
          },
        });
      }

      // Better Auth 내부 API 호출: signUpEmail
      // user-auth.ts 의 databaseHooks 가 닉네임·아바타·약관을 자동 주입한다.
      // nickname 필드: additionalFields에 required:true로 등록되어 있어 타입 상 필수.
      // databaseHooks.user.create.before 에서 실제 유니크 닉네임으로 덮어쓴다.
      const placeholderNickname = generateNicknameWithFallback(1);

      try {
        const result = await userAuth.api.signUpEmail({
          body: {
            email: normalizedEmail,
            password,
            name: normalizedName ?? normalizedEmail, // Better Auth 필수 필드; 가입 후 선택 이름은 아래에서 정리
            nickname: placeholderNickname, // databaseHooks.before 에서 유니크 닉네임으로 교체됨
            phone: normalizedPhone,
            gender: gender ?? undefined,
            birthDate: birthDate ?? undefined,
          },
        });

        if (result?.user?.id) {
          const db = getDb();
          await db
            .update(schema.users)
            .set({
              name: normalizedName,
              phone: normalizedPhone,
              gender: gender ?? null,
              birthDate: birthDate ?? null,
              marketingAgreedAt: marketingAgreed ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, result.user.id));
        }

        // requireEmailVerification=true 이면 result.token = null (세션 미생성)
        // 인증 메일 발송은 emailVerification.sendVerificationEmail 훅에서 처리됨
        request.log.info({ userId: result?.user?.id, email: normalizedEmail }, "가입 완료 — 인증 메일 발송됨");

        return reply.code(201).send({
          message: "인증 메일을 보냈어요. 메일함을 확인해 주세요.",
        });
      } catch (err) {
        const error = err as { status?: number; statusCode?: number; body?: { message?: string; code?: string }; message?: string };

        request.log.warn({ email: normalizedEmail, error: error?.message }, "가입 실패");

        // Better Auth 422: 이메일 중복
        const status = error?.status ?? error?.statusCode ?? 500;
        if (status === 422) {
          return reply.code(409).send({
            error: {
              code: "EMAIL_DUPLICATE",
              message: "이미 사용 중인 이메일입니다.",
            },
          });
        }

        // 예기치 않은 오류
        return reply.code(500).send({
          error: {
            code: "SIGNUP_FAILED",
            message: "가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          },
        });
      }
    },
  );

  // ── GET /auth/check-email — 이메일 중복 확인 (가입 폼 blur 검증용) ───────────────
  typed.get(
    "/auth/check-email",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute", keyGenerator: (request) => `check-email:${request.ip}` },
      },
      schema: {
        description: "이메일 가입 가능 여부 확인. available=false 면 이미 가입된 이메일.",
        tags: ["auth"],
        querystring: z.object({ email: z.string() }),
        response: { 200: z.object({ available: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const normalizedEmail = request.query.email.trim().toLowerCase();
      // 형식이 명백히 잘못된 경우는 available=true 로 두고 폼의 형식 검증에 맡긴다.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return reply.code(200).send({ available: true });
      }
      return reply.code(200).send({ available: !(await isEmailTaken(normalizedEmail)) });
    },
  );
}
