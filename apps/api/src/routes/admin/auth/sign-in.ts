/**
 * POST /api/v1/admin/auth/sign-in — 관리자 로그인 (Story 9.2 AC#1, #2, #3).
 *
 * 흐름:
 * 1. adminSignInSchema(Zod) 입력 검증
 * 2. admin_users 테이블에서 이메일 조회 → 없으면 INVALID_CREDENTIALS(401)
 * 3. adminAuth.api.signInEmail 로 자격 검증 (Argon2id 비밀번호 비교)
 *    → 실패 시 INVALID_CREDENTIALS(401)
 * 4. 성공 후 status 확인:
 *    - pending → PENDING_APPROVAL(401) + 세션 즉시 폐기
 *    - suspended → ACCOUNT_SUSPENDED(401) + 세션 즉시 폐기
 *    - disabled → ACCOUNT_DISABLED(401) + 세션 즉시 폐기
 *    - active → 세션 쿠키(aj_admin_session.session_token) 유지 + adminUser 반환
 *
 * 보안:
 * - 이메일/비밀번호 중 어느 쪽이 틀렸는지 미구분 (열거 공격 방지)
 * - rate limit: IP당 5회/분 (config.rateLimit)
 */

import { adminSignInSchema } from "@ai-jakdang/contracts";
import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { adminAuth } from "../../../auth/admin-auth.js";

export async function registerAdminSignInRoute(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/admin/auth/sign-in",
    {
      config: {
        // @fastify/rate-limit: IP당 5회/분
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          keyGenerator: (request) => `admin-sign-in:${request.ip}`,
          errorResponseBuilder: () => ({
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",
            },
          }),
        },
      },
      schema: {
        description: "관리자 이메일·비밀번호 로그인. active 계정만 세션 발급됩니다.",
        tags: ["admin-auth"],
        body: adminSignInSchema,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const normalizedEmail = email.trim().toLowerCase();
      const db = getDb();

      // 1. admin_users에서 이메일 조회
      const [adminUser] = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, normalizedEmail))
        .limit(1);

      if (!adminUser) {
        // 이메일 존재 여부 노출 금지 (열거 공격 방지)
        return reply.code(401).send({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "이메일 또는 비밀번호가 올바르지 않습니다.",
          },
        });
      }

      // 2. Better Auth 내부 API로 자격 증명 검증 (Argon2id 비밀번호 비교 포함)
      //    returnHeaders:true 로 호출해 Better Auth가 직접 발급한 "서명된" Set-Cookie 헤더를 받는다.
      //    (이전 구현은 raw 세션 토큰을 직접 쿠키에 심어서 getSession의 getSignedCookie 검증이 항상
      //     실패 → 모든 /api/v1/admin/* 데이터 API가 401이 되는 회귀가 있었음)
      let signInResult:
        | { user?: { id: string } | null; token?: string | null }
        | null = null;
      let signInHeaders: Headers | null = null;
      try {
        const result = await adminAuth.api.signInEmail({
          body: {
            email: normalizedEmail,
            password,
          },
          returnHeaders: true,
        });
        signInHeaders = result.headers;
        signInResult = result.response;
      } catch {
        // Better Auth 자격 검증 실패
        return reply.code(401).send({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "이메일 또는 비밀번호가 올바르지 않습니다.",
          },
        });
      }

      if (!signInResult?.user) {
        return reply.code(401).send({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "이메일 또는 비밀번호가 올바르지 않습니다.",
          },
        });
      }

      // 3. status 검사 — active가 아니면 세션 폐기 후 차단
      const status = adminUser.status;

      if (status !== "active") {
        // 발급된 세션 즉시 폐기 (토큰이 있으면)
        if (signInResult.token) {
          try {
            await adminAuth.api.revokeSession({
              body: {
                token: signInResult.token,
              },
              headers: request.headers as unknown as Headers,
            });
          } catch {
            // 폐기 실패해도 로그인 차단은 유지
          }
        }

        if (status === "pending") {
          return reply.code(401).send({
            error: {
              code: "PENDING_APPROVAL",
              message: "승인 대기 중입니다. 최고관리자의 승인 후 로그인 가능합니다.",
            },
          });
        }

        if (status === "suspended") {
          return reply.code(401).send({
            error: {
              code: "ACCOUNT_SUSPENDED",
              message: "계정이 정지된 상태입니다. 관리자에게 문의해주세요.",
            },
          });
        }

        // disabled
        return reply.code(401).send({
          error: {
            code: "ACCOUNT_DISABLED",
            message: "비활성화된 계정입니다. 관리자에게 문의해주세요.",
          },
        });
      }

      // 4. active — Better Auth가 발급한 서명 쿠키(set-cookie)를 그대로 응답에 전달.
      // 쿠키 이름은 {cookiePrefix}.session_token = "aj_admin_session.session_token"이며
      // HMAC 서명이 포함돼 있어 이후 getSession/get-session 검증을 통과한다.
      if (signInHeaders) {
        const setCookies = signInHeaders.getSetCookie();
        if (setCookies.length > 0) {
          reply.header("set-cookie", setCookies);
        }
      }

      return reply.code(200).send({
            adminUser: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          status: adminUser.status,
        },
      });
    },
  );
}
