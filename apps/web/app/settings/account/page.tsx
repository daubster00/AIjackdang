import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { WithdrawalForm } from "./WithdrawalForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "계정 관리",
  description: "AI작당 계정 탈퇴를 진행합니다.",
  robots: { index: false, follow: true },
};

export default function AccountSettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <section className={shell.card} aria-labelledby="settings-account-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Account</p>
            <h1 id="settings-account-title">계정 관리</h1>
            <p>계정 탈퇴를 진행합니다. 탈퇴 후에는 계정을 복구할 수 없습니다.</p>
          </div>
          <WithdrawalForm />
        </section>
      </div>
    </main>
  );
}
