"use client";

/**
 * 공용 삭제 확인 모달.
 *
 * 묻고답하기(Q&A) 상세에서 쓰던 삭제 확인 창을 추출하여 전 게시판이 공유한다.
 * 모든 게시판의 "삭제하시겠습니까?" 알림 창이 동일하게 보이도록 단일 소스로 둔다.
 * 배경 클릭 / ESC 로 닫힌다.
 */

import { useEffect } from "react";
import styles from "./DeleteConfirmModal.module.css";

export interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 제목. 기본 "삭제하시겠습니까?" */
  title?: string;
  /** 설명. 기본 "삭제된 항목은 복구할 수 없습니다." */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 확인 처리 중 로딩 */
  loading?: boolean;
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "삭제하시겠습니까?",
  description = "삭제된 항목은 복구할 수 없습니다.",
  confirmLabel = "삭제",
  cancelLabel = "취소",
  loading = false,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id="delete-confirm-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.desc}>{description}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.ok}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "삭제 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
