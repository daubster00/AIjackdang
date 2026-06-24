"use client";

/**
 * NotificationItem — 알림 1건 렌더 컴포넌트 (Story 7.2)
 *
 * - type별 아이콘 매핑 (색 + 아이콘 + 텍스트로 상태 전달 — 색만으로 상태 전달 금지)
 * - 미읽음: 강조 스타일 + 점 인디케이터 + 스크린리더용 텍스트
 * - 클릭: ① PATCH /{id}/read ② targetUrl 있으면 라우터 이동
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { resolveNotificationUrl } from "@/lib/resolveNotificationUrl";
import styles from "./notifications.module.css";

/** 알림 1건 타입 (API 응답 직렬화 결과) */
export interface NotificationItemData {
  id: string;
  userId: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// ── 상대시간 로컬 헬퍼 ─────────────────────────────────────────────────────────
// 다른 에이전트와 파일 충돌 방지를 위해 공유 lib 파일을 만들지 않고 여기에 로컬로 작성.

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

// ── 타입별 아이콘 + 색 토널 매핑 ───────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { icon: string; toneClass: keyof typeof styles; ariaLabel: string }
> = {
  "comment.created":    { icon: "chat-1-line",           toneClass: "toneComment",  ariaLabel: "댓글" },
  "answer.created":     { icon: "question-answer-line",  toneClass: "toneAnswer",   ariaLabel: "답변" },
  "comment.replied":    { icon: "reply-line",            toneClass: "toneComment",  ariaLabel: "댓글 답글" },
  "reaction.received":  { icon: "heart-line",            toneClass: "toneReaction", ariaLabel: "좋아요" },
  "helpful_answer.marked": { icon: "checkbox-circle-line", toneClass: "toneHelpful", ariaLabel: "답변 채택" },
  "message.received":   { icon: "mail-line",             toneClass: "toneMessage",  ariaLabel: "쪽지" },
  "sanction.applied":   { icon: "error-warning-line",    toneClass: "toneSanction", ariaLabel: "제재" },
  "inquiry.replied":    { icon: "customer-service-line", toneClass: "toneDefault",  ariaLabel: "문의 답변" },
};

const DEFAULT_META = { icon: "notification-3-line", toneClass: "toneDefault" as const, ariaLabel: "알림" };

// ── 컴포넌트 ───────────────────────────────────────────────────────────────────

export interface NotificationItemProps {
  item: NotificationItemData;
  onRead: (id: string) => void;
}

export function NotificationItem({ item, onRead }: NotificationItemProps) {
  const router = useRouter();
  const meta = TYPE_META[item.type] ?? DEFAULT_META;
  const toneClass = styles[meta.toneClass] ?? styles.toneDefault;

  const handleClick = useCallback(async () => {
    if (!item.isRead) {
      try {
        await fetch(`/api/v1/notifications/${item.id}/read`, {
          method: "PATCH",
          credentials: "include",
        });
        onRead(item.id);
      } catch {
        // 읽음 처리 실패 시 이동은 계속 진행
      }
    }

    // targetUrl 해석
    const targetUrl = resolveNotificationUrl(item.targetType, item.targetId);
    if (targetUrl) {
      router.push(targetUrl);
    }
  }, [item, onRead, router]);

  const relativeTime = timeAgo(item.createdAt);

  return (
    <li className={`${styles.item} ${item.isRead ? "" : styles.itemUnread}`}>
      <button
        type="button"
        className={styles.itemButton}
        onClick={handleClick}
        aria-label={`${meta.ariaLabel} 알림: ${item.title}${item.isRead ? "" : " (안 읽음)"}`}
      >
        {/* 타입 아이콘 — 색 + 아이콘 + ariaLabel 로 상태 전달 */}
        <span className={`${styles.typeIcon} ${toneClass}`} aria-hidden="true">
          <Icon name={meta.icon} />
        </span>

        <div className={styles.body}>
          <p className={styles.itemTitle}>{item.title}</p>
          <p className={styles.itemBody}>{item.body}</p>
          <time className={styles.time} dateTime={item.createdAt}>
            {relativeTime}
          </time>
        </div>

        {!item.isRead && (
          <span className={styles.unreadIndicator}>
            <span className={styles.unreadDot} aria-hidden="true" />
            <span className={styles.unreadLabel}>안 읽은 알림</span>
          </span>
        )}
      </button>
    </li>
  );
}
