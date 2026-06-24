/**
 * POST /api/v1/admin/auth/sign-up — 관리자 가입(승인 대기) (Story 9.2 AC#4, #5, #7).
 *
 * 흐름:
 * 1. adminSignUpSchema(Zod) 입력 검증
 * 2. admin_users 이메일 중복 확인 → 409 DUPLICATE_EMAIL
 * 3. Argon2id(algorithm:2, memoryCost:65536, timeCost:3, parallelism:4) 해시
 * 4. admin_users(status=pending, role=staff) INSERT
 * 5. admin_accounts(providerId=credential, password=해시) INSERT
 * 6. 세션 발급 없이 { status:"pending" } 반환
 *
 * 보안:
 * - 비밀번호 min 8자 (adminSignUpSchema 에서 검증)
 * - 세션 미발급 (pending 상태 로그인 불가)
 */

import { adminSignUpSchema } from "@ai-jakdang/contracts";
import { getDb, schema } from "@ai-jakdang/database";
import { hash as argon2Hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/** Argon2id 해시 파라미터 — admin-auth.ts와 동일 */
async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function registerAdminSignUpRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/admin/auth/sign-up",
    {
      config: {
        // @fastify/rate-limit: IP당 10회/시간
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (request) => `admin-sign-up:${request.ip}`,
          errorResponseBuilder: () => ({
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "가입 시도 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.",
            },
          }),
        },
      },
      schema: {
        description: "관리자 가입 신청. status=pending으로 생성되며 최고관리자 승인 후 로그인 가능.",
        tags: ["admin-auth"],
        body: adminSignUpSchema,
      },
    },
    async (request, reply) => {
      const { name, email, password, phone } = request.body;
      const normalizedEmail = email.trim().toLowerCase();
      const db = getDb();

      // 1. 이메일 중복 확인
      const [existing] = await db
        .select({ id: schema.adminUsers.id })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, normalizedEmail))
        .limit(1);

      if (existing) {
        return reply.code(409).send({
          error: {
            code: "DUPLICATE_EMAIL",
            message: "이미 사용 중인 이메일입니다.",
          },
        });
      }

      // 2. Argon2id 해시
      const hashedPassword = await hashPassword(password);
      const newAdminUserId = randomUUID();

      // 3. DB 트랜잭션: admin_users + admin_accounts 동시 생성
      await db.transaction(async (tx) => {
        await tx.insert(schema.adminUsers).values({
          id: newAdminUserId,
          email: normalizedEmail,
          name: name.trim(),
          phone: phone.trim(),
          role: "staff",
          status: "pending",
        });

        await tx.insert(schema.adminAccounts).values({
          id: randomUUID(),
          adminUserId: newAdminUserId,
          providerId: "credential",
          accountId: normalizedEmail,
          password: hashedPassword,
        });
      });

      request.log.info({ email: normalizedEmail }, "관리자 가입 신청 완료(pending)");

      return reply.code(201).send({
        status: "pending",
        message: "가입 신청이 완료되었습니다. 최고관리자 승인 후 로그인 가능합니다.",
      });
    },
  );
}
