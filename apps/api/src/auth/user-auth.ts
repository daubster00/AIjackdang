/**
 * Better Auth 유저 인스턴스 (ADR-0002).
 *
 * - basePath: /api/v1/auth
 * - 이메일+비밀번호 + 소셜(구글/네이버/카카오) 지원
 * - 비밀번호 해시: Argon2id (커스텀 해셔)
 * - 세션 쿠키: aj_session (cookiePrefix)
 * - DB 어댑터: packages/database getDb() 연결
 *
 * Story 1.3 추가:
 * - databaseHooks.user.create.before: 닉네임 자동배정·defaultAvatarIndex·약관 타임스탬프
 * - emailVerification.sendVerificationEmail: email BullMQ 큐 발행 (dev: console 출력)
 *
 * 관리자 인증 인스턴스(basePath /api/v1/admin/auth)는 별도 파일(ADR-0003).
 */

import { randomInt } from "node:crypto";
import { env } from "@ai-jakdang/config";
import { getDb } from "@ai-jakdang/database";
import * as schema from "@ai-jakdang/database/schema";
import { generateNicknameWithFallback, DEFAULT_AVATAR_COUNT, CURRENT_TERMS_VERSION } from "@ai-jakdang/core";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { enqueueEmail } from "../queues/email.queue.js";

/** Argon2id 커스텀 해셔 — Better Auth emailAndPassword.password 옵션에 주입 */
const argon2idHasher = {
  hash: async (password: string): Promise<string> => {
    return argon2Hash(password, {
      algorithm: 2, // Argon2id
      memoryCost: 65536,  // 64MB
      timeCost: 3,
      parallelism: 4,
    });
  },
  verify: async ({ hash, password }: { hash: string; password: string }): Promise<boolean> => {
    try {
      return await argon2Verify(hash, password);
    } catch {
      return false;
    }
  },
};

const MAX_NICKNAME_RETRIES = 15 as const;

/**
 * 닉네임 UNIQUE 충돌 시 재시도하여 유니크 닉네임을 DB에 업데이트한다.
 * user.create.before 훅에서는 데이터를 반환하지만 닉네임 중복 확인은
 * DB insert 실패 후에만 알 수 있으므로, after 훅에서 재시도 기반으로 처리한다.
 *
 * Better Auth는 user.create.before 에서 { data: {...} } 를 반환하면
 * 그 데이터로 user를 생성한다. 닉네임을 한 번만 생성하고 충돌 시에는
 * after 훅에서 UPDATE 쿼리로 재할당한다.
 */
async function assignUniqueNickname(userId: string): Promise<void> {
  const db = getDb();
  for (let attempt = 1; attempt <= MAX_NICKNAME_RETRIES; attempt++) {
    const nickname = generateNicknameWithFallback(attempt);
    try {
      await db
        .update(schema.users)
        .set({ nickname, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      return; // 성공
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") continue; // UNIQUE 충돌 → 재시도
      throw err;
    }
  }
}

/** 유저 Better Auth 인스턴스 */
export const userAuth = betterAuth({
  /** 인증 API 기본 경로 */
  basePath: "/api/v1/auth",

  /** 고급 설정 */
  advanced: {
    /**
     * 세션 쿠키 prefix: aj_session (ADR-0002)
     * 기본값 "better-auth" → "aj_session"으로 변경.
     * 쿠키명: aj_session.session_token (httpOnly, SameSite=Lax)
     */
    cookiePrefix: "aj_session",

    /**
     * DB ID 생성기: sessions.id/accounts.id 등이 UUID 타입이므로 "uuid" 설정.
     * Better Auth 기본은 알파벳+숫자 랜덤 문자열 — PostgreSQL UUID 컬럼과 충돌.
     * "uuid"로 설정하면 crypto.randomUUID()를 사용한다.
     */
    database: {
      generateId: "uuid" as const,
    },
  },

  /** Better Auth URL (소셜 콜백 등에 사용) */
  baseURL: env.BETTER_AUTH_URL ?? env.WEB_PUBLIC_URL,

  /** AUTH_SECRET — 세션 서명·암호화 */
  secret: env.AUTH_SECRET,

  /**
   * Drizzle 어댑터 연결
   */
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
    usePlural: false,
    camelCase: true,
  }),

  /** 이메일+비밀번호 인증 */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    /** Argon2id 커스텀 해셔 (project-context §보안) */
    password: argon2idHasher,
  },

  /**
   * 이메일 인증 설정 (Story 1.3).
   * sendVerificationEmail: 인증 링크를 email BullMQ 큐로 발행한다.
   * dev 환경에서는 Redis 없이 console에 출력된다.
   */
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      // Better Auth 기본 callbackURL(/) → 인증 완료 안내 페이지(/signup/verified)로 변경.
      // 토큰 검증 후 사용자가 이 페이지로 리다이렉트되어 "인증 완료" 안내를 본다.
      let verificationUrl = url;
      try {
        const parsed = new URL(url);
        parsed.searchParams.set("callbackURL", "/signup/verified");
        verificationUrl = parsed.toString();
      } catch {
        // url 파싱 실패 시 원본 사용
      }

      console.info("[auth] 이메일 인증 요청:", { to: user.email, token: token.slice(0, 8) + "..." });
      console.info("[auth] ── 인증 링크 (개발 환경 출력) ──────────────");
      console.info("[auth]   URL:", verificationUrl);
      console.info("[auth] ───────────────────────────────────────────");

      // email 큐에 발행 (dev: Redis 없으면 console 폴백)
      await enqueueEmail({
        to: user.email,
        subject: "[AI작당] 이메일 인증을 완료해 주세요",
        templateId: "email-verification",
        variables: {
          verificationUrl,
          userEmail: user.email,
        },
      });
    },
  },

  /**
   * DB 훅 — 유저 생성 시 닉네임·아바타·약관 자동 주입 (Story 1.3).
   */
  databaseHooks: {
    user: {
      create: {
        /**
         * before 훅: 닉네임 초안 + defaultAvatarIndex + termsAgreedAt + termsVersion 주입.
         * 닉네임 UNIQUE 충돌 재시도는 after 훅에서 처리한다.
         */
        before: async (user) => {
          const nickname = generateNicknameWithFallback(1);
          const defaultAvatarIndex = randomInt(0, DEFAULT_AVATAR_COUNT);
          const termsAgreedAt = new Date();

          return {
            data: {
              ...user,
              nickname,
              defaultAvatarIndex,
              termsAgreedAt,
              termsVersion: CURRENT_TERMS_VERSION,
            },
          };
        },
        /**
         * after 훅: 닉네임 UNIQUE 재시도 (before 훅의 초안이 충돌했을 경우 재할당).
         * Better Auth는 UNIQUE 충돌 시 422를 반환하므로, after 훅이 호출됐다면
         * before의 닉네임이 성공적으로 insert된 것이다. 재시도는 insert 실패 케이스에서
         * 발생하지 않는다. 단, 동시성 충돌을 위한 background 닉네임 재확인만 수행.
         */
        after: async (user) => {
          // after 훅: 닉네임이 비어있거나 null이면 재할당 시도
          const userRecord = user as typeof user & { nickname?: string };
          if (!userRecord.nickname) {
            await assignUniqueNickname(user.id);
          }
        },
      },
    },
  },

  /**
   * 커스텀 user 필드 (ADR-0002).
   * Better Auth 기본 user 응답에 포함되지 않는 필드를 추가한다.
   * get-session / sign-in 응답의 user 객체에 이 필드들이 포함된다.
   */
  user: {
    additionalFields: {
      nickname: {
        type: "string" as const,
        required: true,
        fieldName: "nickname",
      },
      status: {
        type: "string" as const,
        required: false,
        defaultValue: "active",
        fieldName: "status",
      },
      defaultAvatarIndex: {
        type: "number" as const,
        required: false,
        defaultValue: 0,
        fieldName: "defaultAvatarIndex",
      },
      avatarUrl: {
        type: "string" as const,
        required: false,
        fieldName: "avatarUrl",
      },
    },
  },

  /**
   * 소셜 Provider 슬롯 — 환경변수 미설정 시 해당 provider 비활성.
   * 카카오: KAKAO_ENABLED=true && 키 설정 시에만 활성 (ADR-0002 §카카오 정책 — 비즈앱 검수 필요).
   */
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET
      ? {
          naver: {
            clientId: env.NAVER_CLIENT_ID,
            clientSecret: env.NAVER_CLIENT_SECRET,
          },
        }
      : {}),
    // 카카오: 비즈앱 검수 완료 + KAKAO_ENABLED=true 시에만 활성 (ADR-0002 §카카오 정책)
    ...(env.KAKAO_ENABLED && env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET
      ? {
          kakao: {
            clientId: env.KAKAO_REST_API_KEY,
            clientSecret: env.KAKAO_CLIENT_SECRET,
          },
        }
      : {}),
  },

  /**
   * 계정 연결 정책 (사용자 결정 — Story 1.5 자동연결 정책 뒤집음).
   * 자동 계정 연결을 비활성화한다. 같은 이메일이 이미 다른 방법(소셜·이메일)으로
   * 가입돼 있으면 소셜 가입/로그인을 막고, 기존 방법으로 로그인하도록 안내한다.
   * (errorCallbackURL → /login·/signup?error=social 에서 안내 표시)
   */
  account: {
    accountLinking: {
      enabled: false,
    },
  },
});

export type UserAuth = typeof userAuth;
