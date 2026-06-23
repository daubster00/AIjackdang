"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { Textarea } from "../Textarea";
import { Button } from "../Button";
import { Icon } from "../Icon";
import styles from "./MessageModal.module.css";

const MAX = 1000;

export interface MessageModalProps {
  /** 모달 표시 여부 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 받는 사람 닉네임 */
  recipient: string;
}

/**
 * 쪽지 보내기 모달 (공용).
 * 작성자 닉네임 메뉴, 작당 의뢰소 상세 등 쪽지를 보낼 수 있는 모든 곳에서 동일하게 사용한다.
 * 실제 발송 API 연동 전까지는 목업(alert) 처리한다.
 */
export function MessageModal({ open, onClose, recipient }: MessageModalProps) {
  const [message, setMessage] = useState("");

  function handleSend() {
    alert(`'${recipient}' 님에게 쪽지를 보냈습니다. (목업)`);
    setMessage("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="쪽지 보내기"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" type="button" onClick={onClose}>
            취소
          </Button>
          <Button type="button" onClick={handleSend} disabled={!message.trim()}>
            <Icon name="mail-send-line" />
            보내기
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <div className={styles.recipient}>
          <Avatar name={recipient} size="sm" />
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
