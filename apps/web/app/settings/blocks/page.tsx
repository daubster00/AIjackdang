import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Icon } from "@/components/ui";
import { BlockList } from "./BlockList";
import shell from "../settings.module.css";
import styles from "./blocks.module.css";

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
  // Next.js 15 — cookies() 는 비동기 API 이므로 반드시 await 필요
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  const res = await fetch(`${API_URL}/api/v1/users/me/blocks`, {
    headers: { cookie },
    cache: "no-store",
  });

  // API 응답 shape: { id, blockedId, nickname, createdAt }
  // BlockedUser interface: { blockId, blockedId, nickname, avatarUrl, blockedAt }
  // — 필드명 불일치이므로 명시적으로 매핑한다.
  const blocks: BlockedUser[] = res.ok
    ? (
        (await res.json()) as {
          items: { id: string; blockedId: string; nickname: string; avatarUrl: string; createdAt: string }[];
        }
      ).items.map((item) => ({
        blockId: item.id,
        blockedId: item.blockedId,
        nickname: item.nickname,
        avatarUrl: item.avatarUrl,
        blockedAt: item.createdAt,
      }))
    : [];

  return (
    <main id="main" className={shell.page}>
      <div className={shell.wrap}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지
        </Link>
        <h1 className={shell.title}>차단 목록</h1>
        <p className={`${shell.desc} ${styles.desc}`}>차단한 회원의 게시글과 댓글이 숨겨집니다.</p>
        <BlockList initialBlocks={blocks} />
      </div>
    </main>
  );
}
