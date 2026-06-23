/* ===========================================================================
 * 태그 입력 (.tag-input)
 *
 * 마크업 규약:
 *   <div class="tag-input">
 *     <span class="tag">기존태그<button aria-label="태그 삭제"><i class="ri-close-line"></i></button></span>
 *     <input type="text" placeholder="태그 입력 후 Enter" />
 *   </div>
 *
 * 입력 후 Enter → 태그 추가, 태그의 버튼 클릭 → 삭제.
 * =========================================================================== */

function attachRemove(tag) {
  tag.querySelector("button")?.addEventListener("click", () => tag.remove());
}

export function initTagInputs(root = document) {
  root.querySelectorAll(".tag-input").forEach((wrap) => {
    const input = wrap.querySelector("input");
    if (!input) return;

    // 초기 렌더된 태그에도 삭제 동작 연결
    wrap.querySelectorAll(".tag").forEach(attachRemove);

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value; // 사용자 입력은 textContent 로 (XSS 방지)
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", "태그 삭제");
      btn.innerHTML = '<i class="ri-close-line"></i>';
      tag.appendChild(btn);
      attachRemove(tag);

      input.before(tag);
      input.value = "";
    });
  });
}
