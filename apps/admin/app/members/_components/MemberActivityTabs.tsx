"use client";

import { useEffect } from "react";

/**
 * 회원 상세 페이지의 활동내역 탭 패널 전환 컨트롤러(클라이언트 전용, 렌더 출력 없음).
 *
 * SettingsTabPanels 와 동일한 패턴:
 * 디자인 시스템 .line-tabs 가 클릭 시 'admin:tab-change'(detail.value = data-tab) 이벤트를 발행하면,
 * 이 컴포넌트가 수신해 같은 data-tab-panel 패널만 표시하고 나머지를 숨긴다.
 */
export function MemberActivityTabs() {
  useEffect(() => {
    // panels(활동내역 탭 패널 목록) — data-tab-panel 속성으로 탭 키와 매칭됨
    const container = document.getElementById("member-activity-tabs");
    if (!container) return;

    const panels = Array.from(
      container.querySelectorAll<HTMLElement>("[data-tab-panel]")
    );
    if (panels.length === 0) return;

    // show(value): value 와 같은 패널만 표시하고 나머지는 숨긴다
    const show = (value: string) => {
      panels.forEach((p) => {
        p.style.display = p.dataset.tabPanel === value ? "" : "none";
      });
    };

    // 초기 표시: active 탭 기준, 없으면 첫 번째 패널
    const activeTab = container.querySelector<HTMLElement>(".line-tabs .line-tab.active");
    show(activeTab?.dataset.tab ?? panels[0]?.dataset.tabPanel ?? "");

    // 'admin:tab-change'(탭 변경 이벤트) 수신 → 해당 패널만 노출
    const onTabChange = (e: Event) => {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      if (value) show(value);
    };
    document.addEventListener("admin:tab-change", onTabChange as EventListener);
    return () => document.removeEventListener("admin:tab-change", onTabChange as EventListener);
  }, []);

  return null;
}
