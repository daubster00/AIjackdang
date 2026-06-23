import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { NotificationsForm } from "./NotificationsForm";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "알림 설정",
  description: "댓글·좋아요·답변 채택·쪽지 등 AI작당 알림을 항목별로 켜고 끌 수 있습니다.",
};

export default function NotificationSettingsPage() {
  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>

        <section className={shell.card} aria-labelledby="settings-notifications-title">
          <div className={shell.head}>
            <p className={shell.eyebrow}>Notifications</p>
            <h1 id="settings-notifications-title">알림 설정</h1>
            <p>받고 싶은 알림만 골라서 켜 두세요. 언제든 다시 바꿀 수 있어요.</p>
          </div>
          <NotificationsForm />
        </section>
      </div>
    </main>
  );
}
