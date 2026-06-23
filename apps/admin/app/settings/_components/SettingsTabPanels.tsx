"use client";

import { useEffect } from "react";

/**
 * 사이트 설정 탭 패널 전환 컨트롤러(클라이언트 전용, 렌더 출력 없음).
 *
 * 디자인 시스템의 .line-tabs JS 는 탭 클릭 시 active 클래스만 옮기고
 * 'admin:tab-change'(detail.value = data-tab) 이벤트만 쏠 뿐, 패널을 숨기지 않는다.
 * 그래서 4개 [data-tab-panel] 섹션이 한 화면에 모두 쌓여 보였다.
 *
 * 이 컴포넌트는 그 이벤트를 받아, value(선택된 탭 키)와 같은 data-tab-panel 섹션만 보이고
 * 나머지는 숨기도록 display 를 토글한다(탭별 기능을 따로 노출).
 */
export function SettingsTabPanels() {
  useEffect(() => {
    // panels(탭 패널 섹션 목록) — data-tab-panel 속성으로 탭 키와 매칭된다.
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-tab-panel]"));
    if (panels.length === 0) return;

    // show(value): value 와 같은 패널만 표시하고 나머지는 숨긴다.
    const show = (value: string) => {
      panels.forEach((p) => {
        p.style.display = p.dataset.tabPanel === value ? "" : "none";
      });
    };

    // 초기 표시: 현재 active 인 탭(.line-tab.active) 기준, 없으면 첫 패널.
    const activeTab = document.querySelector<HTMLElement>(".line-tabs .line-tab.active");
    show(activeTab?.dataset.tab ?? panels[0]?.dataset.tabPanel ?? "");

    // 탭 변경 이벤트 수신 → 해당 패널만 노출
    const onTabChange = (e: Event) => {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      if (value) show(value);
    };
    document.addEventListener("admin:tab-change", onTabChange as EventListener);
    return () => document.removeEventListener("admin:tab-change", onTabChange as EventListener);
  }, []);

  return null;
}
