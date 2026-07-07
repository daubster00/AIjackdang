/**
 * 게시판 공통 상수.
 * 관리자 사이드바 서브메뉴(AdminShell)와 게시글 관리 페이지(app/posts/**)가 함께 참조한다.
 * AI작당의 실제 게시판 구성(바이브코딩/자동화/외주·판매/수익화/창작/AI제품)을 반영한다.
 */

/**
 * 게시판 1개 정의.
 * slug(게시판을 URL에서 식별하는 영문 키), label(화면 표기 이름),
 * badge(게시판 색상 배지 클래스명), group(상위 대메뉴 묶음 라벨).
 * apiBoard(API로 전달하는 board 파라미터) — 생략 시 slug 와 동일하게 취급.
 *   예: URL slug 'notices'(복수) → API board 'notice'(단수) 매핑.
 */
export type Board = {
  slug: string;
  label: string;
  badge: string;
  group: string;
  /** API로 전달하는 board 쿼리 파라미터. 미지정 시 slug 와 동일. */
  apiBoard?: string;
};

/**
 * 전체 게시판 목록(더미가 아닌 실제 게시판 구성). 라우트는 /posts/{slug}.
 *
 * apiBoard: DB의 posts.board 컬럼에 실제로 저장된 값.
 *   웹 앱이 사용하는 board 식별자와 관리자 URL slug 이 다를 경우 이 값을 지정한다.
 *   미지정 시 slug 와 동일하게 취급.
 *
 * DB 실측값 (2026-06-26):
 *   ai-creation, ai-products, automation-guide, gigs,
 *   monetization-tips, notice, talk, vibe-coding-guide
 */
export const BOARDS: Board[] = [
  // slug(admin URL) → apiBoard(DB posts.board 실제값)
  { slug: "vibe-guide",    label: "바이브코딩 가이드",   badge: "badge-blue",   group: "바이브코딩", apiBoard: "vibe-coding-guide" },
  { slug: "vibe-tip",      label: "바이브코딩 팁",       badge: "badge-blue",   group: "바이브코딩" },
  { slug: "auto-guide",    label: "자동화 가이드",       badge: "badge-purple", group: "자동화",    apiBoard: "automation-guide" },
  { slug: "auto-case",     label: "자동화 사례",         badge: "badge-purple", group: "자동화" },
  { slug: "auto-tip",      label: "자동화 팁",           badge: "badge-cyan",   group: "자동화" },
  { slug: "outsource-tip", label: "외주·판매 팁",        badge: "badge-cyan",   group: "외주·판매", apiBoard: "gigs" },
  { slug: "money-case",    label: "수익화 사례",         badge: "badge-orange", group: "수익화",    apiBoard: "monetization-tips" },
  { slug: "ai-art",        label: "AI 창작마당",         badge: "badge-purple", group: "창작",      apiBoard: "ai-creation" },
  { slug: "ai-product",    label: "내가 만든 AI 제품",   badge: "badge-blue",   group: "AI 제품",   apiBoard: "ai-products" },
  // ── 커뮤니티 (라운지) ─────────────────────────────────────────────────────────
  // DB posts.board 값 'talk'. 봇(냉장고털이 등)·일반 회원 자유글이 저장되는 게시판.
  // slug === apiBoard('talk')이라 apiBoard 생략. 누락 시 /posts/talk 목록이 notFound()로 404.
  { slug: "talk",          label: "작당 라운지",          badge: "badge-green",  group: "커뮤니티" },
  // ── 공지 관리 (Story 9.17) ────────────────────────────────────────────────────
  // URL slug 은 복수형 'notices', DB/API board 값은 단수형 'notice'.
  { slug: "notices",       label: "공지사항",            badge: "badge-red",    group: "공지",      apiBoard: "notice" },
];

/** slug(게시판 영문 키)로 게시판 정의를 찾는다. 없으면 undefined. */
export function findBoard(slug: string): Board | undefined {
  return BOARDS.find((b) => b.slug === slug);
}

/**
 * slug 로 API 에 전달할 board 파라미터를 반환한다.
 * apiBoard 가 지정된 경우(예: notices → notice) 해당 값을, 아니면 slug 를 그대로 사용.
 */
export function boardApiParam(slug: string): string {
  const b = findBoard(slug);
  return b?.apiBoard ?? slug;
}

/**
 * DB の posts.board 값(apiBoard)을 관리자 URL slug 로 역변환한다 (G4/N4 fix).
 * apiBoard 필드가 지정된 board 중 일치하는 것을 찾아 slug 를 반환하고,
 * 없으면 DB 값 그대로 반환한다 (slug === apiBoard 인 경우).
 *
 * 예: "vibe-coding-guide" → "vibe-guide", "gigs" → "outsource-tip",
 *     "notice" → "notices", "talk" → "talk" (매핑 없음 → 원값)
 */
export function dbBoardToAdminSlug(dbBoard: string): string {
  const b = BOARDS.find((board) => (board.apiBoard ?? board.slug) === dbBoard);
  return b?.slug ?? dbBoard;
}
