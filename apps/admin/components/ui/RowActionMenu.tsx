"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * 테이블 행 액션 드롭다운(삼점 메뉴) — React 제어판.
 *
 * ⚠️ 배경: 디자인 시스템의 `.action-menu` 는 원래 vanilla `js/table.js` 가
 * `.open` 클래스를 토글해 열도록 설계됐지만, Next.js 관리자 앱에는 table.js 가
 * **로드되지 않아** 모든 목록의 삼점 메뉴가 클릭해도 열리지 않았다(신고 관리에
 * "처리 버튼이 없다"는 보고의 진짜 원인). 이 컴포넌트가 React state 로 열림/닫힘·
 * 바깥 클릭 닫기·뷰포트 하단 자동 위로펼침(.up)을 직접 처리한다.
 *
 * CSS 는 기존 `.row-actions / .action-menu / .action-menu.open / .action-menu.up`
 * 클래스를 그대로 재사용한다(data-display.css).
 */

export interface RowActionItem {
  /** 표시 라벨 */
  label: string;
  /** remixicon 클래스 (예: "ri-eye-line") */
  icon?: string;
  /** 클릭 핸들러 (button 으로 렌더) */
  onClick?: () => void;
  /** 링크 이동 (next/link 로 렌더). onClick 보다 우선. */
  href?: string;
  /** 위험(빨간) 강조 */
  danger?: boolean;
}

export function RowActionMenu({
  items,
  ariaLabel = "행 메뉴",
}: {
  items: RowActionItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 바깥 클릭 / Esc 닫기
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback((e: React.MouseEvent) => {
    // 행 전체 onClick(상세 이동) 등 상위 핸들러로 전파 방지
    e.stopPropagation();
    setOpen((prev) => {
      const next = !prev;
      if (next && buttonRef.current) {
        // 버튼 아래 공간이 부족하면 위로 펼침(뷰포트 밖 잘림 방지)
        const rect = buttonRef.current.getBoundingClientRect();
        setFlipUp(window.innerHeight - rect.bottom < 220);
      }
      return next;
    });
  }, []);

  return (
    <div
      className="row-actions"
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="icon-button row-action-button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <i className="ri-more-2-fill" />
      </button>
      <div className={`action-menu${open ? " open" : ""}${flipUp ? " up" : ""}`} role="menu">
        {items.map((item, i) =>
          item.href ? (
            <Link
              key={i}
              href={item.href}
              role="menuitem"
              className={item.danger ? "danger" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.icon && <i className={item.icon} />}
              {item.label}
            </Link>
          ) : (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={item.danger ? "danger" : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.icon && <i className={item.icon} />}
              {item.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
