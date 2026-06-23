"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./blocks.module.css";

interface BlockedUser {
  blockId: string;
  blockedId: string;
  nickname: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export function BlockList({ initialBlocks }: { initialBlocks: BlockedUser[] }) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<BlockedUser[]>(initialBlocks);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleUnblock(blockId: string, nickname: string) {
    const confirmed = window.confirm(`${nickname} 님의 차단을 해제하시겠습니까?`);
    if (!confirmed) return;

    setRemoving(blockId);
    try {
      const res = await fetch(`/api/v1/blocks/${blockId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setBlocks((prev) => prev.filter((b) => b.blockId !== blockId));
      toast({ tone: "success", title: `${nickname} 님의 차단이 해제되었습니다.` });
    } catch {
      toast({ tone: "danger", title: "차단 해제에 실패했습니다." });
    } finally {
      setRemoving(null);
    }
  }

  if (blocks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="user-forbid-line" />
        <p>차단한 회원이 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className={styles.blockList}>
      {blocks.map((block) => (
        <li key={block.blockId} className={styles.blockItem}>
          <div className={styles.blockUser}>
            {block.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.avatarUrl} alt="" className={styles.blockAvatar} />
            ) : (
              <div className={styles.blockAvatarFallback}>
                <Icon name="user-3-line" />
              </div>
            )}
            <span className={styles.blockNickname}>{block.nickname}</span>
          </div>
          <button
            type="button"
            className={styles.unblockBtn}
            disabled={removing === block.blockId}
            onClick={() => void handleUnblock(block.blockId, block.nickname)}
          >
            {removing === block.blockId ? "처리 중..." : "차단 해제"}
          </button>
        </li>
      ))}
    </ul>
  );
}
