"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 상단바 도움말(?) 드롭다운 — 물음표 버튼 클릭 시 도움말 항목 패널을 토글한다.
 *
 * [전역 핸들러 충돌 회피]
 * 디자인 시스템의 initAdminUI()(관리자 UI 전역 초기화 함수)는 document 전역 click 리스너로
 * closeAllActionMenus()(열린 .action-menu 의 open 클래스를 직접 제거하는 함수)를 호출한다.
 * 그래서 .action-menu/.select-menu 클래스를 쓰면 여는 클릭이 document 로 버블링되는 즉시 패널이 닫힌다.
 * 이를 피하려고 NotificationMenu 와 동일한 안전 패턴을 쓴다:
 * (1) 버튼 onClick 에서 e.stopPropagation()(이벤트 전파 중단)으로 여는 클릭을 document 에 안 보내고,
 * (2) 패널은 디자인 시스템 드롭다운 클래스를 쓰지 않고 자체 인라인 스타일로만 위치·모양을 준다.
 *
 * 백엔드 연동 없이 정적 더미 도움말 항목만 보여준다(디자인 토큰만 사용).
 */

/** 도움말 항목 1개. icon(remixicon 클래스명), label(항목 이름), hint(우측 보조 텍스트, 선택). */
type HelpItem = {
  id: string;
  icon: string; // remixicon 클래스명
  label: string;
  hint?: string; // 우측 보조 텍스트(단축키 등), 없으면 미표시
  href: string;
};

/** 정적 더미 도움말 목록(단축키/매뉴얼/FAQ/고객센터). */
const HELP_ITEMS: HelpItem[] = [
  {
    id: "shortcut",
    icon: "ri-keyboard-line",
    label: "단축키 안내",
    hint: "Ctrl K",
    href: "#",
  },
  {
    id: "manual",
    icon: "ri-book-2-line",
    label: "관리자 매뉴얼",
    href: "#",
  },
  {
    id: "faq",
    icon: "ri-question-answer-line",
    label: "자주 묻는 질문",
    href: "#",
  },
  {
    id: "support",
    icon: "ri-customer-service-2-line",
    label: "고객센터 문의",
    href: "#",
  },
];

/** 앱 버전 표기(더미). */
const APP_VERSION = "v1.0.0";

export function HelpMenu() {
  // open(드롭다운 열림 여부)
  const [open, setOpen] = useState(false);
  // wrapperRef(버튼 + 패널을 감싸는 영역 참조) — 바깥 클릭 감지에 사용
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭(mousedown) / Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    // 래퍼는 패널 절대 위치 기준이 되도록 position:relative 만 가진다.
    <div style={{ position: "relative" }} ref={wrapperRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="도움말"
        aria-haspopup="true"
        aria-expanded={open}
        // 상단바 아이콘 크게: 버튼 40x40 + 아이콘 22px
        style={{ width: 40, height: 40 }}
        // e.stopPropagation()(전파 중단): 여는 클릭이 document 전역 닫기 핸들러까지 안 가게 한다.
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <i className="ri-question-line" style={{ fontSize: 22 }} />
      </button>

      {open ? (
        <div
          role="menu"
          // 패널 내부 클릭이 document 로 버블링돼 닫히지 않게 전파를 막는다.
          onClick={(e) => e.stopPropagation()}
          // .action-menu/.select-menu 클래스 대신 자체 인라인 스타일로 위치/모양을 준다(전역 닫기 대상 제외).
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            width: 260,
            maxWidth: "calc(100vw - 32px)",
            border: "1px solid var(--gray-200)",
            borderRadius: 10,
            background: "var(--gray-0)",
            boxShadow: "var(--shadow-popover)",
            overflow: "hidden",
          }}
        >
          {/* 패널 헤더: 제목 */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--gray-200)",
            }}
          >
            <strong style={{ fontSize: 14, color: "var(--gray-900)" }}>도움말</strong>
          </div>

          {/* 도움말 항목 목록 */}
          <div>
            {HELP_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  textDecoration: "none",
                  color: "var(--gray-900)",
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: "1px solid var(--gray-100)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    background: "var(--primary-50)",
                    color: "var(--primary-600)",
                  }}
                >
                  <i className={item.icon} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                {item.hint ? (
                  <span
                    className="search-shortcut"
                    style={{ flex: "0 0 auto" }}
                  >
                    {item.hint}
                  </span>
                ) : null}
              </a>
            ))}
          </div>

          {/* 하단: 버전 정보 */}
          <div
            style={{
              padding: "10px 14px",
              textAlign: "center",
              fontSize: 11,
              color: "var(--gray-400)",
              borderTop: "1px solid var(--gray-200)",
            }}
          >
            AI작당 Admin {APP_VERSION}
          </div>
        </div>
      ) : null}
    </div>
  );
}
