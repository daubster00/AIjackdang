"use client";

/**
 * ConversationsPage — 쪽지함 대화 목록 클라이언트 컴포넌트 (Story 7.4)
 *
 * 마운트 시 GET /api/v1/messages/conversations를 호출해 목록을 렌더한다.
 * 항목 클릭 시 /messages/{partnerId} 스레드 뷰로 이동한다.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Avatar, EmptyState, Icon } from "@/components/ui";
import styles from "./messages.module.css";

// ── 상대시간 로컬 헬퍼 ─────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffMs = now - past;
  if (diffMs < 0) return "방금 전";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(days / 365);
  return `${years}년 전`;
}

function preview(text: string, max = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ConversationItem {
  partnerId: string;
  partnerNickname: string;
  partnerAvatarUrl: string | null;
  lastMessageId: string;
  lastMessageBody: string;
  lastMessageAt: string;
  lastMessageIsRead: boolean;
  isSentByMe: boolean;
  unreadCount: number;
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <li className={styles.skeletonItem} aria-hidden="true">
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonText}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    </li>
  );
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function ConversationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/messages/conversations", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError("대화 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { items: ConversationItem[] };
      setItems(data.items ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  if (loading) {
    return (
      <main id="main" className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headInner}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>
                <Icon name="mail-line" />
                쪽지함
              </h1>
            </div>
          </div>
        </header>
        <div className={styles.listLayout}>
          <ul className={styles.list} aria-label="대화 목록 로딩 중">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </ul>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main" className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headInner}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>
                <Icon name="mail-line" />
                쪽지함
              </h1>
            </div>
          </div>
        </header>
        <div className={styles.listLayout}>
          <EmptyState
            icon="error-warning-line"
            title="불러오기 실패"
            description={error}
            actions={
              <button
                type="button"
                onClick={() => void loadConversations()}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  cursor: "pointer",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                다시 시도
              </button>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main id="main" className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headInner}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <Icon name="mail-line" />
              쪽지함
            </h1>
          </div>
        </div>
      </header>

      <div className={styles.listLayout}>
        {items.length === 0 ? (
          <EmptyState
            icon="mail-line"
            title="아직 주고받은 쪽지가 없어요"
            description="다른 회원에게 먼저 쪽지를 보내보세요."
          />
        ) : (
          <ul className={styles.list} aria-label="쪽지 대화 목록">
            {items.map((item) => {
              const isUnread = item.unreadCount > 0;
              return (
                <li key={item.partnerId}>
                  <button
                    type="button"
                    className={`${styles.item} ${isUnread ? styles.itemUnread : ""}`}
                    onClick={() => router.push(`/messages/${item.partnerId}`)}
                    aria-label={`${item.partnerNickname}님과의 대화${isUnread ? `, 안 읽은 메시지 ${item.unreadCount}개` : ""}`}
                  >
                    <Avatar
                      name={item.partnerNickname}
                      src={item.partnerAvatarUrl ?? undefined}
                      size="md"
                    />
                    <div className={styles.itemBody}>
                      <div className={styles.itemTop}>
                        <span className={styles.partner}>{item.partnerNickname}</span>
                        <span className={styles.date}>{timeAgo(item.lastMessageAt)}</span>
                      </div>
                      <span className={`${styles.excerpt} ${isUnread ? styles.excerptUnread : ""}`}>
                        {item.isSentByMe && "나: "}
                        {preview(item.lastMessageBody)}
                      </span>
                    </div>
                    {isUnread && (
                      <span className={styles.unreadBadge} aria-label={`${item.unreadCount}개 안 읽음`}>
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
