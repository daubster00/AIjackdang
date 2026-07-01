/**
 * Better Auth 관리자 인스턴스 (ADR-0003).
 *
 * - basePath: /api/v1/admin/auth
 * - credential only (소셜 없음, emailVerification 없음)
 * - 비밀번호 해시: Argon2id (유저 인스턴스와 동일 파라미터)
 * - 세션 쿠키: aj_admin_session (cookiePrefix)
 * - DB 어댑터: packages/database admin_* 테이블에 바인딩
 *
 * 유저 인스턴스(basePath /api/v1/auth)와 완전 독립.
 * 소셜 OAuth / 이메일 인증 없음.
 */

import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/** Argon2id 커스텀 해셔 — user-auth.ts와 동일 파라미터 */
const argon2idHasher = {
  hash: async (password: string): Promise<string> => {
    return argon2Hash(password, {
      algorithm: 2, // Argon2id
      memoryCost: 65536, // 64MB
      timeCost: 3,
      parallelism: 4,
    });
  },
  verify: async ({
    hash,
    password,
  }: {
    hash: string;
    password: string;
  }): Promise<boolean> => {
    try {
      return await argon2Verify(hash, password);
    } catch {
      return false;
    }
  },
};

/**
 * 관리자 Better Auth 인스턴스를 생성한다.
 *
 * 호출자(apps/api)가 db 인스턴스와 secret을 주입한다.
 * packages/auth는 DB 직접 import 금지 원칙(ADR-0001)에 따라
 * 인스턴스 생성 함수만 제공하고, 실제 db/env 주입은 apps/api가 담당한다.
 */
export function createAdminAuth({
  db,
  schema,
  secret,
  baseURL,
  cookieDomain,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: {
    adminUsers: any;
    adminSessions: any;
    adminAccounts: any;
    adminVerifications: any;
  };
  secret: string;
  baseURL: string;
  /** 설정 시 세션 쿠키에 Domain 을 붙여 서브도메인 간 공유(운영: ".aijackdang.com") */
  cookieDomain?: string | undefined;
}) {
  return betterAuth({
    /** 관리자 인증 API 기본 경로 */
    basePath: "/api/v1/admin/auth",

    /** 고급 설정 */
    advanced: {
      /**
       * 세션 쿠키 prefix: aj_admin_session (ADR-0003)
       * 관리자 쿠키는 유저 쿠키(aj_session)와 분리.
       */
      cookiePrefix: "aj_admin_session",

      /**
       * DB ID 생성기: admin_* 테이블 UUID 컬럼과 정합.
       */
      database: {
        generateId: "uuid" as const,
      },

      /**
       * 서브도메인 공유 쿠키 (운영). cookieDomain 설정 시에만 활성.
       * admin.aijackdang.com(SSR)이 api.aijackdang.com 이 발급한 세션 쿠키를 받으려면
       * Domain=.aijackdang.com 이 필요하다(없으면 host-only → 로그인 루프).
       */
      ...(cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
        : {}),
    },

    /** Better Auth URL */
    baseURL,

    /** 관리자 인증 시크릿 (유저 인스턴스와 별도) */
    secret,

    /**
     * Drizzle 어댑터 — admin_* 테이블 바인딩
     * user → adminUsers, session → adminSessions,
     * account → adminAccounts, verification → adminVerifications
     */
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.adminUsers,
        session: schema.adminSessions,
        account: schema.adminAccounts,
        verification: schema.adminVerifications,
      },
      usePlural: false,
      camelCase: true,
    }),

    /**
     * 모델 필드 매핑 — admin_* 테이블은 FK 컬럼이 `admin_user_id`(drizzle 속성 `adminUserId`)라
     * Better Auth 기본 필드명 `userId` 와 다르다. 매핑하지 않으면
     * "field userId does not exist for model account/session" 로 sign-in 이 500 난다.
     */
    session: {
      fields: {
        userId: "adminUserId",
      },
    },
    account: {
      fields: {
        userId: "adminUserId",
      },
    },

    /** 이메일+비밀번호 전용 (소셜 없음) */
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // 관리자는 이메일 인증 없음
      minPasswordLength: 8,
      maxPasswordLength: 128,
      /** Argon2id 커스텀 해셔 */
      password: argon2idHasher,
    },

    /**
     * 커스텀 admin user 필드
     * Better Auth의 user 테이블 컬럼 중 admin_users에만 존재하는 필드.
     */
    user: {
      additionalFields: {
        phone: {
          type: "string" as const,
          required: true,
          fieldName: "phone",
        },
        role: {
          type: "string" as const,
          required: false,
          defaultValue: "staff",
          fieldName: "role",
        },
        status: {
          type: "string" as const,
          required: false,
          defaultValue: "pending",
          fieldName: "status",
        },
        approvedBy: {
          type: "string" as const,
          required: false,
          fieldName: "approvedBy",
        },
        approvedAt: {
          type: "string" as const,
          required: false,
          fieldName: "approvedAt",
        },
        note: {
          type: "string" as const,
          required: false,
          fieldName: "note",
        },
      },
    },
  });
}

export type AdminAuth = ReturnType<typeof createAdminAuth>;
