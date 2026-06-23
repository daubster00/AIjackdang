"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "../IconButton";
import { Icon } from "../Icon";
import styles from "./Drawer.module.css";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
}

/** 측면 슬라이드 패널. 모바일 메뉴·필터 등에 사용한다. ESC/배경 클릭으로 닫는다. */
export function Drawer({ open, onClose, title, side = "right", children }: DrawerProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside
        className={cn(styles.panel, styles[side])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          <IconButton aria-label="닫기" size="sm" ghost onClick={onClose}>
            <Icon name="close-line" />
          </IconButton>
        </div>
        <div className={styles.body}>{children}</div>
      </aside>
    </>,
    document.body,
  );
}
