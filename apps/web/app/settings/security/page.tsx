import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { SecurityForm } from "./SecurityForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "비밀번호 변경",
  description: "AI작당 계정의 비밀번호를 변경하세요.",
  robots: { index: false, follow: true },
};

export default function SecuritySettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <section className={shell.card} aria-labelledby="settings-security-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Security</p>
            <h1 id="settings-security-title">비밀번호 변경</h1>
            <p>안전을 위해 주기적으로 비밀번호를 변경하는 것을 권장합니다.</p>
          </div>
          <SecurityForm />
        </section>
      </div>
    </main>
  );
}
