import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  description: "이메일로 비밀번호 재설정 링크를 받아 새 비밀번호를 설정합니다.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
