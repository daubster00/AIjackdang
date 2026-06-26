"use client";

/**
 * MessageDetailModal — 쪽지 단건 상세 모달 (메일박스형 UI용)
 *
 * - 받은 쪽지: 발신자 프로필(AuthorName) + 전체 본문 + 수신 시각 + 삭제 + 답장하기 버튼
 * - 보낸 쪽지: 수신자 프로필(AuthorName) + 전체 본문 + 발송 시각 + 삭제 버튼
 * - 휴지통: 상대방 프로필 + 전체 본문 + 영구삭제 버튼 (답장 없음)
 * - 채팅 버블/스레드 UI 없음 — 단일 메시지 상세만 표시
 */

import { useState } from "react";
import { Avatar, Button, Icon, MessageModal } from "@/components/ui";
import { AuthorName } from "@/components/ui/AuthorName/AuthorName";
import { Modal } from "@/components/ui/Modal/Modal";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./messages.module.css";

export interface MessageBoxItem {
  id: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  counterpart: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  /** 휴지통 아이템 전용 */
  trashedAt?: string;
  /** 휴지통 아이템 전용: 원래 받은/보낸 쪽지였는지 */
  originalBox?: "received" | "sent";
}

interface MessageDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: MessageBoxItem | null;
  /**
   * 'received': 상대=발신자, 삭제+답장하기 버튼 노출.
   * 'sent': 상대=수신자, 삭제 버튼 노출.
   * 'trash': 휴지통 아이템, 영구삭제 버튼 노출.
   */
  box: "received" | "sent" | "trash";
  /** 삭제(휴지통 이동) 성공 후 호출 — 목록에서 낙관적 제거에 사용 */
  onTrash?: (id: string) => void;
  /** 영구삭제 성공 후 호출 — 목록에서 낙관적 제거에 사용 */
  onPurge?: (id: string) => void;
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageDetailModal({
  open,
  onClose,
  item,
  box,
  onTrash,
  onPurge,
}: MessageDetailModalProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [purging, setPurging] = useState(false);
  const { toast } = useToast();

  // 모달이 닫혀 있거나 아이템이 없으면 렌더하지 않음
  if (!item) return null;

  const { counterpart } = item;

  // 박스별 타이틀·시각 레이블 결정
  const title =
    box === "received" ? "받은 쪽지" : box === "sent" ? "보낸 쪽지" : "쪽지 상세";
  const timeLabel =
    box === "received" ? "수신" : box === "sent" ? "발송" : "발송";

  function handleClose() {
    onClose();
    setReplyOpen(false);
  }

  async function handleTrash() {
    if (!item) return;
    setTrashing(true);
    try {
      const res = await fetch(`/api/v1/messages/${item.id}/trash`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({ tone: "success", title: "휴지통으로 이동했습니다" });
        onTrash?.(item.id);
        handleClose();
      } else {
        toast({ tone: "danger", title: "삭제에 실패했습니다" });
      }
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다" });
    } finally {
      setTrashing(false);
    }
  }

  async function handlePurge() {
    if (!item) return;
    setPurging(true);
    try {
      const res = await fetch(`/api/v1/messages/purge`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
      if (res.ok) {
        toast({ tone: "success", title: "영구삭제했습니다" });
        onPurge?.(item.id);
        handleClose();
      } else {
        toast({ tone: "danger", title: "영구삭제에 실패했습니다" });
      }
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다" });
    } finally {
      setPurging(false);
    }
  }

  // 받은 쪽지 맥락: 답장 가능 여부 결정
  const canReply =
    box === "received" ||
    (box === "trash" && item.originalBox === "received");

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={title}
        size="md"
        footer={
          <div className={styles.modalFooter}>
            {/* 수정요청 121: 닫기 버튼 → 테두리 있는 흰색 버튼(secondary variant) */}
            <Button variant="secondary" type="button" onClick={handleClose}>
              닫기
            </Button>

            {/* 수정요청 123: 삭제(휴지통) 버튼 — 일반 received/sent 탭에서만 */}
            {box !== "trash" && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => void handleTrash()}
                loading={trashing}
              >
                <Icon name="delete-bin-line" />
                삭제
              </Button>
            )}

            {/* 영구삭제 버튼 — 휴지통 탭에서만 */}
            {box === "trash" && (
              <Button
                variant="danger"
                type="button"
                onClick={() => void handlePurge()}
                loading={purging}
              >
                <Icon name="delete-bin-line" />
                영구삭제
              </Button>
            )}

            {/* 답장하기: 받은 쪽지 또는 휴지통 내 받은 쪽지 */}
            {canReply && (
              <Button
                type="button"
                onClick={() => setReplyOpen(true)}
              >
                <Icon name="reply-line" />
                답장하기
              </Button>
            )}
          </div>
        }
      >
        <div className={styles.readView}>
          {/* 상대방 프로필 + 시각 */}
          <div className={styles.readHead}>
            <Avatar
              name={counterpart.nickname}
              src={counterpart.avatarUrl ?? undefined}
              size="md"
            />
            <div className={styles.readHeadInfo}>
              {/*
                AuthorName: name + authorId 넘겨야 쪽지보내기/팔로우/계정 메뉴가 활성화됨.
                onClick 전파는 모달 backdrop과 분리되어 있으므로 stopPropagation 불필요.
              */}
              <AuthorName
                name={counterpart.nickname}
                authorId={counterpart.id}
                authorAvatarUrl={counterpart.avatarUrl}
              />
              <time className={styles.readTime} dateTime={item.createdAt}>
                {timeLabel} · {formatDateTime(item.createdAt)}
              </time>
            </div>
          </div>

          {/* 쪽지 본문 */}
          <div className={styles.readBody}>{item.body}</div>
        </div>
      </Modal>

      {/* 답장 보내기 모달 */}
      {canReply && (
        <MessageModal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          recipient={counterpart.nickname}
          recipientId={counterpart.id}
          recipientAvatarUrl={counterpart.avatarUrl}
        />
      )}
    </>
  );
}
