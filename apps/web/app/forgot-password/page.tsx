import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  description: "이메일과 휴대전화 번호로 본인 확인 후 임시 비밀번호 발송을 요청합니다.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
