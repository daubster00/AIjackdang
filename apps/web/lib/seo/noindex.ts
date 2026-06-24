/**
 * noindex 판정 중앙 함수
 *
 * 저품질·인증 전용 페이지를 검색엔진 색인에서 제외하기 위한 단일 진입점.
 * 각 페이지 generateMetadata는 이 함수를 호출하고 결과에 따라 robots 필드를 삽입한다.
 * 조건 판정 코드를 페이지 파일에 직접 인라인하지 않는다 (FR-11.9).
 */

export interface NoindexContext {
  /** 현재 페이지 경로 (예: "/mypage", "/tags/ai", "/search") */
  path: string;
  /** 검색어 (검색 페이지에서 사용) */
  searchQuery?: string;
  /** 해당 경로의 콘텐츠 수 (태그 랜딩·프로필 페이지에서 사용) */
  contentCount?: number;
  /** 숨김 처리된 콘텐츠 여부 */
  isHidden?: boolean;
  /** 삭제된 콘텐츠 여부 */
  isDeleted?: boolean;
}

const NOINDEX_PATHS = ["/mypage", "/notifications", "/messages", "/inquiries"];

/**
 * 주어진 컨텍스트에 대해 noindex 여부를 반환한다.
 *
 * 조건 평가 순서:
 * 1. 인증 전용 경로 (/mypage, /notifications, /messages, /inquiries, /settings/*)
 * 2. 검색어가 있는 검색 페이지 (/search?q=...)
 * 3. 콘텐츠가 2개 이하인 태그 랜딩 (/tags/{tag})
 * 4. 콘텐츠가 0개인 사용자 프로필 (/u/{nickname})
 * 5. 숨김 또는 삭제된 콘텐츠
 */
export function shouldNoindex(ctx: NoindexContext): boolean {
  // 1. 인증 전용 경로
  if (NOINDEX_PATHS.includes(ctx.path) || ctx.path.startsWith("/settings/")) {
    return true;
  }

  // 2. 검색어가 있는 검색 페이지
  if (ctx.path === "/search" && !!ctx.searchQuery) {
    return true;
  }

  // 3. 콘텐츠가 2개 이하인 태그 랜딩
  if (ctx.path.startsWith("/tags/") && (ctx.contentCount ?? 0) <= 2) {
    return true;
  }

  // 4. 콘텐츠가 0개인 사용자 프로필
  if (ctx.path.startsWith("/u/") && ctx.contentCount === 0) {
    return true;
  }

  // 5. 숨김 또는 삭제된 콘텐츠
  if (ctx.isHidden === true || ctx.isDeleted === true) {
    return true;
  }

  return false;
}
