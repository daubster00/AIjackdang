"use client";

/**
 * NotificationModal — 알림 상세 모달 (Story 7.2)
 *
 * - 알림 1건의 제목·본문·타입·시간을 모달로 표시
 * - targetUrl 이 있으면 "이동하기" 버튼 표시 → 클릭 시 해당 페이지로 이동
 * - inquiry.replied 타입: targetType="inquiry" → /inquiries/{targetId} 이동
 * - createPortal 을 사용하는 Modal 컴포넌트를 재사용 (centered + dark backdrop)
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { resolveNotificationUrl } from "@/lib/resolveNotificationUrl";
import type { NotificationItemData } from "./NotificationItem";
import styles from "./notifications.module.css";

// ── 타입 레이블 매핑 ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  "comment.created":        "댓글",
  "answer.created":         "답변",
  "comment.replied":        "댓글 답글",
  "reaction.received":      "좋아요",
  "helpful_answer.marked":  "답변 채택",
  "message.received":       "쪽지",
  "sanction.applied":       "제재",
  "inquiry.replied":        "문의 답변",
};

// ── 날짜 포맷 헬퍼 ───────────────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export interface NotificationModalProps {
  item: NotificationItemData;
  open: boolean;
  onClose: () => void;
}

export function NotificationModal({ item, open, onClose }: NotificationModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const typeLabel = TYPE_LABEL[item.type] ?? "알림";
  const targetUrl = resolveNotificationUrl(item.targetType, item.targetId);

  const handleNavigate = useCallback(async () => {
    if (!targetUrl) return;

    // inquiry 타입: 이동 전 대상 문의 존재 여부 확인
    // 삭제된 문의라면 이동하지 않고 안내 토스트를 띄운다.
    if (item.targetType === "inquiry" && item.targetId) {
      try {
        const res = await fetch(`/api/v1/inquiries/${item.targetId}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 404) {
          onClose();
          toast({ tone: "danger", title: "해당 문의가 삭제되었습니다." });
          return;
        }
      } catch {
        // 네트워크 오류 시 그냥 이동 (best effort)
      }
    }

    onClose();
    router.push(targetUrl);
  }, [targetUrl, onClose, router, item.targetType, item.targetId, toast]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="알림 상세"
      size="sm"
      footer={
        targetUrl ? (
          <Button variant="primary" size="sm" onClick={() => { void handleNavigate(); }}>
            이동하기
          </Button>
        ) : undefined
      }
    >
      <div className={styles.modalContent}>
        {/* 타입 태그 + 수신 시간 */}
        <div className={styles.modalTypeRow}>
          <span className={styles.modalTypeTag}>{typeLabel}</span>
          <time className={styles.modalTime} dateTime={item.createdAt}>
            {formatDateTime(item.createdAt)}
          </time>
        </div>

        {/* 알림 제목 */}
        <p className={styles.modalTitle}>{item.title}</p>

        {/* 알림 본문 (있는 경우만) */}
        {item.body && <p className={styles.modalBody}>{item.body}</p>}
      </div>
    </Modal>
  );
}
