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
  bio: z.string().nullable(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

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
