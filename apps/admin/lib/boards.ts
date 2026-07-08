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
 * ⚠️ 이 목록은 웹 사이트 대메뉴(apps/web SiteHeader) 구성과 1:1 로 일치해야 한다.
 *    사이드바(AdminShell)·봇 담당 게시판(BotActivitySection)·게시글 필터(posts/page)가
 *    모두 이 배열을 그대로 순회하므로, 여기서 빠지면 그 게시판은 관리자·봇에서 사라진다.
 *
 * group: 웹 대메뉴 라벨(바이브 코딩 / AI 자동화 / AI 수익화 / 작당 라운지).
 * apiBoard: DB의 posts.board 컬럼에 실제로 저장된 값(= packages/contracts BOARDS 키).
 *   웹 board 식별자와 관리자 URL slug 이 다를 때 지정. 미지정 시 slug 와 동일하게 취급.
 *   API 필터는 posts.board 와 정확히 일치(eq)를 요구하므로 이 값이 정확해야 조회된다.
 *
 * 웹 대메뉴 매핑 (apps/web/components/site/SiteHeader.tsx 기준):
 *   AI 수익화 · "외주·판매 팁"  = monetization-tips
 *   AI 수익화 · "수익화 사례"    = monetization-cases
 *   작당 라운지 · "작당 수다방"  = talk
 *   작당 라운지 · "작당 의뢰소"  = gigs
 */
export const BOARDS: Board[] = [
  // slug(admin URL) → apiBoard(DB posts.board 실제값)
  // ── 바이브 코딩 ───────────────────────────────────────────────────────────────
  { slug: "vibe-guide",    label: "바이브코딩 가이드",   badge: "badge-blue",   group: "바이브 코딩", apiBoard: "vibe-coding-guide" },
  { slug: "vibe-tip",      label: "바이브코딩 팁",       badge: "badge-blue",   group: "바이브 코딩", apiBoard: "vibe-coding-tips" },
  // ── AI 자동화 ─────────────────────────────────────────────────────────────────
  { slug: "auto-guide",    label: "자동화 가이드",       badge: "badge-purple", group: "AI 자동화",   apiBoard: "automation-guide" },
  { slug: "auto-case",     label: "자동화 사례",         badge: "badge-purple", group: "AI 자동화",   apiBoard: "automation-cases" },
  { slug: "auto-tip",      label: "자동화 팁",           badge: "badge-cyan",   group: "AI 자동화",   apiBoard: "automation-tips" },
  // ── AI 수익화 ─────────────────────────────────────────────────────────────────
  { slug: "outsource-tip", label: "외주·판매 팁",        badge: "badge-cyan",   group: "AI 수익화",   apiBoard: "monetization-tips" },
  { slug: "money-case",    label: "수익화 사례",         badge: "badge-orange", group: "AI 수익화",   apiBoard: "monetization-cases" },
  // ── 작당 라운지 (웹 대메뉴 하위 5개) ──────────────────────────────────────────────
  // URL slug 은 복수형 'notices', DB/API board 값은 단수형 'notice'.
  { slug: "notices",       label: "공지사항",            badge: "badge-red",    group: "작당 라운지", apiBoard: "notice" },
  { slug: "ai-art",        label: "AI 창작마당",         badge: "badge-purple", group: "작당 라운지", apiBoard: "ai-creation" },
  { slug: "ai-product",    label: "내가 만든 AI 제품",   badge: "badge-blue",   group: "작당 라운지", apiBoard: "ai-products" },
  // DB posts.board 값 'talk'. 봇·일반 회원 자유글이 저장되는 게시판. slug === apiBoard 라 생략.
  { slug: "talk",          label: "작당 수다방",          badge: "badge-green",  group: "작당 라운지" },
  // 구인구직/의뢰. DB posts.board 값 'gigs'. slug === apiBoard 라 생략.
  { slug: "gigs",          label: "작당 의뢰소",          badge: "badge-cyan",   group: "작당 라운지" },
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
 * 예: "vibe-coding-guide" → "vibe-guide", "monetization-tips" → "outsource-tip",
 *     "notice" → "notices", "gigs" → "gigs", "talk" → "talk" (매핑 없음 → 원값)
 */
export function dbBoardToAdminSlug(dbBoard: string): string {
  const b = BOARDS.find((board) => (board.apiBoard ?? board.slug) === dbBoard);
  return b?.slug ?? dbBoard;
}
