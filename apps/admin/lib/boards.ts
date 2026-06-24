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

/** 전체 게시판 목록(더미가 아닌 실제 게시판 구성). 라우트는 /posts/{slug}. */
export const BOARDS: Board[] = [
  { slug: "vibe-guide", label: "바이브코딩 가이드", badge: "badge-blue", group: "바이브코딩" },
  { slug: "vibe-tip", label: "바이브코딩 팁", badge: "badge-blue", group: "바이브코딩" },
  { slug: "auto-guide", label: "자동화 가이드", badge: "badge-purple", group: "자동화" },
  { slug: "auto-case", label: "자동화 사례", badge: "badge-purple", group: "자동화" },
  { slug: "auto-tip", label: "자동화 팁", badge: "badge-cyan", group: "자동화" },
  { slug: "outsource-tip", label: "외주·판매 팁", badge: "badge-cyan", group: "외주·판매" },
  { slug: "money-case", label: "수익화 사례", badge: "badge-orange", group: "수익화" },
  { slug: "ai-art", label: "AI 창작마당", badge: "badge-purple", group: "창작" },
  { slug: "ai-product", label: "내가 만든 AI 제품", badge: "badge-blue", group: "AI 제품" },
  // ── 공지 관리 (Story 9.17) ────────────────────────────────────────────────────
  // URL slug 은 복수형 'notices', DB/API board 값은 단수형 'notice'.
  { slug: "notices", label: "공지사항", badge: "badge-red", group: "공지", apiBoard: "notice" },
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
