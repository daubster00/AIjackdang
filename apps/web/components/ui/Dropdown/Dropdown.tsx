"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import styles from "./Dropdown.module.css";

export interface DropdownProps {
  /** 트리거 요소(Button/IconButton 등). onClick/aria-expanded 가 주입된다. */
  trigger: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean }>;
  children: ReactNode;
  /** 메뉴 정렬 */
  align?: "start" | "end";
  className?: string;
}

/** 드롭다운 메뉴. 바깥 클릭과 Esc 로 닫힌다. */
export function Dropdown({ trigger, children, align = "start", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
      })
    : trigger;

  return (
    <div ref={rootRef} className={cn(styles.dropdown, className)}>
      {triggerNode}
      {open && (
        <div
          className={cn(styles.menu, align === "end" && styles.alignEnd)}
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 위험 액션(삭제 등) */
  danger?: boolean;
  /** 링크로 렌더링할 경우 href */
  href?: string;
  children: ReactNode;
}

/** 드롭다운 항목. 버튼 또는 링크로 렌더링한다. */
export function DropdownItem({ danger, href, className, children, ...rest }: DropdownItemProps) {
  const classes = cn(styles.item, danger && styles.danger, className);
  if (href) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} href={href} role="menuitem" {...anchorProps}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} role="menuitem" {...rest}>
      {children}
    </button>
  );
}

/** 드롭다운 구분선 */
export function DropdownDivider() {
  return <div className={styles.divider} role="separator" />;
}
