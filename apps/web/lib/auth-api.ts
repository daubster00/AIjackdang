/**
 * 인증 API 클라이언트 함수.
 *
 * 인증 권위는 API 서버(Better Auth).
 * Next.js(web)는 이 함수들을 통해 /api/v1/auth/* 엔드포인트에 요청만 포워딩한다.
 *
 * - 로그인/로그아웃은 브라우저 → Next.js 프록시(/api/v1/auth/*) → API 서버 경로로 흐른다.
 * - httpOnly 쿠키(aj_session)는 Same-Origin 프록시를 통해 자동으로 설정된다.
 * - 서버 컴포넌트에서 사용 시 headers()로 쿠키를 포워딩한다(별도 함수 제공).
 */

import type { SessionResponse } from "@ai-jakdang/contracts";

/** 인증 API 기본 경로 (Next.js rewrite를 통해 API 서버로 프록시됨) */
const AUTH_BASE = "/api/v1/auth";

// ── 회원가입 ──────────────────────────────────────────────────────────────────

/** 회원가입 성공 응답 */
export interface SignUpSuccess {
  ok: true;
  message: string;
}

/** 회원가입 실패 응답 */
export interface SignUpError {
  ok: false;
  code:
    | "EMAIL_DUPLICATE"       // 이메일 중복 (409)
    | "DISPOSABLE_EMAIL"      // 일회용 이메일 차단 (422)
    | "RATE_LIMIT_EXCEEDED"   // Rate limit (429)
    | "VALIDATION_ERROR"      // 입력값 오류
    | "NETWORK_ERROR"         // 네트워크 오류
    | "UNKNOWN";              // 기타 오류
  message: string;
  field?: string;             // 인라인 오류 귀속 필드 (email, password 등)
}

export type SignUpResult = SignUpSuccess | SignUpError;

/**
 * 이메일·비밀번호로 회원가입 (Story 1.3, AC #2).
 * POST /api/v1/auth/sign-up 엔드포인트를 호출한다.
 * 성공 시 인증 메일이 발송되고 "인증 메일을 보냈어요" 메시지를 반환한다.
 */
export async function signUp(
  email: string,
  password: string,
  termsAgreed: true,
): Promise<SignUpResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, termsAgreed }),
      credentials: "include",
    });

    if (res.status === 201) {
      const data = (await res.json()) as { message: string };
      return { ok: true, message: data.message };
    }

    if (res.status === 429) {
      return {
        ok: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "가입 시도 횟수를 초과했습니다. 1시간 후 다시 시도해 주세요.",
      };
    }

    // 에러 응답 파싱
    let body: { error?: { code?: string; message?: string }; message?: string } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // ignore
    }

    const errorCode = body.error?.code ?? "";
    const errorMessage = body.error?.message ?? body.message ?? "";

    if (res.status === 409 || errorCode === "EMAIL_DUPLICATE") {
      return {
        ok: false,
        code: "EMAIL_DUPLICATE",
        message: errorMessage || "이미 사용 중인 이메일입니다.",
        field: "email",
      };
    }

    if (res.status === 422 && errorCode === "DISPOSABLE_EMAIL") {
      return {
        ok: false,
        code: "DISPOSABLE_EMAIL",
        message: errorMessage || "일회용 이메일 서비스는 사용할 수 없습니다.",
        field: "email",
      };
    }

    if (res.status === 400 || res.status === 422) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: errorMessage || "입력값을 확인해 주세요.",
      };
    }

    return {
      ok: false,
      code: "UNKNOWN",
      message: "가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
    };
  }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────

/** 로그인 성공 응답 */
export interface SignInSuccess {
  ok: true;
  user: SessionResponse["user"];
}

/** 로그인 실패 응답 */
export interface SignInError {
  ok: false;
  code:
    | "INVALID_CREDENTIALS"  // 이메일/비밀번호 불일치 (401)
    | "EMAIL_NOT_VERIFIED"   // 이메일 미인증
    | "ACCOUNT_SUSPENDED"    // 계정 정지 (423)
    | "RATE_LIMIT_EXCEEDED"  // Rate limit (429)
    | "NETWORK_ERROR"        // 네트워크 오류
    | "UNKNOWN";             // 기타 오류
  message: string;
}

export type SignInResult = SignInSuccess | SignInError;

// ── API 함수 ──────────────────────────────────────────────────────────────────

/**
 * 이메일·비밀번호로 로그인 (AC #1, #3).
 * Better Auth의 POST /api/v1/auth/sign-in/email 엔드포인트를 호출한다.
 * 성공 시 httpOnly 세션 쿠키(aj_session)가 자동 설정된다.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (res.ok) {
      const data = (await res.json()) as { user?: SessionResponse["user"]; token?: string };
      if (data.user) {
        // suspended 계정 체크 (AC #3)
        if (data.user.status === "suspended") {
          return {
            ok: false,
            code: "ACCOUNT_SUSPENDED",
            message: "이용이 정지된 계정입니다. 관리자에게 문의해 주세요.",
          };
        }
        return { ok: true, user: data.user };
      }
    }

    if (res.status === 429) {
      return {
        ok: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "로그인 시도 횟수를 초과했습니다. 1시간 후 다시 시도해 주세요.",
      };
    }

    if (res.status === 401 || res.status === 403) {
      // Better Auth 응답에서 에러 코드 확인
      let body: { code?: string; message?: string; error?: { code?: string; message?: string } } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        // ignore
      }
      const errorCode = body.code ?? body.error?.code ?? "";

      if (errorCode === "EMAIL_NOT_VERIFIED" || errorCode === "email_not_verified") {
        return {
          ok: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "이메일 인증이 완료되지 않았습니다. 이메일을 확인해 주세요.",
        };
      }

      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      };
    }

    return {
      ok: false,
      code: "UNKNOWN",
      message: "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
    };
  }
}

/**
 * 로그아웃 (AC #5).
 * Better Auth의 POST /api/v1/auth/sign-out 엔드포인트를 호출한다.
 * 서버에서 세션을 무효화하고 쿠키를 제거한다.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/sign-out`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // 로그아웃은 실패해도 클라이언트 상태는 초기화
  }
}

/**
 * 현재 세션 조회 (AC #2, #8).
 * Better Auth의 GET /api/v1/auth/get-session 엔드포인트를 호출한다.
 * 로그인 상태가 아니면 null 반환.
 */
export async function getSession(cookieHeader?: string): Promise<SessionResponse | null> {
  try {
    const headers: Record<string, string> = {};
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }

    const res = await fetch(`${AUTH_BASE}/get-session`, {
      credentials: "include",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = (await res.json()) as SessionResponse | null;
    return data ?? null;
  } catch {
    return null;
  }
}
