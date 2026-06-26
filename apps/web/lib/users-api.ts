/**
 * 계정 설정용 클라이언트 fetch 헬퍼 (Story 1.9).
 *
 * 인증 권위는 API 서버(Better Auth).
 * 이 파일의 함수는 브라우저에서 호출하며, 세션 쿠키(aj_session)는 자동 포함된다.
 */

/** API 기본 경로 */
const USERS_BASE = "/api/v1/users";

// ── 타입 ───────────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
}

export interface UpdateProfileInput {
  nickname?: string;
  bio?: string;
  links?: { label: string; url: string }[];
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  /** 기본 아바타 선택 시 인덱스 (커스텀 업로드 해제는 avatarUrl:null 동반). */
  defaultAvatarIndex?: number;
  /** 실명(이름). null 이면 삭제. */
  name?: string | null;
  /** 휴대폰 번호 (숫자·하이픈). null 이면 삭제. */
  phone?: string | null;
  /** 성별. null 이면 선택안함. */
  gender?: "male" | "female" | "other" | null;
  /** 생년월일 (YYYY-MM-DD). null 이면 삭제. */
  birthDate?: string | null;
  /** 마케팅 수신 동의 여부. */
  marketingAgreed?: boolean;
}

export interface UpdateProfileResult {
  ok: true;
  user: {
    id: string;
    email: string;
    nickname: string;
    status: string;
    emailVerified: boolean;
    defaultAvatarIndex: number;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: string;
  };
}

export interface ApiFailure {
  ok: false;
  code: string;
  message: string;
}

// ── 프로필 수정 ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/users/me — 프로필 수정.
 * 성공: 갱신된 사용자 정보 반환.
 * 409 NICKNAME_TAKEN: 닉네임 중복.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult | ApiFailure> {
  try {
    const res = await fetch(`${USERS_BASE}/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });

    if (res.ok) {
      const user = await res.json() as UpdateProfileResult["user"];
      return { ok: true, user };
    }

    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN", message: "오류가 발생했습니다." } })) as { error: ApiError };
    return { ok: false, code: body.error?.code ?? "UNKNOWN", message: body.error?.message ?? "오류가 발생했습니다." };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "네트워크 오류가 발생했습니다." };
  }
}

// ── 닉네임 중복 확인 ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/users/check-nickname?nickname= — 닉네임 중복 확인.
 * 현재 사용자 자신은 제외한다.
 */
export async function checkNickname(nickname: string): Promise<{ available: boolean } | null> {
  try {
    const res = await fetch(`${USERS_BASE}/check-nickname?nickname=${encodeURIComponent(nickname)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ available: boolean }>;
  } catch {
    return null;
  }
}

// ── 비밀번호 변경 ─────────────────────────────────────────────────────────────

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * POST /api/v1/users/me/password — 비밀번호 변경.
 * 401 WRONG_PASSWORD: 현재 비밀번호 불일치.
 */
export async function changePassword(input: ChangePasswordInput): Promise<{ ok: true } | ApiFailure> {
  try {
    const res = await fetch(`${USERS_BASE}/me/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN", message: "오류가 발생했습니다." } })) as { error: ApiError };
    return { ok: false, code: body.error?.code ?? "UNKNOWN", message: body.error?.message ?? "오류가 발생했습니다." };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "네트워크 오류가 발생했습니다." };
  }
}

// ── 연결된 providers 목록 ────────────────────────────────────────────────────

/**
 * GET /api/v1/users/me/accounts — 연결된 인증 providers 목록.
 * 소셜 전용 계정 판별에 사용 (credential 없으면 소셜 전용).
 */
export async function getMyAccounts(): Promise<{ providers: string[] } | null> {
  try {
    const res = await fetch(`${USERS_BASE}/me/accounts`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ providers: string[] }>;
  } catch {
    return null;
  }
}

// ── 회원 탈퇴 ────────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/users/me — 회원 탈퇴.
 * 성공 시 세션 쿠키는 클라이언트에서 직접 제거해야 한다.
 */
export async function withdrawUser(): Promise<{ ok: true } | ApiFailure> {
  try {
    const res = await fetch(`${USERS_BASE}/me`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN", message: "오류가 발생했습니다." } })) as { error: ApiError };
    return { ok: false, code: body.error?.code ?? "UNKNOWN", message: body.error?.message ?? "오류가 발생했습니다." };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "네트워크 오류가 발생했습니다." };
  }
}

// ── 이미지 업로드 ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/users/uploads/avatar — 아바타 이미지 업로드.
 * 성공 시 저장된 이미지 URL 반환.
 */
export async function uploadAvatar(file: File): Promise<{ url: string } | ApiFailure> {
  return uploadImage(`${USERS_BASE}/uploads/avatar`, file);
}

/**
 * POST /api/v1/users/uploads/banner — 배너 이미지 업로드.
 * 성공 시 저장된 이미지 URL 반환.
 */
export async function uploadBanner(file: File): Promise<{ url: string } | ApiFailure> {
  return uploadImage(`${USERS_BASE}/uploads/banner`, file);
}

async function uploadImage(url: string, file: File): Promise<{ url: string } | ApiFailure> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
      // Content-Type 은 fetch 가 multipart/form-data 로 자동 설정
    });

    if (res.ok) {
      const data = await res.json() as { url: string };
      return { url: data.url };
    }

    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN", message: "업로드 중 오류가 발생했습니다." } })) as { error: ApiError };
    return { ok: false, code: body.error?.code ?? "UNKNOWN", message: body.error?.message ?? "업로드 중 오류가 발생했습니다." };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "네트워크 오류가 발생했습니다." };
  }
}
