/**
 * 콘텐츠 크로스 링크 유틸 (Story 9.9).
 *
 * 댓글·신고의 targetType + targetId 를 어드민 관리 화면 URL 로 변환한다.
 * Story 9.10(신고 관리)에서도 재사용 예정.
 *
 * 매핑:
 *   post      → /posts?highlight=:id
 *   question  → /qna
 *   answer    → /qna
 *   resource  → /resources
 *   comment   → /comments (대댓글의 원 댓글이 있는 목록)
 */

export type ContentTargetType = "post" | "question" | "answer" | "resource" | "comment";

/**
 * targetType + targetId 를 받아 어드민 관리 화면 URL 을 반환한다.
 * 매핑이 없는 targetType 이면 null 을 반환한다.
 */
export function getCrossLink(
  targetType: ContentTargetType | string,
  targetId: string,
): string | null {
  switch (targetType) {
    case "post":
      return `/posts?highlight=${targetId}`;
    case "question":
    case "answer":
      return `/qna`;
    case "resource":
      return `/resources`;
    case "comment":
      return `/comments`;
    default:
      return null;
  }
}
