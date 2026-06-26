"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { Textarea } from "../Textarea";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { useToast } from "../Toast/Toast";
import styles from "./MessageModal.module.css";

/** 최대 글자 수 — epics.md AC 기준 500자 */
const MAX = 500;

export interface MessageModalProps {
  /** 모달 표시 여부 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 받는 사람 닉네임 (표시용) */
  recipient: string;
  /**
   * 받는 사람 userId (API 전송에 사용).
   * 미지정이거나 빈 문자열이면 보내기 버튼 비활성화.
   */
  recipientId?: string;
  /** 받는 사람 아바타 이미지 URL. Avatar src에 전달된다. */
  recipientAvatarUrl?: string | null;
}

/**
 * 쪽지 보내기 모달 (공용).
 * 작성자 닉네임 메뉴, 작당 의뢰소 상세 등 쪽지를 보낼 수 있는 모든 곳에서 동일하게 사용한다.
 *
 * recipientId prop을 받으면 실제 POST /api/v1/messages API를 호출한다.
 */
export function MessageModal({ open, onClose, recipient, recipientId, recipientAvatarUrl }: MessageModalProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canSend = message.trim().length > 0 && !!recipientId && !loading;

  async function handleSend() {
    if (!canSend || !recipientId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: recipientId, body: message.trim() }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        toast({
          tone: "danger",
          title: data?.error?.message ?? "1시간에 최대 10개까지 보낼 수 있습니다.",
        });
        return;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        toast({
          tone: "danger",
          title: data?.error?.message ?? "보낼 수 없는 상대입니다.",
        });
        return;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        toast({
          tone: "danger",
          title: data?.error?.message ?? "쪽지를 보낼 수 없습니다.",
        });
        return;
      }

      if (!res.ok) {
        toast({ tone: "danger", title: "쪽지 발송에 실패했습니다. 다시 시도해 주세요." });
        return;
      }

      toast({ tone: "success", title: "쪽지를 보냈습니다." });
      setMessage("");
      onClose();
    } catch {
      toast({ tone: "danger", title: "쪽지 발송 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="쪽지 보내기"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            loading={loading}
          >
            <Icon name="mail-send-line" />
            보내기
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <div className={styles.recipient}>
          <Avatar name={recipient} src={recipientAvatarUrl ?? undefined} size="sm" />
          <div className={styles.recipientInfo}>
            <span className={styles.recipientLabel}>받는 사람</span>
            <strong className={styles.recipientName}>{recipient}</strong>
          </div>
        </div>

        <Textarea
          label="메시지"
          placeholder="보낼 내용을 입력하세요. 정중하게 용건을 적으면 답장 확률이 높아집니다."
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
          currentLength={message.length}
          maxLengthHint={MAX}
          rows={6}
        />
      </div>
    </Modal>
  );
}
