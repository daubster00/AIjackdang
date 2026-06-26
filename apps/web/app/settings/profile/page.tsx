import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { ProfileForm } from "./ProfileForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "프로필 수정",
  description: "공개 프로필 정보(닉네임·아바타·배너·소개·링크)를 관리합니다.",
  robots: { index: false, follow: true },
};

export default function ProfileSettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <SettingsNav />

        <section className={shell.card} aria-labelledby="settings-profile-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Settings</p>
            <h1 id="settings-profile-title">프로필 수정</h1>
            <p>닉네임·아바타·배너·소개·링크 등 공개 프로필 정보를 관리합니다.</p>
          </div>
          <ProfileForm />
        </section>
      </div>
    </main>
  );
}
