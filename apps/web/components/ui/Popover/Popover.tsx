"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import styles from "./Popover.module.css";

export interface PopoverProps {
  trigger: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean; "aria-controls"?: string }>;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** 팝오버. 짧은 보조 정보·빠른 액션에 사용한다. */
export function Popover({ trigger, title, children, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-controls": panelId,
      })
    : trigger;

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      {triggerNode}
      {open && (
        <div className={styles.panel} id={panelId} role="dialog" aria-label={title}>
          {title && <h3 className={styles.title}>{title}</h3>}
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </div>
  );
}
