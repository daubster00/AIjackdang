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

export function initSelects(root = document) {
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
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");

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
