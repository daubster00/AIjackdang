/* ===========================================================================
 * 토스트 알림
 *
 * createToaster() 를 호출하면 .toast-region 컨테이너를 찾거나(없으면 생성)
 * toast(title, description, type) 함수를 돌려준다.
 *   type: "success"(기본) | "error"
 *
 * 사용:
 *   import { createToaster } from ".../js/toast.js";
 *   const toast = createToaster();
 *   toast("저장됨", "변경 사항이 반영되었습니다.", "success");
 * =========================================================================== */

const ICONS = {
  success: "ri-checkbox-circle-fill",
  error: "ri-error-warning-fill",
};

export function createToaster(root = document) {
  let region = root.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }

  return function toast(title, description = "", type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
      <i class="${ICONS[type] || ICONS.success}"></i>
      <div class="toast-copy">
        <div class="toast-title"></div>
        <div class="toast-desc"></div>
      </div>
    `;
    // 사용자 입력 텍스트는 textContent 로 넣어 XSS 를 막는다
    el.querySelector(".toast-title").textContent = title;
    el.querySelector(".toast-desc").textContent = description;
    region.appendChild(el);

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 180);
    }, 2800);

    return el;
  };
}
