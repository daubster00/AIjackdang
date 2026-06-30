"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FontSizeSelect.module.css";

export type FontSizeOption = { label: string; value: string };

/**
 * 에디터 툴바 전용 글자 크기 드롭다운.
 *
 * 브라우저 기본 <select> 대신 디자인 시스템 커스텀 드롭다운을 쓴다.
 * 툴바가 `overflow-x: auto` 라 인라인 메뉴는 잘리므로, 메뉴를 body 포털 +
 * position:fixed 로 띄워 클리핑을 회피한다. 옵션 overflow 시 얇은 보라 스크롤.
 */
export function FontSizeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: FontSizeOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({
    left: 0,
    top: 0,
    width: 0,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 140) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="글자 크기"
        title="글자 크기 선택"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerLabel}>{selected?.label ?? "기본"}</span>
        <i className="ri-arrow-down-s-line" aria-hidden="true" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={menuRef}
            className={styles.menu}
            role="listbox"
            style={{ left: pos.left, top: pos.top, minWidth: pos.width }}
          >
            {options.map((o) => (
              <li
                key={o.value || "default"}
                role="option"
                aria-selected={o.value === value}
                className={`${styles.option} ${o.value === value ? styles.selected : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <i className="ri-check-line" aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
