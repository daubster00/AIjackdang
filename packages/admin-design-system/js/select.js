/* ===========================================================================
 * 커스텀 셀렉트 (.custom-select)
 *
 * 마크업 규약:
 *   <div class="custom-select" data-select="status">
 *     <button class="select-trigger" aria-expanded="false">
 *       <span>상태: 전체</span><i class="ri-arrow-down-s-line"></i>
 *     </button>
 *     <div class="select-menu">
 *       <button class="select-option selected" data-value="all">상태: 전체<i class="ri-check-line"></i></button>
 *       <button class="select-option" data-value="public">공개</button>
 *     </div>
 *   </div>
 *
 * 값이 바뀌면 .custom-select 에서 'admin:select-change' 커스텀 이벤트를 발생시킨다.
 *   detail: { name: data-select 값, value: 선택된 data-value, label: 표시 텍스트 }
 * =========================================================================== */

export function closeAllSelects(root = document) {
  root.querySelectorAll(".select-menu.open").forEach((menu) => {
    menu.classList.remove("open");
    menu.parentElement
      ?.querySelector(".select-trigger")
      ?.setAttribute("aria-expanded", "false");
  });
}

/**
 * @param {Document|HTMLElement} root
 * @param {{ reactSafe?: boolean }} [options]
 *   reactSafe=true 면 메뉴 열기/닫기(.open 토글)만 연결하고,
 *   선택표시(.selected)·체크아이콘·트리거 라벨 텍스트·admin:select-change 이벤트 등
 *   "DOM 내용을 바꾸는" 동작은 모두 건너뛴다.
 *   → 관리자 앱(React)은 이 표시들을 React 가 직접 렌더하므로, 레거시 JS 가 같은 노드를
 *     직접 지우거나(insertAdjacentHTML/remove) 텍스트를 바꾸면 React 재조정과 충돌해
 *     "Failed to execute 'removeChild' on 'Node'" (NotFoundError) 크래시가 난다(묻고답하기 검색 sort 에러).
 *   순수 HTML 데모(demo/index.html)는 옵션 없이 호출 → 기존 전체 동작 유지.
 */
export function initSelects(root = document, options = {}) {
  const reactSafe = options.reactSafe === true;
  root.querySelectorAll(".custom-select").forEach((select) => {
    if (select.dataset.selectInitialized === "true") return;
    const trigger = select.querySelector(".select-trigger");
    const menu = select.querySelector(".select-menu");
    if (!trigger || !menu) return;
    select.dataset.selectInitialized = "true";
    const name = select.dataset.select;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      // 다른 열린 셀렉트는 닫는다
      root.querySelectorAll(".select-menu.open").forEach((openMenu) => {
        if (openMenu !== menu) {
          openMenu.classList.remove("open");
          openMenu.parentElement
            ?.querySelector(".select-trigger")
            ?.setAttribute("aria-expanded", "false");
        }
      });
      const open = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(open));
    });

    select.querySelectorAll(".select-option").forEach((option) => {
      option.addEventListener("click", () => {
        // 메뉴 닫기는 양쪽 모드 공통(레거시 .open 클래스만 토글 — DOM 구조 불변)
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");

        // React 제어 셀렉트에서는 아래 DOM 변형을 React 가 담당하므로 건너뛴다(충돌 방지).
        if (reactSafe) return;

        select.querySelectorAll(".select-option").forEach((x) => {
          x.classList.remove("selected");
          x.querySelector(".ri-check-line")?.remove();
        });
        option.classList.add("selected");
        if (!option.querySelector(".ri-check-line")) {
          option.insertAdjacentHTML("beforeend", '<i class="ri-check-line"></i>');
        }
        const label = option.textContent.trim();
        const triggerLabel = trigger.querySelector("span");
        if (triggerLabel) triggerLabel.textContent = label;

        select.dispatchEvent(
          new CustomEvent("admin:select-change", {
            bubbles: true,
            detail: { name, value: option.dataset.value, label },
          })
        );
      });
    });
  });
}
