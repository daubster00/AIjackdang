"use client";

import { useEffect } from "react";
import { initAdminUI, initSelects, initTabs, initTables, initOverlay } from "@ai-jakdang/admin-design-system/js";

/**
 * 관리자 디자인 시스템의 공통 인터랙션을 클라이언트에서 1회 초기화한다.
 * (사이드바 접힘/모바일 메뉴, 커스텀 셀렉트, 모달/드로어, 토스트, 탭/세그먼트, 테이블 선택)
 * 시각/마크업은 서버 컴포넌트가 그리고, 이 컴포넌트는 동작만 연결한다.
 *
 * AC#5 (UX-DR-A11) 추가 구현:
 * - Esc 키로 모바일 사이드바 닫기
 * - 사이드바 열림 시 포커스 트랩(Tab 순환 — 모바일 off-canvas 상태)
 */
export function AdminInteractions() {
  useEffect(() => {
    initAdminUI();

    const refreshDynamicInteractions = () => {
      initSelects();
      initTabs();
      initTables();
      initOverlay();
    };

    const observer = new MutationObserver(() => {
      refreshDynamicInteractions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.querySelector(".mobile-backdrop");
    if (!sidebar) return;

    /** 사이드바가 모바일 열림 상태인지 확인 */
    const isMobileOpen = () => sidebar.classList.contains("mobile-open");

    /** 모바일 사이드바 닫기 */
    const closeSidebar = () => {
      sidebar.classList.remove("mobile-open");
      backdrop?.classList.remove("open");
    };

    /** Tab 순환을 위한 포커스 가능한 요소 목록 */
    const getFocusable = (): HTMLElement[] =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    /** 포커스 트랩 핸들러 — 사이드바 열림 시 Tab 키를 사이드바 내부로 가둔다 */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMobileOpen()) return;

      // Esc → 사이드바 닫기(UX-DR-A11)
      if (e.key === "Escape") {
        e.preventDefault();
        closeSidebar();
        return;
      }

      // Tab → 포커스 트랩
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          // Shift+Tab: 첫 요소에서 마지막으로 순환
          if (active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: 마지막 요소에서 첫 요소로 순환
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
