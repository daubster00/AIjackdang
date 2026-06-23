/**
 * Better Auth 유저 인스턴스 (ADR-0002).
 *
 * - basePath: /api/v1/auth
 * - 이메일+비밀번호 + 소셜(구글/네이버/카카오) 지원
 * - 비밀번호 해시: Argon2id (커스텀 해셔)
 * - 세션 쿠키: aj_session (cookiePrefix)
 * - DB 어댑터: packages/database getDb() 연결
 *
 * 관리자 인증 인스턴스(basePath /api/v1/admin/auth)는 별도 파일(ADR-0003).
 */

import { env } from "@ai-jakdang/config";
import { getDb } from "@ai-jakdang/database";
import * as schema from "@ai-jakdang/database/schema";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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

  /** 소셜 Provider 슬롯 — 환경변수 미설정 시 비활성 */
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
    // 카카오: 비즈앱 검수 전까지 비활성 (ADR-0002 §카카오 정책)
    // ...(env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET
    //   ? { kakao: { clientId: env.KAKAO_REST_API_KEY, clientSecret: env.KAKAO_CLIENT_SECRET } }
    //   : {}),
  },

  /** 신뢰된 소셜 Provider — 같은 이메일로 계정 연결 */
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "naver"],
    },
  },
});

export type UserAuth = typeof userAuth;
