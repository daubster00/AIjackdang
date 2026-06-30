/* ===========================================================================
 * 탭 / 세그먼트 컨트롤
 *
 * .line-tabs > .line-tab[data-tab]   밑줄 탭
 * .segmented > .segment[data-range]  분할 컨트롤
 *
 * 항목 클릭 시 그룹 안에서 active 를 옮기고, 컨테이너에서 커스텀 이벤트를 발생시킨다.
 *   .line-tabs → 'admin:tab-change'      detail: { value: data-tab }
 *   .segmented → 'admin:segment-change'  detail: { value: data-range }
 * =========================================================================== */

function wireGroup(container, itemSelector, dataKey, eventName) {
  if (container.dataset.tabsInitialized === "true") return;
  container.dataset.tabsInitialized = "true";
  const items = container.querySelectorAll(itemSelector);
  items.forEach((item) => {
    item.addEventListener("click", () => {
      items.forEach((x) => x.classList.remove("active"));
      item.classList.add("active");
      container.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          detail: { value: item.dataset[dataKey] },
        })
      );
    });
  });
}

export function initTabs(root = document) {
  root.querySelectorAll(".line-tabs").forEach((tabs) => {
    // React가 제어하는 탭(.line-tab 에 data-tab 없음)은 건드리지 않는다.
    // 이런 탭은 React onClick 으로 동작하므로 레거시 JS가 불필요하고(value=undefined),
    // 컨테이너에 data-tabs-initialized 를 주입하면 SSR↔CSR hydration 불일치가 발생한다.
    if (!tabs.querySelector(".line-tab[data-tab]")) return;
    wireGroup(tabs, ".line-tab", "tab", "admin:tab-change");
  });
  root.querySelectorAll(".segmented").forEach((seg) => {
    // 세그먼트 컨트롤도 동일 — data-range 가 없으면 React 제어이므로 건너뛴다.
    if (!seg.querySelector(".segment[data-range]")) return;
    wireGroup(seg, ".segment", "range", "admin:segment-change");
  });
}
