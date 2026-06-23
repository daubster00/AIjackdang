/* ===========================================================================
 * AI작당 관리자 디자인 시스템 — JS 진입점
 *
 * initAdminUI() 한 번 호출로 모든 공통 인터랙션을 연결한다:
 *   사이드바 · 커스텀 셀렉트 · 모달/드로어 · 토스트 · 탭/세그먼트 · 태그입력 · 테이블
 * 그리고 바깥 클릭 시 열린 셀렉트/액션 메뉴를 닫는 전역 핸들러를 건다.
 *
 * 사용 (순수 HTML / 번들러 공통):
 *   import { initAdminUI } from "@ai-jakdang/admin-design-system/js";
 *   const ui = initAdminUI();
 *   ui.toast("저장됨", "변경 사항이 반영되었습니다.");
 *   ui.overlay.open("modal");
 *
 * 차트는 선택적으로 따로 가져온다:
 *   import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
 *
 * React/Vue 등에서는 개별 모듈만 골라 쓰거나, 컴포넌트가 마운트된 뒤 호출한다.
 * =========================================================================== */

import { initSidebar } from "./sidebar.js";
import { initSelects, closeAllSelects } from "./select.js";
import { initOverlay } from "./overlay.js";
import { createToaster } from "./toast.js";
import { initTabs } from "./tabs.js";
import { initTagInputs } from "./tag-input.js";
import { initTables, closeAllActionMenus } from "./table.js";

export { initSidebar } from "./sidebar.js";
export { initSelects, closeAllSelects } from "./select.js";
export { initOverlay } from "./overlay.js";
export { createToaster } from "./toast.js";
export { initTabs } from "./tabs.js";
export { initTagInputs } from "./tag-input.js";
export { initTables, closeAllActionMenus } from "./table.js";
export { createLineChart } from "./chart.js";

export function initAdminUI(root = document) {
  initSidebar(root);
  initSelects(root);
  const overlay = initOverlay(root);
  const toast = createToaster(root);
  initTabs(root);
  initTagInputs(root);
  initTables(root);

  // 바깥 클릭 → 열린 셀렉트/액션 메뉴 닫기
  document.addEventListener("click", () => {
    closeAllSelects(root);
    closeAllActionMenus(root);
  });

  return { overlay, toast };
}
