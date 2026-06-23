"use client";

import type { ReactNode } from "react";
import { Button } from "../Button";
import { Modal } from "../Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  /** 확인 버튼 종류. 삭제 등 위험 작업은 danger 를 사용한다. */
  tone?: "primary" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  /** 확인 처리 중 로딩 */
  loading?: boolean;
}

/** 결정 확인 다이얼로그. Modal 위에 확인/취소 액션을 구성한다. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  tone = "primary",
  confirmLabel = "확인",
  cancelLabel = "취소",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
