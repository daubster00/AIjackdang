/* ===========================================================================
 * 오버레이 컨트롤: 모달 / 드로어 열고 닫기
 *
 * 마크업 규약:
 *   .overlay                         공통 뒷배경 (한 개)
 *   [data-admin-open="modalId"]      클릭 시 해당 id 요소를 연다 (.modal 또는 .drawer)
 *   .close-overlay                   클릭 시 열린 오버레이를 모두 닫는다
 *
 * 동작:
 *   - 여는 대상에 .open 을 붙이고 .overlay 에도 .open 을 붙인다
 *   - Esc, 뒷배경 클릭, .close-overlay 클릭으로 닫는다
 *   - 모달이 열리면 내부 첫 입력요소에 포커스
 *
 * 프로그램적으로도 제어할 수 있도록 open/close 함수를 반환한다.
 * =========================================================================== */

export function initOverlay(root = document) {
  const overlay = root.querySelector(".overlay");

  function open(target) {
    const el = typeof target === "string" ? root.getElementById?.(target) ?? document.getElementById(target) : target;
    if (!el) return;
    overlay?.classList.add("open");
    el.classList.add("open");
    if (el.classList.contains("modal")) {
      const focusable = el.querySelector("input, textarea, select, button:not(.close-overlay)");
      setTimeout(() => focusable?.focus(), 50);
    }
  }

  function closeAll() {
    overlay?.classList.remove("open");
    root.querySelectorAll(".modal.open, .drawer.open").forEach((el) => el.classList.remove("open"));
  }

  root.querySelectorAll("[data-admin-open]").forEach((btn) => {
    if (btn.dataset.overlayOpenInitialized === "true") return;
    btn.dataset.overlayOpenInitialized = "true";
    btn.addEventListener("click", () => open(btn.dataset.adminOpen));
  });

  root.querySelectorAll(".close-overlay").forEach((btn) => {
    if (btn.dataset.overlayCloseInitialized === "true") return;
    btn.dataset.overlayCloseInitialized = "true";
    btn.addEventListener("click", closeAll);
  });

  if (overlay && overlay.dataset.overlayInitialized !== "true") {
    overlay.dataset.overlayInitialized = "true";
    overlay.addEventListener("click", closeAll);
  }

  if (document.documentElement.dataset.overlayKeydownInitialized !== "true") {
    document.documentElement.dataset.overlayKeydownInitialized = "true";
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAll();
    });
  }

  return { open, closeAll };
}
