import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { AccountInfoForm } from "./AccountInfoForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "회원정보",
  description: "이름·휴대폰·성별·생년월일·마케팅 수신 동의 등 계정 개인정보를 관리합니다.",
  robots: { index: false, follow: true },
};

export default function MembershipSettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <SettingsNav />

        <section className={shell.card} aria-labelledby="settings-membership-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Settings</p>
            <h1 id="settings-membership-title">회원정보</h1>
            <p>이름·휴대폰·성별·생년월일·마케팅 수신 동의 등 개인정보를 관리합니다.</p>
          </div>
          <AccountInfoForm />
        </section>
      </div>
    </main>
  );
}
