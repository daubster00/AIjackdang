/* ===========================================================================
 * 사이드바: 데스크톱 접힘 토글 · 모바일 열기/닫기 · 메뉴 active 전환
 *
 * 마크업 규약 (클래스/데이터 속성 기반 → 어떤 프로젝트에서도 동작):
 *   .app-shell                      셸 루트 (접힘 클래스가 여기 붙는다)
 *   .sidebar                        사이드바
 *   [data-admin-sidebar-toggle]     접기/펼치기 버튼 (보통 사이드바 헤더)
 *   [data-admin-mobile-menu]        모바일 햄버거 버튼 (상단바)
 *   .mobile-backdrop                모바일 뒷배경
 *   .nav-item                       메뉴 항목 (클릭 시 active 전환)
 *
 * 접힘 버튼 안에 <i> 가 있으면 아이콘 클래스를 자동 전환한다.
 * =========================================================================== */

const MOBILE_QUERY = "(max-width: 980px)";

export function initSidebar(root = document) {
  const shell = root.querySelector(".app-shell");
  const sidebar = root.querySelector(".sidebar");
  if (!shell || !sidebar) return;

  const toggle = root.querySelector("[data-admin-sidebar-toggle]");
  const mobileMenu = root.querySelector("[data-admin-mobile-menu]");
  const backdrop = root.querySelector(".mobile-backdrop");

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  const closeMobile = () => {
    sidebar.classList.remove("mobile-open");
    backdrop?.classList.remove("open");
  };

  toggle?.addEventListener("click", () => {
    if (isMobile()) {
      closeMobile();
      return;
    }
    shell.classList.toggle("sidebar-collapsed");
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = shell.classList.contains("sidebar-collapsed")
        ? "ri-expand-right-line"
        : "ri-contract-left-line";
    }
  });

  mobileMenu?.addEventListener("click", () => {
    sidebar.classList.add("mobile-open");
    backdrop?.classList.add("open");
  });

  backdrop?.addEventListener("click", closeMobile);

  root.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      root.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
      item.classList.add("active");
      if (isMobile()) closeMobile();
    });
  });
}
