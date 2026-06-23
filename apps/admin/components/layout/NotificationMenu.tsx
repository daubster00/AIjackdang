"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 상단바 알림 드롭다운 — 벨 버튼 클릭 시 최근 알림 목록 패널을 토글한다.
 *
 * [전역 핸들러 충돌 회피]
 * 디자인 시스템의 initAdminUI()(관리자 UI 전역 초기화 함수)는 document 전역 click 리스너로
 * closeAllActionMenus()(열린 .action-menu 의 open 클래스를 DOM 에서 직접 제거하는 함수)를 호출한다.
 * 따라서 .action-menu 클래스를 쓰면 벨 클릭이 document 까지 버블링되는 순간 패널이 즉시 닫힌다.
 * 이를 피하기 위해 (1) 벨 onClick 에서 e.stopPropagation()(이벤트 전파 중단)으로 여는 클릭이
 * document 에 닿지 않게 하고, (2) 패널은 .action-menu/.select-menu 클래스를 쓰지 않고
 * 자체 인라인 스타일(position/그림자 등)로만 위치·모양을 준다(전역 닫기 대상에서 제외).
 *
 * 동작은 클라이언트(useState/useEffect)에서만 처리하며, 백엔드 연동 없이 정적 더미 알림만 보여준다.
 */

/** 알림 1건의 형태. tone(아이콘 색상 계열), unread(안 읽음 여부)로 시각 강조를 결정한다. */
type AdminNotification = {
  id: string;
  icon: string; // remixicon 클래스명
  tone: "danger" | "primary" | "success" | "warning"; // 아이콘 배경 색상 계열
  title: string;
  body: string;
  time: string;
  unread: boolean; // true 면 안 읽음 점(unread dot) 표시
};

/** 정적 더미 알림 목록(신고/댓글/회원가입/시스템 등 관리자 맥락). */
const NOTIFICATIONS: AdminNotification[] = [
  {
    id: "n1",
    icon: "ri-alarm-warning-line",
    tone: "danger",
    title: "신고 접수",
    body: "‘자동화 사례’ 게시글이 스팸으로 신고되었습니다.",
    time: "2분 전",
    unread: true,
  },
  {
    id: "n2",
    icon: "ri-chat-3-line",
    tone: "primary",
    title: "새 댓글",
    body: "‘바이브코딩 팁’ 글에 새 댓글 3개가 달렸습니다.",
    time: "18분 전",
    unread: true,
  },
  {
    id: "n3",
    icon: "ri-user-add-line",
    tone: "success",
    title: "신규 가입",
    body: "오늘 신규 회원 12명이 가입했습니다.",
    time: "1시간 전",
    unread: true,
  },
  {
    id: "n4",
    icon: "ri-flag-line",
    tone: "warning",
    title: "후기 검토 요청",
    body: "실전자료 후기 2건이 검토 대기 중입니다.",
    time: "3시간 전",
    unread: false,
  },
  {
    id: "n5",
    icon: "ri-shield-check-line",
    tone: "primary",
    title: "시스템 알림",
    body: "정기 백업이 정상적으로 완료되었습니다.",
    time: "어제",
    unread: false,
  },
  {
    id: "n6",
    icon: "ri-copper-coin-line",
    tone: "success",
    title: "포인트 정산",
    body: "주간 포인트 정산이 완료되었습니다.",
    time: "어제",
    unread: false,
  },
];

/** tone(아이콘 색상 계열)별 배경/글자색 인라인 스타일을 돌려준다(디자인 시스템 CSS 변수 사용). */
function toneStyle(tone: AdminNotification["tone"]): { background: string; color: string } {
  switch (tone) {
    case "danger":
      return { background: "var(--danger-bg)", color: "var(--danger)" };
    case "success":
      return { background: "var(--success-bg)", color: "var(--success)" };
    case "warning":
      return { background: "var(--warning-bg)", color: "var(--warning)" };
    default:
      return { background: "var(--primary-50)", color: "var(--primary-600)" };
  }
}

export function NotificationMenu() {
  // open(드롭다운 열림 여부)
  const [open, setOpen] = useState(false);
  // wrapperRef(벨 버튼 + 패널을 감싸는 영역 참조) — 바깥 클릭 감지에 사용
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / Esc 키로 닫기
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

  // unreadCount(안 읽음 알림 개수) — 헤더 배지에 표기
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    // 래퍼는 패널 절대 위치 기준이 되도록 position:relative 만 가진다(.row-actions 의존 제거).
    <div style={{ position: "relative" }} ref={wrapperRef}>
      <button
        type="button"
        className="icon-button notification-dot"
        aria-label="알림"
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
        <i className="ri-notification-3-line" style={{ fontSize: 22 }} />
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
          width: 340,
          maxWidth: "calc(100vw - 32px)",
          border: "1px solid var(--gray-200)",
          borderRadius: 10,
          background: "var(--gray-0)",
          boxShadow: "var(--shadow-popover)",
          overflow: "hidden",
        }}
      >
        {/* 패널 헤더: 제목 + 안 읽음 개수 + 모두 읽음 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--gray-200)",
          }}
        >
          <strong style={{ fontSize: 14, color: "var(--gray-900)" }}>
            알림
            {unreadCount > 0 ? (
              <span className="nav-badge" style={{ marginLeft: 8 }}>
                {unreadCount}
              </span>
            ) : null}
          </strong>
          <button
            type="button"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--primary-600)",
              fontSize: 12,
              fontWeight: 650,
              cursor: "pointer",
              padding: 0,
              width: "auto",
              minHeight: 0,
            }}
          >
            모두 읽음
          </button>
        </div>

        {/* 알림 목록 */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {NOTIFICATIONS.map((n) => {
            const ts = toneStyle(n.tone);
            return (
              <a
                key={n.id}
                href="#"
                role="menuitem"
                style={{
                  display: "flex",
                  gap: 11,
                  padding: "11px 14px",
                  textDecoration: "none",
                  color: "inherit",
                  background: n.unread ? "var(--primary-50)" : "transparent",
                  borderBottom: "1px solid var(--gray-100)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    ...ts,
                  }}
                >
                  <i className={n.icon} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 650,
                      color: "var(--gray-900)",
                    }}
                  >
                    {n.title}
                    {n.unread ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: "var(--danger)",
                          flex: "0 0 auto",
                        }}
                      />
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "var(--gray-600)",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {n.body}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--gray-400)", marginTop: 3 }}>
                    {n.time}
                  </span>
                </span>
              </a>
            );
          })}
        </div>

        {/* 하단: 전체보기 링크 */}
        <a
          href="/notifications"
          style={{
            display: "block",
            textAlign: "center",
            padding: "11px 14px",
            fontSize: 13,
            fontWeight: 650,
            color: "var(--primary-600)",
            textDecoration: "none",
            borderTop: "1px solid var(--gray-200)",
          }}
        >
          알림 전체보기
        </a>
      </div>
      ) : null}
    </div>
  );
}
