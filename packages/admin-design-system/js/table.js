/* ===========================================================================
 * 데이터 테이블: 행 선택(전체/개별) + 행 액션 메뉴
 *
 * 마크업 규약:
 *   <table class="admin-table">
 *     <thead>... <input class="check" data-admin-select-all type="checkbox"> ...</thead>
 *     <tbody>
 *       <tr>
 *         <td><input class="check row-check" type="checkbox"></td>
 *         ...
 *         <td>
 *           <div class="row-actions">
 *             <button class="icon-button row-action-button"><i class="ri-more-2-fill"></i></button>
 *             <div class="action-menu"> ...버튼들... </div>
 *           </div>
 *         </td>
 *       </tr>
 *     </tbody>
 *   </table>
 *
 * - 전체선택 체크박스는 현재 "보이는" 행 기준으로 동기화(indeterminate 포함).
 * - 선택이 바뀌면 테이블에서 'admin:selection-change'(detail: { count, rows }) 발생.
 * - [data-admin-requires-selection] 요소는 선택이 0개면 자동 disabled.
 * - .row-action-button 클릭 시 인접 .action-menu 토글(다른 메뉴는 닫힘).
 * =========================================================================== */

export function closeAllActionMenus(root = document) {
  root.querySelectorAll(".action-menu.open").forEach((m) => m.classList.remove("open"));
}

function visibleRows(tbody) {
  return [...tbody.querySelectorAll("tr")].filter((row) => row.style.display !== "none");
}

export function initTables(root = document) {
  root.querySelectorAll(".admin-table").forEach((table) => {
    if (table.dataset.tableInitialized === "true") {
      table._adminSyncSelection?.();
      return;
    }
    table.dataset.tableInitialized = "true";
    const tbody = table.querySelector("tbody");
    const selectAll = table.querySelector("[data-admin-select-all]");
    if (!tbody) return;

    const requiresSelection = root.querySelectorAll("[data-admin-requires-selection]");

    function sync() {
      const rows = visibleRows(tbody);
      const checks = rows.map((row) => row.querySelector(".row-check")).filter(Boolean);
      const checked = checks.filter((c) => c.checked);

      rows.forEach((row) => {
        const c = row.querySelector(".row-check");
        row.classList.toggle("selected", !!c && c.checked);
      });

      if (selectAll) {
        selectAll.checked = checks.length > 0 && checked.length === checks.length;
        selectAll.indeterminate = checked.length > 0 && checked.length < checks.length;
      }

      requiresSelection.forEach((el) => {
        el.disabled = checked.length === 0;
      });

      table.dispatchEvent(
        new CustomEvent("admin:selection-change", {
          bubbles: true,
          detail: { count: checked.length, rows: checked.map((c) => c.closest("tr")) },
        })
      );
    }

    selectAll?.addEventListener("change", () => {
      visibleRows(tbody).forEach((row) => {
        const c = row.querySelector(".row-check");
        if (c) c.checked = selectAll.checked;
      });
      sync();
    });

    tbody.querySelectorAll(".row-check").forEach((c) => c.addEventListener("change", sync));

    // 행 액션 메뉴 — 이벤트 위임으로 테이블에 1회만 바인딩한다.
    // (per-button 바인딩은 initTables 가 tableInitialized 가드로 1회만 도므로,
    //  데이터가 비동기로 늦게 채워지는 표에서는 새 행 버튼에 핸들러가 안 붙는다.)
    table.addEventListener("click", (event) => {
      const btn = event.target.closest?.(".row-action-button");
      if (!btn || !table.contains(btn)) return;
      // React 가 직접 열고닫는 메뉴(data-menu-manual)는 table.js 가 손대지 않는다
      if (btn.dataset.menuManual === "true") return;
      const menu = btn.nextElementSibling;
      if (!menu?.classList.contains("action-menu")) return;
      event.stopPropagation();
      const wasOpen = menu.classList.contains("open");
      closeAllActionMenus(root);
      if (wasOpen) return; // 토글: 열려 있던 메뉴는 닫기만
      menu.classList.add("open");
      // 아래 공간이 부족하면(뷰포트 하단 행) 위로 펼친다 — 화면 밖으로 잘리지 않도록(new#3)
      menu.classList.remove("up");
      const spaceBelow = window.innerHeight - btn.getBoundingClientRect().bottom;
      if (spaceBelow < menu.offsetHeight + 12) menu.classList.add("up");
    });

    // 외부에서 다시 호출할 수 있도록 동기화 함수 노출
    table._adminSyncSelection = sync;
  });
}
