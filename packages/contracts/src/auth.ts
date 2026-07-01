import { z } from "zod";

// ── 닉네임 공통 스키마 (AC #4) ─────────────────────────────────────────────────
/** 닉네임 허용 문자: 한글·영문·숫자·_ / 길이 2~20자 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "닉네임은 2자 이상이어야 합니다")
  .max(20, "닉네임은 20자 이하여야 합니다")
  .regex(/^[가-힣a-zA-Z0-9_]+$/, "한글·영문·숫자·_ 만 허용됩니다");

// ── 회원가입 (AC #8) ───────────────────────────────────────────────────────────
/**
 * 회원가입 요청 규격.
 * nickname 은 시스템 자동배정 → 입력 필드 없음.
 * termsAgreed 는 true 필수(false 시 검증 실패).
 */
export const signUpSchema = z.object({
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .max(128, "비밀번호는 128자 이하여야 합니다"),
  termsAgreed: z.literal(true, "약관에 동의해야 가입할 수 있습니다"),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

// ── 로그인 ─────────────────────────────────────────────────────────────────────
/** 로그인 요청 규격. */
export const signInSchema = z.object({
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});
export type SignInInput = z.infer<typeof signInSchema>;

// ── 공개 유저 정보 (응답) ──────────────────────────────────────────────────────
/**
 * 인증된 사용자 공개 정보(응답).
 * role 필드 없음 — 유저는 역할 없이 모두 일반 회원(ADR-0002).
 * 비밀번호 등 민감 정보는 포함하지 않는다.
 */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  status: z.enum(["active", "suspended", "withdrawn"]),
  emailVerified: z.boolean(),
  defaultAvatarIndex: z.number().int().nonnegative(),
  avatarUrl: z.string().nullable(),
  /** 소셜 provider 프로필 사진 URL(Better Auth core 필드). avatarUrl 없을 때 폴백으로 사용. */
  image: z.string().nullable(),
  bio: z.string().nullable(),
  /** 배너 이미지 URL */
  bannerUrl: z.string().nullable(),
  /** 외부 링크 [{label, url}] */
  links: z.array(z.object({ label: z.string(), url: z.string() })).nullable(),
  /** 이름(Better Auth core 필드). 회원정보 화면 표시·수정용. */
  name: z.string().nullable(),
  /** 휴대폰 번호 (회원정보 — 필수 입력 권장). */
  phone: z.string().nullable(),
  /** 성별 (선택). */
  gender: z.enum(["male", "female", "other"]).nullable(),
  /** 생년월일 'YYYY-MM-DD' (선택). */
  birthDate: z.string().nullable(),
  /** 마케팅 수신 동의 여부 (marketingAgreedAt 존재 여부로 도출). */
  marketingAgreed: z.boolean(),
  /** 약관 동의 시각 ISO (없으면 null). */
  termsAgreedAt: z.string().nullable(),
  /** 동의한 약관 버전 (없으면 null). */
  termsVersion: z.string().nullable(),
  /** 약관 재동의 필요 여부. termsVersion !== CURRENT_TERMS_VERSION 이면 true. */
  termsUpdateRequired: z.boolean(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

// ── 약관 재동의 응답 (Story 10.4) ────────────────────────────────────────────
/**
 * POST /api/v1/users/me/terms-consent 성공 응답.
 * termsUpdateRequired 는 항상 false — 동의 완료 상태.
 */
export const termsConsentResponseSchema = z.object({
  termsAgreedAt: z.string(),
  termsVersion: z.string(),
  termsUpdateRequired: z.literal(false),
});
export type TermsConsentResponse = z.infer<typeof termsConsentResponseSchema>;

// ── 세션 응답 (AC #1, #2, #8) ─────────────────────────────────────────────────
/**
 * GET /api/v1/auth/session 응답 스키마.
 * Better Auth session 응답의 user 필드에서 추출한 공개 정보.
 * UserSession (packages/auth) 타입과 정합을 맞춘다.
 */
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    nickname: z.string(),
    status: z.enum(["active", "suspended", "withdrawn"]),
    emailVerified: z.boolean(),
    defaultAvatarIndex: z.number().int().nonnegative(),
    avatarUrl: z.string().nullable(),
    /** 소셜 provider 프로필 사진 URL. avatarUrl 없을 때 폴백. */
    image: z.string().nullable(),
    createdAt: z.string(),
  }),
  session: z.object({
    id: z.string(),
    expiresAt: z.string(),
  }),
});
export type SessionResponse = z.infer<typeof sessionSchema>;

// ── 프로필 수정 (AC #4 updateProfileSchema) ────────────────────────────────────
/** 프로필 수정 요청 규격. 모든 필드 선택적. */
export const updateProfileSchema = z.object({
  nickname: nicknameSchema.optional(),
  bio: z.string().max(120, "자기소개는 120자 이하여야 합니다").optional(),
  /** [{label: string, url: string}] 형태 */
  links: z
    .array(
      z.object({
        label: z.string().max(30),
        url: z.string().url("올바른 URL 형식이 아닙니다"),
      }),
    )
    .max(5, "링크는 최대 5개까지 등록할 수 있습니다")
    .optional(),
  // ── 회원정보 (수정요청 F) ──────────────────────────────────────────────────
  /** 이름. */
  name: z.string().trim().max(50, "이름은 50자 이하여야 합니다").optional(),
  /** 휴대폰 번호. 숫자·하이픈 허용. */
  phone: z
    .string()
    .trim()
    .max(30, "휴대폰 번호가 너무 깁니다")
    .regex(/^[0-9+\-\s]*$/, "휴대폰 번호 형식이 올바르지 않습니다")
    .optional(),
  /** 성별 (선택). null 로 보내면 미선택 처리. */
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  /** 생년월일 'YYYY-MM-DD' (선택). null 로 보내면 해제. */
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일 형식이 올바르지 않습니다(YYYY-MM-DD)")
    .nullable()
    .optional(),
  /** 마케팅 수신 동의 여부. true → marketingAgreedAt 갱신, false → null. */
  marketingAgreed: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ── 비밀번호 변경 (AC #4 changePasswordSchema) ─────────────────────────────────
/** 비밀번호 변경 요청 규격. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
  newPassword: z
    .string()
    .min(8, "새 비밀번호는 8자 이상이어야 합니다")
    .max(128, "새 비밀번호는 128자 이하여야 합니다"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── 비밀번호 재설정 (Story 1.6) ────────────────────────────────────────────────

/** POST /auth/forgot-password 요청 규격. */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** POST /auth/reset-password 요청 규격. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "재설정 토큰이 없습니다"),
  newPassword: z
    .string()
    .min(8, "새 비밀번호는 8자 이상이어야 합니다")
    .max(128, "새 비밀번호는 128자 이하여야 합니다"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
