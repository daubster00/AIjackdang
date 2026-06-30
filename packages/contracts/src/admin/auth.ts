import { z } from "zod";

// ── 관리자 로그인 ──────────────────────────────────────────────────────────────

/** 관리자 로그인 요청 규격. */
export const adminSignInSchema = z.object({
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});
export type AdminSignInInput = z.infer<typeof adminSignInSchema>;

// ── 관리자 가입 ───────────────────────────────────────────────────────────────

/** 관리자 가입 요청 규격. status=pending, role=staff 로 생성. */
export const adminSignUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름은 50자 이하여야 합니다"),
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .max(128, "비밀번호는 128자 이하여야 합니다"),
  phone: z
    .string()
    .trim()
    .min(1, "연락처를 입력해주세요")
    .max(20, "연락처는 20자 이하여야 합니다"),
});
export type AdminSignUpInput = z.infer<typeof adminSignUpSchema>;

// ── 관리자 로그인 응답 ─────────────────────────────────────────────────────────

/** POST /api/v1/admin/auth/sign-in 성공 응답. */
export const adminSignInResponseSchema = z.object({
  adminUser: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(), // staff/super_admin 고정 + 커스텀 역할(M12)
    status: z.enum(["pending", "active", "suspended", "disabled"]),
  }),
});
export type AdminSignInResponse = z.infer<typeof adminSignInResponseSchema>;

// ── 관리자 가입 응답 ───────────────────────────────────────────────────────────

/** POST /api/v1/admin/auth/sign-up 성공 응답. */
export const adminSignUpResponseSchema = z.object({
  status: z.literal("pending"),
  message: z.string(),
});
export type AdminSignUpResponse = z.infer<typeof adminSignUpResponseSchema>;
