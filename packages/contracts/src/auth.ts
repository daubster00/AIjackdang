import { z } from "zod";

/** 회원가입 요청 규격. 클라이언트와 API 가 동일한 스키마를 공유한다. */
export const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(2).max(20),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

/** 로그인 요청 규격. */
export const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** 인증된 사용자 공개 정보(응답). 비밀번호 등 민감 정보는 포함하지 않는다. */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  role: z.enum(["member", "admin"]),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
