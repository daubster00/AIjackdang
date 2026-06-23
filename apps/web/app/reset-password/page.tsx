/**
 * /reset-password 페이지 (Story 1.6).
 *
 * 서버 컴포넌트: ?token= 파라미터 없으면 /forgot-password 로 리다이렉트.
 * 클라이언트 폼: ResetPasswordForm 에 token 전달.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
  description: "새 비밀번호를 설정합니다.",
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm token={token} />;
}
