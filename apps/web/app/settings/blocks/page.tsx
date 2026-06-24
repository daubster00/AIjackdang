import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Icon } from "@/components/ui";
import { BlockList } from "./BlockList";
import shell from "../settings.module.css";

export const metadata: Metadata = {
  title: "차단 목록",
  description: "차단한 회원 목록을 확인하고 차단을 해제할 수 있습니다.",
  robots: { index: false, follow: true },
};

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface BlockedUser {
  blockId: string;
  blockedId: string;
  nickname: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export default async function BlocksSettingsPage() {
  const cookieStore = cookies();
  const cookie = cookieStore.toString();

  const res = await fetch(`${API_URL}/api/v1/users/me/blocks`, {
    headers: { cookie },
    cache: "no-store",
  });
  const blocks: BlockedUser[] = res.ok
    ? ((await res.json()) as { items: BlockedUser[] }).items
    : [];

  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>
        <h1 className={shell.title}>차단 목록</h1>
        <p className={shell.desc}>차단한 회원의 게시글과 댓글이 숨겨집니다.</p>
        <BlockList initialBlocks={blocks} />
      </div>
    </main>
  );
}
