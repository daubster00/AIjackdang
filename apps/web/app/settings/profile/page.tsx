import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { ProfileForm } from "./ProfileForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "프로필 수정",
  description: "AI작당 프로필을 수정하세요. 닉네임과 한 줄 소개를 변경할 수 있습니다.",
};

export default function ProfileSettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <section className={shell.card} aria-labelledby="settings-profile-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Profile</p>
            <h1 id="settings-profile-title">프로필 수정</h1>
            <p>다른 사용자에게 보이는 닉네임과 한 줄 소개를 관리합니다.</p>
          </div>
          <ProfileForm />
        </section>
      </div>
    </main>
  );
}
