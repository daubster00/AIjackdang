/**
 * 이메일 가입 서비스 (Story 1.3).
 *
 * - DB 트랜잭션: users 생성(닉네임 UNIQUE 재시도 포함)
 * - accounts(credential, Argon2id 해시) 생성은 Better Auth 가 처리
 * - 이메일 인증 링크 생성 및 email 큐 발행 (Better Auth sendVerificationEmail 훅)
 *
 * 중요: Better Auth 의 emailAndPassword.signUp 을 직접 호출한다.
 * 자동 닉네임·defaultAvatarIndex·약관 동의 타임스탬프는 DB before/after 훅으로 주입한다.
 */

import { randomInt } from "node:crypto";
import { getDb } from "@ai-jakdang/database";
import * as schema from "@ai-jakdang/database/schema";
import { generateNicknameWithFallback, DEFAULT_AVATAR_COUNT, isDisposableEmail } from "@ai-jakdang/core";
import { eq } from "drizzle-orm";

/** 가입 서비스 에러 코드 */
export type SignUpErrorCode =
  | "EMAIL_DUPLICATE"
  | "DISPOSABLE_EMAIL"
  | "NICKNAME_EXHAUSTED";

export class SignUpError extends Error {
  constructor(
    public readonly code: SignUpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SignUpError";
  }
}

export interface CreateUserOptions {
  email: string;
  passwordHash: string;
  termsAgreed?: true;
}

export interface CreatedUser {
  id: string;
  email: string;
  nickname: string;
  defaultAvatarIndex: number;
}

const TERMS_VERSION = "2026-06" as const;
const MAX_NICKNAME_RETRIES = 10 as const;

/**
 * users 테이블에 신규 회원을 삽입한다.
 * 닉네임 UNIQUE 충돌 시 최대 10회 재시도, 이후 fallback(6자리 숫자 접미).
 */
export async function createUserWithNickname(
  email: string,
): Promise<CreatedUser> {
  // 일회용 이메일 차단
  if (isDisposableEmail(email)) {
    throw new SignUpError("DISPOSABLE_EMAIL", "일회용 이메일 도메인은 사용할 수 없습니다.");
  }

  const db = getDb();
  const defaultAvatarIndex = randomInt(0, DEFAULT_AVATAR_COUNT);
  const termsAgreedAt = new Date();

  // 닉네임 UNIQUE 재시도 루프
  for (let attempt = 1; attempt <= MAX_NICKNAME_RETRIES + 5; attempt++) {
    const nickname = generateNicknameWithFallback(attempt);

    try {
      const [inserted] = await db
        .insert(schema.users)
        .values({
          email,
          emailVerified: false,
          nickname,
          defaultAvatarIndex,
          termsAgreedAt,
          termsVersion: TERMS_VERSION,
          status: "active",
        })
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          nickname: schema.users.nickname,
          defaultAvatarIndex: schema.users.defaultAvatarIndex,
        });

      if (!inserted) {
        throw new SignUpError("EMAIL_DUPLICATE", "가입에 실패했습니다.");
      }

      return inserted;
    } catch (err) {
      // PostgreSQL UNIQUE 위반: code 23505
      const pgError = err as { code?: string; constraint?: string; message?: string };
      if (pgError?.code === "23505") {
        // 닉네임 unique 위반 → 재시도
        if (pgError?.constraint?.includes("nickname") || pgError?.message?.includes("nickname")) {
          continue;
        }
        // 이메일 unique 위반 → 중복 에러
        if (pgError?.constraint?.includes("email") || pgError?.message?.includes("email")) {
          throw new SignUpError("EMAIL_DUPLICATE", "이미 사용 중인 이메일입니다.");
        }
      }
      throw err;
    }
  }

  // 모든 재시도 실패 (극히 드문 경우)
  throw new SignUpError("NICKNAME_EXHAUSTED", "닉네임 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
}

/**
 * 사용자 emailVerified 를 true 로 업데이트한다.
 * Better Auth verifyEmail 훅에서 호출된다.
 */
export async function markEmailVerified(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

/**
 * 이메일로 사용자를 조회한다.
 */
export async function findUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return user ?? null;
}
